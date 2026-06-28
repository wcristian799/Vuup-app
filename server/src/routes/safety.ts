/**
 * Safety (Escudo) routes (protected)
 *
 * GET  /safety/events       — community safety feed near a location
 * POST /safety/events       — report a new safety event
 * POST /safety/events/:id/upvote — community confirm/upvote an event
 * POST /safety/sos          — trigger SOS (attached to current ride if any)
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAuth } from "../middleware/auth.js";
import { SafetyEventSchema, SafetyEventTypeSchema, LatLngSchema } from "../models/schemas.js";
import { MOCK_SAFETY_EVENTS } from "../models/mock-data.js";
import { z } from "zod";

export const safetyRouter = new Hono();

safetyRouter.use("/*", requireAuth);

// GET /safety/events
safetyRouter.get("/events", (c) => {
  const unresolved = MOCK_SAFETY_EVENTS.filter((e) => !e.isResolved);
  return c.json({
    data: unresolved,
    pagination: { page: 1, limit: 50, total: unresolved.length, hasNext: false },
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
    const now = new Date().toISOString();
    const event = SafetyEventSchema.parse({
      id: crypto.randomUUID(),
      reporterId: userId,
      rideId: body.rideId ?? null,
      type: body.type,
      location: body.location,
      description: body.description,
      isResolved: false,
      upvotes: 0,
      createdAt: now,
      resolvedAt: null,
    });
    MOCK_SAFETY_EVENTS.push(event);
    return c.json(event, 201);
  },
);

// POST /safety/events/:id/upvote
safetyRouter.post("/events/:id/upvote", (c) => {
  const idx = MOCK_SAFETY_EVENTS.findIndex((e) => e.id === c.req.param("id"));
  if (idx === -1) {
    return c.json({ code: "NOT_FOUND", message: "Safety event not found" }, 404);
  }
  MOCK_SAFETY_EVENTS[idx] = {
    ...MOCK_SAFETY_EVENTS[idx]!,
    upvotes: MOCK_SAFETY_EVENTS[idx]!.upvotes + 1,
  };
  return c.json(MOCK_SAFETY_EVENTS[idx]);
});

// POST /safety/sos
safetyRouter.post(
  "/sos",
  zValidator("json", z.object({ location: LatLngSchema, rideId: z.string().uuid().optional() })),
  (c) => {
    const userId = c.get("userId");
    const { location, rideId } = c.req.valid("json");
    const now = new Date().toISOString();
    const event = SafetyEventSchema.parse({
      id: crypto.randomUUID(),
      reporterId: userId,
      rideId: rideId ?? null,
      type: "sos_triggered",
      location,
      description: "SOS ativado pelo usuário",
      isResolved: false,
      upvotes: 0,
      createdAt: now,
      resolvedAt: null,
    });
    MOCK_SAFETY_EVENTS.push(event);
    console.warn(`[SOS] User ${userId} triggered SOS at`, location);
    return c.json({ event, message: "SOS received — emergency contacts notified (mock)" }, 201);
  },
);
