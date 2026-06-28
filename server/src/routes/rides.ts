/**
 * Rides routes (all protected) — backed by SQLite.
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
import { calculateFare } from "../lib/pricing.js";
import type { Modality } from "../models/schemas.js";
import { listUsersByRole } from "../db/repos/users.js";
import {
  findRideById,
  listRidesByPassenger,
  listRidesByDriver,
  countRidesByPassenger,
  countRidesByDriver,
  createRide,
  updateRideStatus,
  findVipWindowByRide,
  createVipWindow,
  settleVipWindow,
  findPatronLinkByPassenger,
} from "../db/repos/rides.js";
import { findCouponByCode, redeemCoupon } from "../db/repos/campaigns.js";
import { findWalletByUserId, addTransaction } from "../db/repos/wallet.js";
import { incrementTotalRides } from "../db/repos/users.js";

// ─── State machine ────────────────────────────────────────────────────────────

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

ridesRouter.post("/fare-estimate", zValidator("json", FareEstimateRequestSchema), (c) => {
  const body = c.req.valid("json");
  const coupon = body.couponCode ? findCouponByCode(body.couponCode) : undefined;

  if (body.couponCode && !coupon) {
    return c.json({ code: "INVALID_COUPON", message: "Coupon not found or expired" }, 400);
  }

  const breakdown = calculateFare({
    modality: body.modality,
    origin: body.origin,
    destination: body.destination,
    coupon: coupon ?? undefined,
  });

  return c.json({ fareBreakdown: breakdown });
});

// ─── GET /rides/nearby-drivers ────────────────────────────────────────────────

ridesRouter.get("/nearby-drivers", (c) => {
  const drivers = listUsersByRole("driver")
    .filter((u) => u.status === "active")
    .map((u) => ({
      id: u.id,
      fullName: u.fullName,
      rating: u.rating,
      location: {
        lat: -23.55 + (Math.random() - 0.5) * 0.05,
        lng: -46.63 + (Math.random() - 0.5) * 0.05,
      },
      estimatedArrivalMin: Math.floor(Math.random() * 8) + 2,
    }));
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
    coupon: coupon ?? undefined,
  });

  const ride = createRide({
    passengerId: userId,
    routeType: body.routeType,
    origin: body.origin,
    destination: body.destination,
    estimatedDistanceKm: fareBreakdown.distanceKm,
    estimatedDurationMin: fareBreakdown.durationMin,
    fareEstimate: fareBreakdown.totalCents,
    couponCode: body.couponCode ?? null,
    couponDiscountCents: fareBreakdown.couponDiscountCents,
    scheduledAt: body.scheduledAt ?? null,
    fareBreakdown,
  });

  // VIP window: if passenger has a patron driver, open 15-second window
  const patronLink = findPatronLinkByPassenger(userId);
  let vipWindow = null;
  if (patronLink) {
    vipWindow = createVipWindow(ride.id, patronLink.driverId);
  }

  return c.json(
    {
      ride,
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
  const page = Math.max(1, Number(c.req.query("page") ?? 1));
  const limit = Math.min(50, Math.max(1, Number(c.req.query("limit") ?? 20)));
  const offset = (page - 1) * limit;

  const isDriver = userRole === "driver" || userRole === "motoboy";
  const rides = isDriver
    ? listRidesByDriver(userId, limit, offset)
    : listRidesByPassenger(userId, limit, offset);
  const total = isDriver ? countRidesByDriver(userId) : countRidesByPassenger(userId);

  return c.json({
    data: rides,
    pagination: { page, limit, total, hasNext: offset + limit < total },
  });
});

// ─── GET /rides/:id ───────────────────────────────────────────────────────────

ridesRouter.get("/:id", (c) => {
  const ride = findRideById(c.req.param("id"));
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
  zValidator("json", z.object({ reason: z.string().max(200).optional() })),
  (c) => {
    const userId = c.get("userId");
    const userRole = c.get("userRole");
    const ride = findRideById(c.req.param("id"));

    if (!ride) return c.json({ code: "NOT_FOUND", message: "Ride not found" }, 404);

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
    const updated = updateRideStatus(ride.id, {
      status: "cancelled",
      cancelledAt: now,
      cancellationReason: reason ?? null,
    });

    // Expire any pending VIP window
    const vipWin = findVipWindowByRide(ride.id);
    if (vipWin && vipWin.outcome === "pending") {
      settleVipWindow(ride.id, "expired");
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
    const ride = findRideById(c.req.param("id"));

    if (!ride) return c.json({ code: "NOT_FOUND", message: "Ride not found" }, 404);

    const { status: nextStatus } = c.req.valid("json");
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

    // VIP window check: non-patron driver cannot accept during window
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
        settleVipWindow(ride.id, windowStillOpen ? "accepted" : "expired");
      }
    }

    const now = new Date().toISOString();
    const updates: Parameters<typeof updateRideStatus>[1] = { status: nextStatus };

    if (nextStatus === "accepted") updates.driverId = userId;
    if (nextStatus === "in_progress") updates.startedAt = now;
    if (nextStatus === "completed") {
      updates.completedAt = now;
      updates.fareActual = ride.fareEstimate;
    }
    if (nextStatus === "cancelled") updates.cancelledAt = now;

    const updated = updateRideStatus(ride.id, updates);

    // Post-completion: settle earnings (best-effort — missing wallets are skipped)
    if (nextStatus === "completed" && updated) {
      const driverId = updated.driverId;
      const fareBreakdown = updated.fareBreakdown;
      try {
        if (driverId && fareBreakdown) {
          const driverWallet = findWalletByUserId(driverId);
          if (driverWallet) {
            addTransaction({
              walletId: driverWallet.id,
              type: "ride_earning",
              amountCents: fareBreakdown.driverEarningsCents,
              referenceId: ride.id,
              description: `Corrida #${ride.id.slice(0, 8)} — tarifa R$${(updated.fareActual! / 100).toFixed(2)}`,
              isEarning: true,
            });
          }
          incrementTotalRides(driverId);
        }
        const passengerWallet = findWalletByUserId(ride.passengerId);
        if (passengerWallet) {
          addTransaction({
            walletId: passengerWallet.id,
            type: "ride_payment",
            amountCents: -(updated.fareActual ?? ride.fareEstimate),
            referenceId: ride.id,
            description: `Pagamento corrida #${ride.id.slice(0, 8)}`,
          });
        }
        incrementTotalRides(ride.passengerId);
        if (ride.couponCode) {
          redeemCoupon(ride.couponCode);
        }
      } catch (err) {
        console.error("[rides] post-completion settlement error (non-fatal):", err);
      }
    }

    return c.json(updated);
  },
);
