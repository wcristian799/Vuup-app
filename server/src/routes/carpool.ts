/**
 * Carpool routes (protected)
 *
 * GET  /carpool/routes          — list active carpool routes near a location
 * GET  /carpool/routes/:id      — single route detail
 * POST /carpool/routes          — driver creates a new route
 * POST /carpool/routes/:id/join — passenger joins a carpool seat
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { CarpoolRouteSchema, RouteTypeSchema, LatLngSchema } from "../models/schemas.js";
import { MOCK_CARPOOL_ROUTES } from "../models/mock-data.js";

export const carpoolRouter = new Hono();

carpoolRouter.use("/*", requireAuth);

// GET /carpool/routes
carpoolRouter.get("/routes", (c) => {
  const active = MOCK_CARPOOL_ROUTES.filter((r) => r.isActive);
  return c.json({
    data: active,
    pagination: { page: 1, limit: 20, total: active.length, hasNext: false },
  });
});

// GET /carpool/routes/:id
carpoolRouter.get("/routes/:id", (c) => {
  const route = MOCK_CARPOOL_ROUTES.find((r) => r.id === c.req.param("id"));
  if (!route) {
    return c.json({ code: "NOT_FOUND", message: "Carpool route not found" }, 404);
  }
  return c.json(route);
});

// POST /carpool/routes
carpoolRouter.post(
  "/routes",
  zValidator(
    "json",
    z.object({
      name: z.string(),
      routeType: RouteTypeSchema,
      stops: z.array(LatLngSchema.extend({ address: z.string(), order: z.number().int() })),
      maxPassengers: z.number().int().min(1).max(8),
      farePerSeat: z.number().nonnegative(),
      departureTime: z.string().nullable().optional(),
      scheduledAt: z.string().datetime().nullable().optional(),
    }),
  ),
  (c) => {
    const userId = c.get("userId");
    const body = c.req.valid("json");
    const now = new Date().toISOString();
    const route = CarpoolRouteSchema.parse({
      id: crypto.randomUUID(),
      driverId: userId,
      ...body,
      departureTime: body.departureTime ?? null,
      scheduledAt: body.scheduledAt ?? null,
      currentPassengers: 0,
      isActive: true,
      createdAt: now,
    });
    MOCK_CARPOOL_ROUTES.push(route);
    return c.json(route, 201);
  },
);

// POST /carpool/routes/:id/join
carpoolRouter.post("/routes/:id/join", (c) => {
  const idx = MOCK_CARPOOL_ROUTES.findIndex((r) => r.id === c.req.param("id"));
  if (idx === -1) {
    return c.json({ code: "NOT_FOUND", message: "Route not found" }, 404);
  }
  const route = MOCK_CARPOOL_ROUTES[idx]!;
  if (route.currentPassengers >= route.maxPassengers) {
    return c.json({ code: "FULL", message: "No seats available" }, 409);
  }
  MOCK_CARPOOL_ROUTES[idx] = { ...route, currentPassengers: route.currentPassengers + 1 };
  return c.json(MOCK_CARPOOL_ROUTES[idx]);
});
