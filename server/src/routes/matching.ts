/**
 * Matching routes — Onda 3
 *
 * Real-time ride matching via Server-Sent Events (SSE).
 *
 * POST   /matching/driver-location          — driver heartbeat location update
 * GET    /matching/nearby-drivers           — nearby drivers (coarsened, LGPD)
 * GET    /matching/rides/:id/stream         — SSE stream: ride events
 * GET    /matching/me/stream                — SSE stream: events for current user
 * GET    /matching/swarm/stream             — SSE stream: swarm/panic broadcasts
 *
 * POST   /matching/rides/:id/disputa/bid    — driver submits a bid
 * GET    /matching/rides/:id/disputa        — get current disputa session state
 * POST   /matching/rides/:id/disputa/cancel — cancel disputa (admin/passenger)
 *
 * POST   /matching/swarm                    — report a panic / community alert
 * POST   /matching/swarm/:id/confirm        — community confirm a swarm event
 * POST   /matching/swarm/:id/resolve        — resolve a swarm event
 * GET    /matching/swarm                    — list active swarm events
 *
 * LGPD compliance:
 *  - Driver GPS coordinates streamed externally are coarsened to 3 decimal
 *    places (~111m). Full-precision is used only for internal bid ranking.
 *  - No A/V data is collected or retained by this module.
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";

import { requireAuth } from "../middleware/auth.js";
import { LatLngSchema } from "../models/schemas.js";
import { MOCK_RIDES } from "../models/mock-data.js";
import {
  rideEventBus,
  updateDriverLocation,
  getNearbyDrivers,
  openDisputaSession,
  submitBid,
  resolveDisputa,
  createSwarmEvent,
  confirmSwarmEvent,
  resolveSwarmEvent,
  DISPUTA_SESSIONS,
  SWARM_EVENTS,
  coarsenCoord,
} from "../lib/matching.js";

export const matchingRouter = new Hono();

matchingRouter.use("/*", requireAuth);

// ─── SSE helpers ─────────────────────────────────────────────────────────────

/**
 * Returns a Hono Response that keeps an SSE connection open.
 * The caller provides a subscribe function which registers an EventEmitter
 * listener and returns an unsubscribe function.
 *
 * Each event is sent as:
 *   event: <type>\n
 *   data: <json>\n\n
 */
function sseResponse(
  subscribe: (send: (eventType: string, payload: unknown) => void) => () => void,
): Response {
  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (eventType: string, payload: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`),
          );
        } catch {
          // Client disconnected
        }
      };

      // Send initial heartbeat so the client knows we're live
      send("connected", { ts: new Date().toISOString() });

      cleanup = subscribe(send);
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disable nginx buffering
    },
  });
}

// ─── Driver location heartbeat ────────────────────────────────────────────────

matchingRouter.post(
  "/driver-location",
  zValidator(
    "json",
    z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    }),
  ),
  (c) => {
    const userId = c.get("userId");
    const userRole = c.get("userRole");

    if (userRole !== "driver" && userRole !== "motoboy" && userRole !== "admin") {
      throw new HTTPException(403, { message: "Only drivers can update location" });
    }

    const { lat, lng } = c.req.valid("json");
    updateDriverLocation(userId, lat, lng);

    return c.json({
      ok: true,
      stored: { lat: coarsenCoord(lat), lng: coarsenCoord(lng) },
    });
  },
);

// ─── Nearby drivers (LGPD-coarsened) ─────────────────────────────────────────

matchingRouter.get("/nearby-drivers", (c) => {
  const lat = parseFloat(c.req.query("lat") ?? "0");
  const lng = parseFloat(c.req.query("lng") ?? "0");
  const radius = parseFloat(c.req.query("radius") ?? "10");

  if (isNaN(lat) || isNaN(lng)) {
    return c.json({ code: "BAD_REQUEST", message: "lat and lng are required" }, 400);
  }

  const drivers = getNearbyDrivers(lat, lng, Math.min(radius, 50)).map((d) => ({
    driverId: d.driverId,
    lat: coarsenCoord(d.lat),
    lng: coarsenCoord(d.lng),
    distanceKm: Math.round(d.distanceKm * 100) / 100,
    updatedAt: d.updatedAt,
  }));

  return c.json({ drivers });
});

// ─── SSE: ride event stream ───────────────────────────────────────────────────

matchingRouter.get("/rides/:id/stream", (c) => {
  const rideId = c.req.param("id");
  const userId = c.get("userId");

  const ride = MOCK_RIDES.find((r) => r.id === rideId);
  if (!ride) {
    return c.json({ code: "NOT_FOUND", message: "Ride not found" }, 404);
  }

  // Only the ride's passenger and driver (once assigned) can subscribe
  const isParticipant =
    ride.passengerId === userId ||
    ride.driverId === userId ||
    c.get("userRole") === "admin";

  if (!isParticipant) {
    throw new HTTPException(403, { message: "Not a participant in this ride" });
  }

  return sseResponse((send) => {
    const channel = `ride:${rideId}`;
    const handler = (payload: { type: string; data: unknown }) => {
      send(payload.type, payload.data);
    };
    rideEventBus.on(channel, handler);
    return () => rideEventBus.off(channel, handler);
  });
});

// ─── SSE: user event stream ───────────────────────────────────────────────────

matchingRouter.get("/me/stream", (c) => {
  const userId = c.get("userId");

  return sseResponse((send) => {
    const channel = `user:${userId}`;
    const handler = (payload: { type: string; data: unknown }) => {
      send(payload.type, payload.data);
    };
    rideEventBus.on(channel, handler);
    return () => rideEventBus.off(channel, handler);
  });
});

// ─── SSE: swarm broadcast stream ─────────────────────────────────────────────

matchingRouter.get("/swarm/stream", (c) => {
  return sseResponse((send) => {
    const handler = (payload: { type: string; data: unknown }) => {
      send(payload.type, payload.data);
    };
    rideEventBus.on("swarm:broadcast", handler);
    return () => rideEventBus.off("swarm:broadcast", handler);
  });
});

// ─── Disputa de corrida ───────────────────────────────────────────────────────

/** GET /matching/rides/:id/disputa — current session state */
matchingRouter.get("/rides/:id/disputa", (c) => {
  const rideId = c.req.param("id");
  const session = DISPUTA_SESSIONS.get(rideId);
  if (!session) {
    return c.json({ code: "NOT_FOUND", message: "No disputa session for this ride" }, 404);
  }

  const userId = c.get("userId");
  const userRole = c.get("userRole");

  // Passengers see full session; drivers see only their own bid
  const isPassenger = session.passengerId === userId;
  const isAdmin = userRole === "admin";

  const publicSession = {
    rideId: session.rideId,
    fareEstimateCents: session.fareEstimateCents,
    bidsCount: session.bids.length,
    windowOpensAt: session.windowOpensAt,
    windowExpiresAt: session.windowExpiresAt,
    outcome: session.outcome,
    winnerId: isPassenger || isAdmin ? session.winnerId : undefined,
    // Drivers only see their own bid (no revealing other bids during window)
    myBid:
      !isPassenger && !isAdmin
        ? (session.bids.find((b) => b.driverId === userId) ?? null)
        : undefined,
    // Passengers/admins see all bids after resolution
    bids:
      (isPassenger || isAdmin) && session.outcome !== "open" ? session.bids : undefined,
  };

  return c.json(publicSession);
});

/** POST /matching/rides/:id/disputa/bid — driver submits a bid */
matchingRouter.post(
  "/rides/:id/disputa/bid",
  zValidator(
    "json",
    z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      offeredFareCents: z.number().int().positive().optional(),
    }),
  ),
  (c) => {
    const rideId = c.req.param("id");
    const userId = c.get("userId");
    const userRole = c.get("userRole");

    if (userRole !== "driver" && userRole !== "motoboy" && userRole !== "admin") {
      throw new HTTPException(403, { message: "Only drivers can submit bids" });
    }

    const { lat, lng, offeredFareCents } = c.req.valid("json");

    // Also update the driver's global location register
    updateDriverLocation(userId, lat, lng);

    const result = submitBid(rideId, userId, { lat, lng }, offeredFareCents);

    if ("error" in result) {
      const statusMap: Record<string, 400 | 404 | 409 | 422> = {
        DISPUTA_NOT_FOUND: 404,
        DISPUTA_CLOSED: 422,
        WINDOW_EXPIRED: 422,
        DISPUTE_FULL: 409,
        ALREADY_BID: 409,
        FARE_EXCEEDS_ESTIMATE: 422,
      };
      const status = statusMap[result.error] ?? 400;
      return c.json({ code: result.error, message: result.error }, status);
    }

    return c.json(
      {
        bid: {
          rideId: result.rideId,
          driverId: result.driverId,
          distanceToOriginKm: Math.round(result.distanceToOriginKm * 100) / 100,
          offeredFareCents: result.offeredFareCents,
          bidAt: result.bidAt,
        },
        message: "Bid submitted",
      },
      201,
    );
  },
);

/** POST /matching/rides/:id/disputa/cancel — cancel disputa */
matchingRouter.post("/rides/:id/disputa/cancel", (c) => {
  const rideId = c.req.param("id");
  const userId = c.get("userId");
  const userRole = c.get("userRole");

  const session = DISPUTA_SESSIONS.get(rideId);
  if (!session) {
    return c.json({ code: "NOT_FOUND", message: "No disputa session for this ride" }, 404);
  }

  if (session.passengerId !== userId && userRole !== "admin") {
    throw new HTTPException(403, { message: "Only the passenger or admin can cancel" });
  }

  const resolved = resolveDisputa(rideId, "cancelled");
  return c.json({ ok: true, session: resolved });
});

// ─── Efeito Enxame / The Shield ────────────────────────────────────────────────

/** POST /matching/swarm — report panic or community alert */
matchingRouter.post(
  "/swarm",
  zValidator(
    "json",
    z.object({
      type: z.enum(["panic", "community_alert", "swarm_active"]),
      location: LatLngSchema,
      description: z.string().max(500).default(""),
    }),
  ),
  (c) => {
    const userId = c.get("userId");
    const { type, location, description } = c.req.valid("json");

    const event = createSwarmEvent(type, userId, location.lat, location.lng, description);

    return c.json(
      {
        event: {
          id: event.id,
          type: event.type,
          lat: event.lat,
          lng: event.lng,
          description: event.description,
          confirmCount: event.confirmCount,
          swarmActive: event.swarmActive,
          createdAt: event.createdAt,
        },
      },
      201,
    );
  },
);

/** POST /matching/swarm/:id/confirm — community confirm */
matchingRouter.post("/swarm/:id/confirm", (c) => {
  const eventId = c.req.param("id");
  const evt = confirmSwarmEvent(eventId, c.get("userId"));
  if (!evt) {
    return c.json({ code: "NOT_FOUND", message: "Swarm event not found or already resolved" }, 404);
  }
  return c.json({ event: evt });
});

/** POST /matching/swarm/:id/resolve — resolve a swarm event */
matchingRouter.post("/swarm/:id/resolve", (c) => {
  const userRole = c.get("userRole");
  if (userRole !== "admin") {
    throw new HTTPException(403, { message: "Only admins can resolve swarm events" });
  }
  const evt = resolveSwarmEvent(c.req.param("id"));
  if (!evt) {
    return c.json({ code: "NOT_FOUND", message: "Swarm event not found" }, 404);
  }
  return c.json({ event: evt });
});

/** GET /matching/swarm — list active swarm events */
matchingRouter.get("/swarm", (c) => {
  const lat = c.req.query("lat") ? parseFloat(c.req.query("lat")!) : null;
  const lng = c.req.query("lng") ? parseFloat(c.req.query("lng")!) : null;
  const radiusKm = parseFloat(c.req.query("radius") ?? "20");

  let events = SWARM_EVENTS.filter((e) => !e.resolvedAt);

  if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
    events = events.filter((e) => {
      const d = Math.sqrt((e.lat - lat) ** 2 + (e.lng - lng) ** 2) * 111; // rough km
      return d <= radiusKm;
    });
  }

  return c.json({
    data: events,
    pagination: { page: 1, limit: 50, total: events.length, hasNext: false },
  });
});
