/**
 * Rides routes (all protected)
 *
 * POST   /rides/fare-estimate        — price quote before requesting
 * GET    /rides/nearby-drivers       — nearest available drivers
 * POST   /rides                      — request a new ride (real pricing + VIP window)
 * GET    /rides                      — list rides for current user
 * GET    /rides/:id                  — get single ride with VIP window state
 * PATCH  /rides/:id/cancel           — passenger cancels a ride
 * PATCH  /rides/:id/status           — driver advances ride status (state machine)
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";

import { requireAuth } from "../middleware/auth.js";
import { RideRequestV2Schema, FareEstimateRequestSchema } from "../models/schemas.js";
import {
  MOCK_RIDES,
  MOCK_USERS,
  findPatronLinkByPassenger,
  findVipWindowByRide,
  createVipWindow,
  MOCK_VIP_WINDOWS,
  findCouponByCode,
} from "../models/mock-data.js";
import { calculateFare } from "../lib/pricing.js";
import type { Modality } from "../models/schemas.js";

// ─── State machine: allowed transitions ──────────────────────────────────────
//
// searching       -> accepted | cancelled
// accepted        -> driver_en_route | cancelled
// driver_en_route -> in_progress | cancelled
// in_progress     -> completed | cancelled
// completed       -> (terminal)
// cancelled       -> (terminal)

const VALID_TRANSITIONS: Record<string, string[]> = {
  searching: ["accepted", "cancelled"],
  accepted: ["driver_en_route", "cancelled"],
  driver_en_route: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export const ridesRouter = new Hono();

ridesRouter.use("/*", requireAuth);

// ─── POST /rides/fare-estimate ────────────────────────────────────────────────

ridesRouter.post(
  "/fare-estimate",
  zValidator("json", FareEstimateRequestSchema),
  (c) => {
    const body = c.req.valid("json");
    const coupon = body.couponCode ? findCouponByCode(body.couponCode) : undefined;

    if (body.couponCode && !coupon) {
      return c.json({ code: "INVALID_COUPON", message: "Coupon not found or expired" }, 400);
    }

    const breakdown = calculateFare({
      modality: body.modality,
      origin: body.origin,
      destination: body.destination,
      coupon,
    });

    return c.json({ fareBreakdown: breakdown });
  },
);

// ─── GET /rides/nearby-drivers ────────────────────────────────────────────────

ridesRouter.get("/nearby-drivers", (c) => {
  const drivers = MOCK_USERS.filter((u) => u.role === "driver" && u.status === "active").map(
    (u) => ({
      id: u.id,
      fullName: u.fullName,
      rating: u.rating,
      location: {
        lat: -23.55 + (Math.random() - 0.5) * 0.05,
        lng: -46.63 + (Math.random() - 0.5) * 0.05,
      },
      estimatedArrivalMin: Math.floor(Math.random() * 8) + 2,
    }),
  );
  return c.json({ drivers });
});

// ─── POST /rides ──────────────────────────────────────────────────────────────

ridesRouter.post("/", zValidator("json", RideRequestV2Schema), (c) => {
  const userId = c.get("userId");
  const userRole = c.get("userRole");
  const body = c.req.valid("json");

  if (userRole !== "passenger" && userRole !== "admin") {
    throw new HTTPException(403, { message: "Only passengers can request rides" });
  }

  const modality: Modality = (body.modality as Modality | undefined) ?? (body.routeType as Modality);

  const coupon = body.couponCode ? findCouponByCode(body.couponCode) : undefined;
  if (body.couponCode && !coupon) {
    return c.json({ code: "INVALID_COUPON", message: "Coupon not found or expired" }, 400);
  }

  const fareBreakdown = calculateFare({
    modality,
    origin: body.origin,
    destination: body.destination,
    coupon,
  });

  const now = new Date().toISOString();
  const rideId = crypto.randomUUID();

  const newRide = {
    id: rideId,
    passengerId: userId,
    driverId: null as string | null,
    routeType: body.routeType,
    status: "searching" as const,
    origin: body.origin,
    destination: body.destination,
    estimatedDistanceKm: fareBreakdown.distanceKm,
    estimatedDurationMin: fareBreakdown.durationMin,
    fareEstimate: fareBreakdown.totalCents,
    fareActual: null as number | null,
    scheduledAt: body.scheduledAt ?? null,
    startedAt: null as string | null,
    completedAt: null as string | null,
    cancelledAt: null as string | null,
    cancellationReason: null as string | null,
    fareBreakdown,
    createdAt: now,
    updatedAt: now,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  MOCK_RIDES.push(newRide as any);

  // VIP window: if passenger has a patron driver, reserve 15 seconds.
  const patronLink = findPatronLinkByPassenger(userId);
  let vipWindow = null;
  if (patronLink) {
    vipWindow = createVipWindow(rideId, patronLink.driverId);
  }

  return c.json(
    {
      ride: newRide,
      fareBreakdown,
      vipWindow: vipWindow
        ? {
            patronDriverId: vipWindow.patronDriverId,
            windowExpiresAt: vipWindow.windowExpiresAt,
            message:
              "Seu Motorista Patrono tem 15 segundos de prioridade antes de abrir para todos os motoristas.",
          }
        : null,
    },
    201,
  );
});

// ─── GET /rides ───────────────────────────────────────────────────────────────

ridesRouter.get("/", (c) => {
  const userId = c.get("userId");
  const userRole = c.get("userRole");

  const rides =
    userRole === "driver" || userRole === "motoboy"
      ? MOCK_RIDES.filter((r) => r.driverId === userId)
      : MOCK_RIDES.filter((r) => r.passengerId === userId);

  return c.json({
    data: rides,
    pagination: { page: 1, limit: 20, total: rides.length, hasNext: false },
  });
});

// ─── GET /rides/:id ───────────────────────────────────────────────────────────

ridesRouter.get("/:id", (c) => {
  const ride = MOCK_RIDES.find((r) => r.id === c.req.param("id"));
  if (!ride) {
    return c.json({ code: "NOT_FOUND", message: "Ride not found" }, 404);
  }

  const vipWindow = findVipWindowByRide(ride.id);
  const vipWindowPublic = vipWindow
    ? {
        patronDriverId: vipWindow.patronDriverId,
        windowOpensAt: vipWindow.windowOpensAt,
        windowExpiresAt: vipWindow.windowExpiresAt,
        outcome: vipWindow.outcome,
        isActive:
          vipWindow.outcome === "pending" && new Date(vipWindow.windowExpiresAt) > new Date(),
      }
    : null;

  return c.json({ ride, vipWindow: vipWindowPublic });
});

// ─── PATCH /rides/:id/cancel ──────────────────────────────────────────────────

ridesRouter.patch(
  "/:id/cancel",
  zValidator(
    "json",
    z.object({
      reason: z.string().max(200).optional(),
    }),
  ),
  (c) => {
    const userId = c.get("userId");
    const userRole = c.get("userRole");
    const idx = MOCK_RIDES.findIndex((r) => r.id === c.req.param("id"));
    if (idx === -1) {
      return c.json({ code: "NOT_FOUND", message: "Ride not found" }, 404);
    }

    const ride = MOCK_RIDES[idx]!;

    if (ride.passengerId !== userId && userRole !== "admin") {
      throw new HTTPException(403, { message: "Only the ride passenger can cancel" });
    }

    if (ride.status === "completed" || ride.status === "cancelled") {
      return c.json(
        {
          code: "INVALID_TRANSITION",
          message: `Cannot cancel a ride that is already "${ride.status}"`,
        },
        422,
      );
    }

    const { reason } = c.req.valid("json");
    const now = new Date().toISOString();
    const updated = {
      ...ride,
      status: "cancelled" as const,
      cancelledAt: now,
      cancellationReason: reason ?? null,
      updatedAt: now,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    MOCK_RIDES[idx] = updated as any;

    // Expire any pending VIP window.
    const winIdx = MOCK_VIP_WINDOWS.findIndex((w) => w.rideId === ride.id);
    if (winIdx !== -1 && MOCK_VIP_WINDOWS[winIdx]!.outcome === "pending") {
      MOCK_VIP_WINDOWS[winIdx] = { ...MOCK_VIP_WINDOWS[winIdx]!, outcome: "expired" };
    }

    return c.json(updated);
  },
);

// ─── PATCH /rides/:id/status ──────────────────────────────────────────────────

ridesRouter.patch(
  "/:id/status",
  zValidator(
    "json",
    z.object({
      status: z.enum(["accepted", "driver_en_route", "in_progress", "completed", "cancelled"]),
    }),
  ),
  (c) => {
    const userId = c.get("userId");
    const userRole = c.get("userRole");
    const idx = MOCK_RIDES.findIndex((r) => r.id === c.req.param("id"));
    if (idx === -1) {
      return c.json({ code: "NOT_FOUND", message: "Ride not found" }, 404);
    }

    const ride = MOCK_RIDES[idx]!;
    const { status: nextStatus } = c.req.valid("json");

    // Validate state machine transition.
    const allowed = VALID_TRANSITIONS[ride.status] ?? [];
    if (!allowed.includes(nextStatus)) {
      return c.json(
        {
          code: "INVALID_TRANSITION",
          message: `Cannot transition from "${ride.status}" to "${nextStatus}"`,
          allowedTransitions: allowed,
        },
        422,
      );
    }

    // VIP window check: a non-patron driver cannot accept during the window.
    if (nextStatus === "accepted" && (userRole === "driver" || userRole === "motoboy")) {
      const vipWin = findVipWindowByRide(ride.id);
      if (vipWin && vipWin.outcome === "pending") {
        const windowStillOpen = new Date(vipWin.windowExpiresAt) > new Date();
        if (windowStillOpen && vipWin.patronDriverId !== userId) {
          return c.json(
            {
              code: "VIP_WINDOW_ACTIVE",
              message:
                "Esta corrida está reservada para o Motorista Patrono do passageiro por 15 segundos.",
              windowExpiresAt: vipWin.windowExpiresAt,
            },
            409,
          );
        }
        // Settle the window outcome.
        const winIdx = MOCK_VIP_WINDOWS.findIndex((w) => w.rideId === ride.id);
        if (winIdx !== -1) {
          MOCK_VIP_WINDOWS[winIdx] = {
            ...MOCK_VIP_WINDOWS[winIdx]!,
            outcome: windowStillOpen ? "accepted" : "expired",
          };
        }
      }
    }

    const now = new Date().toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updated: any = { ...ride, status: nextStatus, updatedAt: now };

    if (nextStatus === "accepted") updated.driverId = userId;
    if (nextStatus === "in_progress") updated.startedAt = now;
    if (nextStatus === "completed") {
      updated.completedAt = now;
      updated.fareActual = ride.fareEstimate;
    }
    if (nextStatus === "cancelled") updated.cancelledAt = now;

    MOCK_RIDES[idx] = updated;

    return c.json(updated);
  },
);
