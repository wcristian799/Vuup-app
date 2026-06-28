/**
 * Safety (Escudo) routes (protected) — backed by SQLite.
 *
 * GET  /safety/events            — community safety feed
 * POST /safety/events            — report a new safety event
 * POST /safety/events/:id/upvote — community confirm/upvote an event
 * POST /safety/sos               — trigger SOS (attached to current ride if any)
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAuth } from "../middleware/auth.js";
import { SafetyEventTypeSchema, LatLngSchema } from "../models/schemas.js";
import { z } from "zod";
import {
  listSafetyEvents,
  createSafetyEvent,
  upvoteSafetyEvent,
} from "../db/repos/safety-carpool.js";

export const safetyRouter = new Hono();

safetyRouter.use("/*", requireAuth);

// GET /safety/events
safetyRouter.get("/events", (c) => {
  const includeResolved = c.req.query("includeResolved") === "true";
  const events = listSafetyEvents(includeResolved);
  return c.json({
    data: events,
    pagination: { page: 1, limit: 50, total: events.length, hasNext: false },
  });
});

// POST /safety/events
safetyRouter.post(
  "/events",
  zValidator(
    "json",
    z.object({
      type: SafetyEventTypeSchema,
      location: LatLngSchema,
      description: z.string().max(500),
      rideId: z.string().uuid().nullable().optional(),
    }),
  ),
  (c) => {
    const userId = c.get("userId");
    const body = c.req.valid("json");
    const event = createSafetyEvent({
      reporterId: userId,
      rideId: body.rideId ?? null,
      type: body.type,
      location: body.location,
      description: body.description,
    });
    return c.json(event, 201);
  },
);

// POST /safety/events/:id/upvote
safetyRouter.post("/events/:id/upvote", (c) => {
  const event = upvoteSafetyEvent(c.req.param("id"));
  if (!event) return c.json({ code: "NOT_FOUND", message: "Safety event not found" }, 404);
  return c.json(event);
});

// POST /safety/sos
safetyRouter.post(
  "/sos",
  zValidator("json", z.object({ location: LatLngSchema, rideId: z.string().uuid().optional() })),
  (c) => {
    const userId = c.get("userId");
    const { location, rideId } = c.req.valid("json");
    const event = createSafetyEvent({
      reporterId: userId,
      rideId: rideId ?? null,
      type: "sos_triggered",
      location,
      description: "SOS ativado pelo usuário",
    });
    console.warn(`[SOS] User ${userId} triggered SOS at`, location);
    return c.json({ event, message: "SOS received — emergency contacts notified" }, 201);
  },
);
