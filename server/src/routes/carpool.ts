/**
 * Carpool routes (protected) — backed by SQLite.
 *
 * GET  /carpool/routes          — list active carpool routes
 * GET  /carpool/routes/:id      — single route detail
 * POST /carpool/routes          — driver creates a new route
 * POST /carpool/routes/:id/join — passenger joins a carpool seat
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { requireAuth } from "../middleware/auth.js";
import { RouteTypeSchema, LatLngSchema } from "../models/schemas.js";
import {
  listCarpoolRoutes,
  findCarpoolRouteById,
  createCarpoolRoute,
  joinCarpoolRoute,
} from "../db/repos/safety-carpool.js";

export const carpoolRouter = new Hono();

carpoolRouter.use("/*", requireAuth);

// GET /carpool/routes
carpoolRouter.get("/routes", (c) => {
  const routes = listCarpoolRoutes(true);
  return c.json({
    data: routes,
    pagination: { page: 1, limit: 50, total: routes.length, hasNext: false },
  });
});

// GET /carpool/routes/:id
carpoolRouter.get("/routes/:id", (c) => {
  const route = findCarpoolRouteById(c.req.param("id"));
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
    const userRole = c.get("userRole");
    const body = c.req.valid("json");

    if (userRole !== "driver" && userRole !== "motoboy" && userRole !== "admin") {
      throw new HTTPException(403, { message: "Only drivers can create carpool routes" });
    }

    const route = createCarpoolRoute({
      driverId: userId,
      name: body.name,
      routeType: body.routeType,
      stops: body.stops,
      maxPassengers: body.maxPassengers,
      farePerSeat: body.farePerSeat,
      departureTime: body.departureTime ?? null,
      scheduledAt: body.scheduledAt ?? null,
    });
    return c.json(route, 201);
  },
);

// POST /carpool/routes/:id/join
carpoolRouter.post("/routes/:id/join", (c) => {
  const updated = joinCarpoolRoute(c.req.param("id"));
  if (updated === undefined) {
    const existing = findCarpoolRouteById(c.req.param("id"));
    if (!existing) return c.json({ code: "NOT_FOUND", message: "Route not found" }, 404);
    return c.json({ code: "FULL", message: "No seats available" }, 409);
  }
  return c.json(updated);
});
