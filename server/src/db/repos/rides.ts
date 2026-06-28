/**
 * Rides repository — SQLite-backed CRUD + VIP window management.
 */

import { randomUUID } from "node:crypto";
import db from "../database.js";

// ─── Row mappers ──────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRide(row: Record<string, any>) {
  return {
    id: row["id"],
    passengerId: row["passenger_id"],
    driverId: row["driver_id"] ?? null,
    routeType: row["route_type"],
    status: row["status"],
    origin: {
      lat: row["origin_lat"],
      lng: row["origin_lng"],
      address: row["origin_address"],
    },
    destination: {
      lat: row["destination_lat"],
      lng: row["destination_lng"],
      address: row["destination_address"],
    },
    estimatedDistanceKm: row["estimated_distance_km"],
    estimatedDurationMin: row["estimated_duration_min"],
    fareEstimate: row["fare_estimate"],
    fareActual: row["fare_actual"] ?? null,
    couponCode: row["coupon_code"] ?? null,
    couponDiscountCents: row["coupon_discount_cents"],
    scheduledAt: row["scheduled_at"] ?? null,
    startedAt: row["started_at"] ?? null,
    completedAt: row["completed_at"] ?? null,
    cancelledAt: row["cancelled_at"] ?? null,
    cancellationReason: row["cancellation_reason"] ?? null,
    fareBreakdown: row["fare_breakdown_json"] ? JSON.parse(row["fare_breakdown_json"]) : null,
    createdAt: row["created_at"],
    updatedAt: row["updated_at"],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toVipWindow(row: Record<string, any>) {
  return {
    rideId: row["ride_id"],
    patronDriverId: row["patron_driver_id"],
    windowOpensAt: row["window_opens_at"],
    windowExpiresAt: row["window_expires_at"],
    outcome: row["outcome"],
  };
}

// ─── Ride CRUD ────────────────────────────────────────────────────────────────

export function findRideById(id: string) {
  const row = db.prepare("SELECT * FROM rides WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? toRide(row) : undefined;
}

export function listRidesByPassenger(passengerId: string, limit = 20, offset = 0) {
  const rows = db
    .prepare(
      "SELECT * FROM rides WHERE passenger_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
    )
    .all(passengerId, limit, offset) as Record<string, unknown>[];
  return rows.map(toRide);
}

export function listRidesByDriver(driverId: string, limit = 20, offset = 0) {
  const rows = db
    .prepare("SELECT * FROM rides WHERE driver_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?")
    .all(driverId, limit, offset) as Record<string, unknown>[];
  return rows.map(toRide);
}

export function countRidesByPassenger(passengerId: string): number {
  const r = db
    .prepare("SELECT COUNT(*) as cnt FROM rides WHERE passenger_id = ?")
    .get(passengerId) as { cnt: number };
  return r.cnt;
}

export function countRidesByDriver(driverId: string): number {
  const r = db
    .prepare("SELECT COUNT(*) as cnt FROM rides WHERE driver_id = ?")
    .get(driverId) as { cnt: number };
  return r.cnt;
}

export interface CreateRideInput {
  passengerId: string;
  routeType: string;
  origin: { lat: number; lng: number; address: string };
  destination: { lat: number; lng: number; address: string };
  estimatedDistanceKm: number;
  estimatedDurationMin: number;
  fareEstimate: number;
  couponCode?: string | null;
  couponDiscountCents?: number;
  scheduledAt?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fareBreakdown?: any;
}

export function createRide(input: CreateRideInput) {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO rides (
      id, passenger_id, route_type, status,
      origin_lat, origin_lng, origin_address,
      destination_lat, destination_lng, destination_address,
      estimated_distance_km, estimated_duration_min,
      fare_estimate, coupon_code, coupon_discount_cents,
      scheduled_at, fare_breakdown_json, created_at, updated_at
    ) VALUES (
      @id, @passenger_id, @route_type, 'searching',
      @origin_lat, @origin_lng, @origin_address,
      @destination_lat, @destination_lng, @destination_address,
      @estimated_distance_km, @estimated_duration_min,
      @fare_estimate, @coupon_code, @coupon_discount_cents,
      @scheduled_at, @fare_breakdown_json, @created_at, @updated_at
    )
  `).run({
    id,
    passenger_id: input.passengerId,
    route_type: input.routeType,
    origin_lat: input.origin.lat,
    origin_lng: input.origin.lng,
    origin_address: input.origin.address,
    destination_lat: input.destination.lat,
    destination_lng: input.destination.lng,
    destination_address: input.destination.address,
    estimated_distance_km: input.estimatedDistanceKm,
    estimated_duration_min: input.estimatedDurationMin,
    fare_estimate: input.fareEstimate,
    coupon_code: input.couponCode ?? null,
    coupon_discount_cents: input.couponDiscountCents ?? 0,
    scheduled_at: input.scheduledAt ?? null,
    fare_breakdown_json: input.fareBreakdown ? JSON.stringify(input.fareBreakdown) : null,
    created_at: now,
    updated_at: now,
  });
  return findRideById(id)!;
}

export interface UpdateRideStatusInput {
  status: string;
  driverId?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  fareActual?: number | null;
}

export function updateRideStatus(id: string, updates: UpdateRideStatusInput) {
  const now = new Date().toISOString();
  const existing = findRideById(id);
  if (!existing) return undefined;

  db.prepare(`
    UPDATE rides SET
      status = @status,
      driver_id = @driver_id,
      started_at = @started_at,
      completed_at = @completed_at,
      cancelled_at = @cancelled_at,
      cancellation_reason = @cancellation_reason,
      fare_actual = @fare_actual,
      updated_at = @updated_at
    WHERE id = @id
  `).run({
    id,
    status: updates.status,
    driver_id: updates.driverId !== undefined ? updates.driverId : existing.driverId,
    started_at: updates.startedAt !== undefined ? updates.startedAt : existing.startedAt,
    completed_at: updates.completedAt !== undefined ? updates.completedAt : existing.completedAt,
    cancelled_at: updates.cancelledAt !== undefined ? updates.cancelledAt : existing.cancelledAt,
    cancellation_reason:
      updates.cancellationReason !== undefined
        ? updates.cancellationReason
        : existing.cancellationReason,
    fare_actual: updates.fareActual !== undefined ? updates.fareActual : existing.fareActual,
    updated_at: now,
  });
  return findRideById(id)!;
}

// ─── VIP Windows ──────────────────────────────────────────────────────────────

export function findVipWindowByRide(rideId: string) {
  const row = db.prepare("SELECT * FROM vip_windows WHERE ride_id = ?").get(rideId) as
    | Record<string, unknown>
    | undefined;
  return row ? toVipWindow(row) : undefined;
}

export function createVipWindow(rideId: string, patronDriverId: string) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15_000).toISOString();
  db.prepare(`
    INSERT INTO vip_windows (ride_id, patron_driver_id, window_opens_at, window_expires_at, outcome)
    VALUES (?, ?, ?, ?, 'pending')
    ON CONFLICT(ride_id) DO UPDATE SET
      patron_driver_id = excluded.patron_driver_id,
      window_opens_at = excluded.window_opens_at,
      window_expires_at = excluded.window_expires_at,
      outcome = 'pending'
  `).run(rideId, patronDriverId, now.toISOString(), expiresAt);
  return findVipWindowByRide(rideId)!;
}

export function settleVipWindow(rideId: string, outcome: "accepted" | "expired") {
  db.prepare("UPDATE vip_windows SET outcome = ? WHERE ride_id = ?").run(outcome, rideId);
}

// ─── Patron links ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toPatronLink(row: Record<string, any>) {
  return {
    id: row["id"],
    passengerId: row["passenger_id"],
    driverId: row["driver_id"],
    label: row["label"],
    isActive: Boolean(row["is_active"]),
    createdAt: row["created_at"],
    updatedAt: row["updated_at"],
  };
}

export function findPatronLinkByPassenger(passengerId: string) {
  const row = db
    .prepare("SELECT * FROM patron_links WHERE passenger_id = ? AND is_active = 1")
    .get(passengerId) as Record<string, unknown> | undefined;
  return row ? toPatronLink(row) : undefined;
}

export function findPatronLinksByDriver(driverId: string) {
  const rows = db
    .prepare("SELECT * FROM patron_links WHERE driver_id = ? AND is_active = 1")
    .all(driverId) as Record<string, unknown>[];
  return rows.map(toPatronLink);
}

export function findPatronLinkById(id: string) {
  const row = db.prepare("SELECT * FROM patron_links WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? toPatronLink(row) : undefined;
}

export function createPatronLink(
  passengerId: string,
  driverId: string,
  label: string,
) {
  const now = new Date().toISOString();
  // Deactivate existing links for this passenger
  db.prepare(
    "UPDATE patron_links SET is_active = 0, updated_at = ? WHERE passenger_id = ? AND is_active = 1",
  ).run(now, passengerId);

  const id = randomUUID();
  db.prepare(`
    INSERT INTO patron_links (id, passenger_id, driver_id, label, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, ?, ?)
  `).run(id, passengerId, driverId, label, now, now);
  return findPatronLinkById(id)!;
}

export function updatePatronLink(id: string, label: string) {
  const now = new Date().toISOString();
  db.prepare("UPDATE patron_links SET label = ?, updated_at = ? WHERE id = ?").run(
    label,
    now,
    id,
  );
  return findPatronLinkById(id);
}

export function deactivatePatronLink(id: string) {
  const now = new Date().toISOString();
  db.prepare("UPDATE patron_links SET is_active = 0, updated_at = ? WHERE id = ?").run(now, id);
  return findPatronLinkById(id);
}
