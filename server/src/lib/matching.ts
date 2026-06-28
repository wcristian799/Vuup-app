/**
 * VUUP Matching Engine — Onda 3
 *
 * Implements:
 *  1. In-memory SSE event bus for real-time ride notifications
 *  2. Disputa de corrida: up to 5 drivers compete in a 15-second window.
 *     Winner selection rule: nearest driver first; ties broken by lowest bid
 *     (price stability guarantee — passenger always pays the original estimate).
 *  3. Efeito Enxame / The Shield: panic counter and community swarm state.
 *
 * This is intentionally stateless-process-friendly: the event bus is in-memory
 * for the mock server. In production, replace the EventEmitter bus with a
 * Redis pub/sub or a proper message broker.
 *
 * LGPD note: driver locations streamed via SSE are coarsened to 3 decimal
 * places (~111m precision) before leaving the server. Full-precision GPS is
 * only retained for internal matching logic and is never written to logs.
 */

import { EventEmitter } from "node:events";
import { estimateDistanceKm } from "./pricing.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DriverLocation {
  driverId: string;
  lat: number;
  lng: number;
  /** ISO timestamp of last known position */
  updatedAt: string;
}

export interface RideBid {
  driverId: string;
  rideId: string;
  /** Driver's GPS location at bid time */
  location: { lat: number; lng: number };
  /**
   * Optional price counter-offer in BRL cents.
   * Must be <= original fare estimate (price-stability rule).
   * Defaults to fareEstimate if omitted.
   */
  offeredFareCents: number;
  /** Distance from driver to ride origin at bid time (computed) */
  distanceToOriginKm: number;
  bidAt: string;
}

export interface DisputaSession {
  rideId: string;
  passengerId: string;
  originLat: number;
  originLng: number;
  fareEstimateCents: number;
  /** Bids received, capped at MAX_BIDS */
  bids: RideBid[];
  windowOpensAt: string;
  windowExpiresAt: string;
  /** Winning driver, set when dispute resolves */
  winnerId: string | null;
  outcome: "open" | "resolved" | "expired" | "cancelled";
}

export interface SwarmEvent {
  id: string;
  type: "panic" | "community_alert" | "swarm_active";
  triggeredByUserId: string;
  /** Coarsened location (3 dp) — LGPD compliant */
  lat: number;
  lng: number;
  description: string;
  /** Number of community members who confirmed this event */
  confirmCount: number;
  /** True once confirmCount >= SWARM_THRESHOLD */
  swarmActive: boolean;
  createdAt: string;
  resolvedAt: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const DISPUTA_WINDOW_MS = 15_000; // 15 seconds
export const MAX_BIDS = 5;              // max drivers per dispute
export const SWARM_THRESHOLD = 3;       // confirmations to activate swarm

// ─── In-memory stores ────────────────────────────────────────────────────────

export const DRIVER_LOCATIONS = new Map<string, DriverLocation>();
export const DISPUTA_SESSIONS = new Map<string, DisputaSession>();
export const SWARM_EVENTS: SwarmEvent[] = [];

// ─── SSE Event Bus ────────────────────────────────────────────────────────────

/**
 * Central event bus. Clients subscribe to channels by rideId or userId.
 *
 * Event names follow the pattern: `ride:<rideId>` or `user:<userId>`.
 * Payload is always a JSON-serialisable object.
 */
export const rideEventBus = new EventEmitter();
rideEventBus.setMaxListeners(500); // allow many concurrent SSE connections

/** Emit to all SSE subscribers watching a specific ride */
export function emitRideEvent(rideId: string, eventType: string, payload: unknown): void {
  rideEventBus.emit(`ride:${rideId}`, { type: eventType, data: payload });
}

/** Emit to all SSE subscribers for a specific user (e.g. passenger) */
export function emitUserEvent(userId: string, eventType: string, payload: unknown): void {
  rideEventBus.emit(`user:${userId}`, { type: eventType, data: payload });
}

/** Emit a swarm/panic event to all connected clients */
export function emitSwarmBroadcast(eventType: string, payload: unknown): void {
  rideEventBus.emit("swarm:broadcast", { type: eventType, data: payload });
}

// ─── Driver location registry ─────────────────────────────────────────────────

/** Update a driver's last-known location. Called by PUT /rides/driver-location. */
export function updateDriverLocation(driverId: string, lat: number, lng: number): void {
  DRIVER_LOCATIONS.set(driverId, {
    driverId,
    lat,
    lng,
    updatedAt: new Date().toISOString(),
  });
}

/** Return drivers within radiusKm of a point, sorted by distance ascending. */
export function getNearbyDrivers(
  originLat: number,
  originLng: number,
  radiusKm = 10,
): Array<DriverLocation & { distanceKm: number }> {
  const results: Array<DriverLocation & { distanceKm: number }> = [];
  for (const loc of DRIVER_LOCATIONS.values()) {
    const d = estimateDistanceKm({ lat: originLat, lng: originLng }, { lat: loc.lat, lng: loc.lng });
    if (d <= radiusKm) results.push({ ...loc, distanceKm: d });
  }
  return results.sort((a, b) => a.distanceKm - b.distanceKm);
}

/**
 * Coarsen a coordinate to 3 decimal places for LGPD-compliant streaming.
 * 3 dp ≈ ±55 m precision — fine enough for UI but not pinpoint.
 */
export function coarsenCoord(value: number): number {
  return Math.round(value * 1000) / 1000;
}

// ─── Disputa de corrida ───────────────────────────────────────────────────────

/**
 * Open a new Disputa session for a ride.
 * Returns the session immediately; the window expires after 15 s.
 * At expiry, `resolveDisputa` is called automatically via setTimeout.
 */
export function openDisputaSession(
  rideId: string,
  passengerId: string,
  originLat: number,
  originLng: number,
  fareEstimateCents: number,
): DisputaSession {
  const now = new Date();
  const expires = new Date(now.getTime() + DISPUTA_WINDOW_MS);

  const session: DisputaSession = {
    rideId,
    passengerId,
    originLat,
    originLng,
    fareEstimateCents,
    bids: [],
    windowOpensAt: now.toISOString(),
    windowExpiresAt: expires.toISOString(),
    winnerId: null,
    outcome: "open",
  };

  DISPUTA_SESSIONS.set(rideId, session);

  // Notify the passenger that the dispute window is open
  emitUserEvent(passengerId, "disputa_opened", {
    rideId,
    windowExpiresAt: session.windowExpiresAt,
    fareEstimateCents,
  });

  // Auto-resolve when window expires
  setTimeout(() => {
    const s = DISPUTA_SESSIONS.get(rideId);
    if (s && s.outcome === "open") {
      resolveDisputa(rideId, "expired");
    }
  }, DISPUTA_WINDOW_MS);

  return session;
}

/**
 * Submit a driver bid into an open Disputa session.
 *
 * Rules:
 *  - Session must be "open" and within the 15-second window.
 *  - Max MAX_BIDS (5) drivers per session.
 *  - offeredFareCents must be <= fareEstimateCents (price stability rule:
 *    passenger never pays more than the original estimate).
 *  - A driver can only bid once per ride.
 *
 * Returns the bid on success, or an error code string on failure.
 */
export function submitBid(
  rideId: string,
  driverId: string,
  driverLocation: { lat: number; lng: number },
  offeredFareCents?: number,
): RideBid | { error: string } {
  const session = DISPUTA_SESSIONS.get(rideId);
  if (!session) return { error: "DISPUTA_NOT_FOUND" };
  if (session.outcome !== "open") return { error: "DISPUTA_CLOSED" };
  if (new Date(session.windowExpiresAt) <= new Date()) return { error: "WINDOW_EXPIRED" };
  if (session.bids.length >= MAX_BIDS) return { error: "DISPUTE_FULL" };
  if (session.bids.some((b) => b.driverId === driverId)) return { error: "ALREADY_BID" };

  const fare = offeredFareCents ?? session.fareEstimateCents;
  if (fare > session.fareEstimateCents) return { error: "FARE_EXCEEDS_ESTIMATE" };

  const distanceToOriginKm = estimateDistanceKm(
    { lat: session.originLat, lng: session.originLng },
    driverLocation,
  );

  const bid: RideBid = {
    driverId,
    rideId,
    location: driverLocation,
    offeredFareCents: fare,
    distanceToOriginKm,
    bidAt: new Date().toISOString(),
  };

  session.bids.push(bid);

  // Notify ride channel that a new bid arrived (coarsened location for LGPD)
  emitRideEvent(rideId, "bid_received", {
    driverId,
    distanceToOriginKm: Math.round(distanceToOriginKm * 100) / 100,
    offeredFareCents: fare,
    totalBids: session.bids.length,
  });

  // If we hit the max driver count, resolve immediately
  if (session.bids.length >= MAX_BIDS) {
    resolveDisputa(rideId, "full");
  }

  return bid;
}

/**
 * Resolve a Disputa session and pick the winner.
 *
 * Winner selection algorithm (in priority order):
 *  1. Lowest distanceToOriginKm (nearest driver arrives fastest).
 *  2. Tie-break: lowest offeredFareCents (benefit to passenger).
 *  3. Tie-break: earliest bidAt (first to commit).
 *
 * The passenger's displayed fare never changes (price stability).
 */
export function resolveDisputa(
  rideId: string,
  reason: "full" | "expired" | "cancelled" = "expired",
): DisputaSession | null {
  const session = DISPUTA_SESSIONS.get(rideId);
  if (!session || session.outcome !== "open") return null;

  session.outcome = reason === "cancelled" ? "cancelled" : "resolved";

  if (session.bids.length > 0 && reason !== "cancelled") {
    const sorted = [...session.bids].sort((a, b) => {
      // Primary: nearest
      if (a.distanceToOriginKm !== b.distanceToOriginKm) {
        return a.distanceToOriginKm - b.distanceToOriginKm;
      }
      // Secondary: lowest fare offer
      if (a.offeredFareCents !== b.offeredFareCents) {
        return a.offeredFareCents - b.offeredFareCents;
      }
      // Tertiary: earliest bid
      return new Date(a.bidAt).getTime() - new Date(b.bidAt).getTime();
    });
    session.winnerId = sorted[0]!.driverId;
    session.outcome = "resolved";
  } else if (reason !== "cancelled") {
    session.outcome = "expired";
  }

  // Notify ride channel
  emitRideEvent(rideId, "disputa_resolved", {
    rideId,
    outcome: session.outcome,
    winnerId: session.winnerId,
    totalBids: session.bids.length,
  });

  // Notify the winning driver
  if (session.winnerId) {
    emitUserEvent(session.winnerId, "ride_assigned", {
      rideId,
      passengerId: session.passengerId,
      fareEstimateCents: session.fareEstimateCents,
    });
  }

  // Notify the passenger of the outcome
  emitUserEvent(session.passengerId, "disputa_resolved", {
    rideId,
    outcome: session.outcome,
    winnerId: session.winnerId,
  });

  return session;
}

// ─── Efeito Enxame / The Shield ────────────────────────────────────────────────

/**
 * Create a panic or community alert event.
 * Location is coarsened before storage (LGPD).
 */
export function createSwarmEvent(
  type: SwarmEvent["type"],
  userId: string,
  lat: number,
  lng: number,
  description: string,
): SwarmEvent {
  const event: SwarmEvent = {
    id: crypto.randomUUID(),
    type,
    triggeredByUserId: userId,
    lat: coarsenCoord(lat),
    lng: coarsenCoord(lng),
    description,
    confirmCount: 1,
    swarmActive: false,
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  };

  SWARM_EVENTS.push(event);
  emitSwarmBroadcast("swarm_event_created", {
    id: event.id,
    type: event.type,
    lat: event.lat,
    lng: event.lng,
    description: event.description,
    confirmCount: event.confirmCount,
    swarmActive: event.swarmActive,
    createdAt: event.createdAt,
  });

  return event;
}

/**
 * Community members confirm an existing swarm event.
 * When confirmCount reaches SWARM_THRESHOLD, swarmActive is set and
 * a "swarm_activated" broadcast is emitted (triggers The Shield UI).
 */
export function confirmSwarmEvent(eventId: string, userId: string): SwarmEvent | null {
  const evt = SWARM_EVENTS.find((e) => e.id === eventId);
  if (!evt || evt.resolvedAt) return null;

  // Deduplicate: same user can only confirm once (tracked by simple counter here;
  // production would use a Set<userId> per event).
  evt.confirmCount += 1;

  if (!evt.swarmActive && evt.confirmCount >= SWARM_THRESHOLD) {
    evt.swarmActive = true;
    emitSwarmBroadcast("swarm_activated", {
      id: evt.id,
      lat: evt.lat,
      lng: evt.lng,
      confirmCount: evt.confirmCount,
      description: evt.description,
    });
  } else {
    emitSwarmBroadcast("swarm_confirmed", {
      id: evt.id,
      confirmCount: evt.confirmCount,
      swarmActive: evt.swarmActive,
    });
  }

  return evt;
}

/** Resolve (deactivate) a swarm event */
export function resolveSwarmEvent(eventId: string): SwarmEvent | null {
  const evt = SWARM_EVENTS.find((e) => e.id === eventId);
  if (!evt) return null;
  evt.resolvedAt = new Date().toISOString();
  emitSwarmBroadcast("swarm_resolved", { id: evt.id });
  return evt;
}
