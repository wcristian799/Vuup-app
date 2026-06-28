/**
 * Rides routes (all protected)
 *
 * POST   /rides                       — request a new ride
 * GET    /rides                       — list rides for current user
 * GET    /rides/:id                   — get single ride
 * PATCH  /rides/:id/status            — driver accepts / cancels
 * GET    /rides/nearby-drivers        — nearest available drivers (mock)
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { RideRequestSchema } from "../models/schemas.js";
import { MOCK_RIDES, MOCK_USERS } from "../models/mock-data.js";

export const ridesRouter = new Hono();

ridesRouter.use("/*", requireAuth);

// POST /rides — request a new ride
ridesRouter.post("/", zValidator("json", RideRequestSchema), (c) => {
  const userId = c.get("userId");
  const body = c.req.valid("json");
  const now = new Date().toISOString();

  const newRide = {
    id: crypto.randomUUID(),
    passengerId: userId,
    driverId: null,
    routeType: body.routeType,
    status: "searching" as const,
    origin: body.origin,
    destination: body.destination,
    estimatedDistanceKm: 3.0, // mock calculation
    estimatedDurationMin: 12,
    fareEstimate: Math.round(3.0 * 450 + 500), // R$0.04.50/km + base
    fareActual: null,
    scheduledAt: body.scheduledAt ?? null,
    startedAt: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  MOCK_RIDES.push(newRide);
  return c.json(newRide, 201);
});

// GET /rides — list user rides
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

// GET /rides/nearby-drivers
ridesRouter.get("/nearby-drivers", (c) => {
  const drivers = MOCK_USERS.filter((u) => u.role === "driver" && u.status === "active").map(
    (u) => ({
      id: u.id,
      fullName: u.fullName,
      rating: u.rating,
      // Mock position near São Paulo centro
      location: {
        lat: -23.55 + (Math.random() - 0.5) * 0.05,
        lng: -46.63 + (Math.random() - 0.5) * 0.05,
      },
      estimatedArrivalMin: Math.floor(Math.random() * 8) + 2,
    }),
  );
  return c.json({ drivers });
});

// GET /rides/:id
ridesRouter.get("/:id", (c) => {
  const ride = MOCK_RIDES.find((r) => r.id === c.req.param("id"));
  if (!ride) {
    return c.json({ code: "NOT_FOUND", message: "Ride not found" }, 404);
  }
  return c.json(ride);
});

// PATCH /rides/:id/status
ridesRouter.patch(
  "/:id/status",
  zValidator(
    "json",
    z.object({
      status: z.enum(["accepted", "driver_en_route", "in_progress", "completed", "cancelled"]),
    }),
  ),
  (c) => {
    const idx = MOCK_RIDES.findIndex((r) => r.id === c.req.param("id"));
    if (idx === -1) {
      return c.json({ code: "NOT_FOUND", message: "Ride not found" }, 404);
    }
    const { status } = c.req.valid("json");
    const now = new Date().toISOString();
    const ride = { ...MOCK_RIDES[idx]!, status, updatedAt: now };

    if (status === "in_progress") ride.startedAt = now;
    if (status === "completed") {
      ride.completedAt = now;
      ride.fareActual = ride.fareEstimate;
    }

    MOCK_RIDES[idx] = ride;
    return c.json(ride);
  },
);
