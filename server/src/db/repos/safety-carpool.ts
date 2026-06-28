/**
 * Safety events and carpool routes repositories.
 */

import { randomUUID } from "node:crypto";
import db from "../database.js";
import type { SafetyEvent, CarpoolRoute } from "../../models/schemas.js";

// ─── Safety events ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toSafetyEvent(row: Record<string, any>): SafetyEvent {
  return {
    id: row["id"],
    reporterId: row["reporter_id"],
    rideId: row["ride_id"] ?? null,
    type: row["type"],
    location: { lat: row["location_lat"], lng: row["location_lng"] },
    description: row["description"],
    isResolved: Boolean(row["is_resolved"]),
    upvotes: row["upvotes"],
    createdAt: row["created_at"],
    resolvedAt: row["resolved_at"] ?? null,
  };
}

export function listSafetyEvents(includeResolved = false, limit = 50): SafetyEvent[] {
  const rows = includeResolved
    ? (db
        .prepare("SELECT * FROM safety_events ORDER BY created_at DESC LIMIT ?")
        .all(limit) as Record<string, unknown>[])
    : (db
        .prepare(
          "SELECT * FROM safety_events WHERE is_resolved = 0 ORDER BY created_at DESC LIMIT ?",
        )
        .all(limit) as Record<string, unknown>[]);
  return rows.map(toSafetyEvent);
}

export function findSafetyEventById(id: string): SafetyEvent | undefined {
  const row = db.prepare("SELECT * FROM safety_events WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? toSafetyEvent(row) : undefined;
}

export interface CreateSafetyEventInput {
  reporterId: string;
  rideId?: string | null;
  type: string;
  location: { lat: number; lng: number };
  description: string;
}

export function createSafetyEvent(input: CreateSafetyEventInput): SafetyEvent {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO safety_events (
      id, reporter_id, ride_id, type,
      location_lat, location_lng, description,
      is_resolved, upvotes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
  `).run(
    id,
    input.reporterId,
    input.rideId ?? null,
    input.type,
    input.location.lat,
    input.location.lng,
    input.description,
    now,
  );
  return findSafetyEventById(id)!;
}

export function upvoteSafetyEvent(id: string): SafetyEvent | undefined {
  db.prepare("UPDATE safety_events SET upvotes = upvotes + 1 WHERE id = ?").run(id);
  return findSafetyEventById(id);
}

export function resolveSafetyEvent(id: string): SafetyEvent | undefined {
  const now = new Date().toISOString();
  db.prepare(
    "UPDATE safety_events SET is_resolved = 1, resolved_at = ? WHERE id = ?",
  ).run(now, id);
  return findSafetyEventById(id);
}

// ─── Carpool routes ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toCarpoolRoute(row: Record<string, any>): CarpoolRoute {
  return {
    id: row["id"],
    driverId: row["driver_id"],
    name: row["name"],
    routeType: row["route_type"],
    stops: JSON.parse(row["stops_json"] ?? "[]"),
    maxPassengers: row["max_passengers"],
    currentPassengers: row["current_passengers"],
    farePerSeat: row["fare_per_seat"],
    departureTime: row["departure_time"] ?? null,
    scheduledAt: row["scheduled_at"] ?? null,
    isActive: Boolean(row["is_active"]),
    createdAt: row["created_at"],
  };
}

export function listCarpoolRoutes(activeOnly = true, limit = 50): CarpoolRoute[] {
  const rows = activeOnly
    ? (db
        .prepare(
          "SELECT * FROM carpool_routes WHERE is_active = 1 ORDER BY created_at DESC LIMIT ?",
        )
        .all(limit) as Record<string, unknown>[])
    : (db
        .prepare("SELECT * FROM carpool_routes ORDER BY created_at DESC LIMIT ?")
        .all(limit) as Record<string, unknown>[]);
  return rows.map(toCarpoolRoute);
}

export function findCarpoolRouteById(id: string): CarpoolRoute | undefined {
  const row = db.prepare("SELECT * FROM carpool_routes WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? toCarpoolRoute(row) : undefined;
}

export interface CreateCarpoolRouteInput {
  driverId: string;
  name: string;
  routeType: string;
  stops: Array<{ lat: number; lng: number; address: string; order: number }>;
  maxPassengers: number;
  farePerSeat: number;
  departureTime?: string | null;
  scheduledAt?: string | null;
}

export function createCarpoolRoute(input: CreateCarpoolRouteInput): CarpoolRoute {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO carpool_routes (
      id, driver_id, name, route_type, stops_json,
      max_passengers, current_passengers, fare_per_seat,
      departure_time, scheduled_at, is_active, created_at
    ) VALUES (
      @id, @driver_id, @name, @route_type, @stops_json,
      @max_passengers, 0, @fare_per_seat,
      @departure_time, @scheduled_at, 1, @created_at
    )
  `).run({
    id,
    driver_id: input.driverId,
    name: input.name,
    route_type: input.routeType,
    stops_json: JSON.stringify(input.stops),
    max_passengers: input.maxPassengers,
    fare_per_seat: input.farePerSeat,
    departure_time: input.departureTime ?? null,
    scheduled_at: input.scheduledAt ?? null,
    created_at: now,
  });
  return findCarpoolRouteById(id)!;
}

export function joinCarpoolRoute(routeId: string): CarpoolRoute | undefined {
  const route = findCarpoolRouteById(routeId);
  if (!route) return undefined;
  if (route.currentPassengers >= route.maxPassengers) return undefined; // full

  db.prepare(
    "UPDATE carpool_routes SET current_passengers = current_passengers + 1 WHERE id = ?",
  ).run(routeId);
  return findCarpoolRouteById(routeId);
}
