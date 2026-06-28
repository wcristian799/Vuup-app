/**
 * Deliveries repository — motoboy delivery jobs.
 */

import { randomUUID } from "node:crypto";
import db from "../database.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDelivery(row: Record<string, any>) {
  return {
    id: row["id"],
    clientId: row["client_id"],
    motoboyId: row["motoboy_id"] ?? null,
    status: row["status"],
    pickup: {
      lat: row["pickup_lat"],
      lng: row["pickup_lng"],
      address: row["pickup_address"],
      contactName: row["pickup_contact_name"],
    },
    dropoff: {
      lat: row["dropoff_lat"],
      lng: row["dropoff_lng"],
      address: row["dropoff_address"],
      contactName: row["dropoff_contact_name"],
    },
    packageDescription: row["package_description"],
    estimatedDistanceKm: row["estimated_distance_km"],
    fareEstimate: row["fare_estimate"],
    fareActual: row["fare_actual"] ?? null,
    createdAt: row["created_at"],
    updatedAt: row["updated_at"],
  };
}

export function findDeliveryById(id: string) {
  const row = db.prepare("SELECT * FROM deliveries WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? toDelivery(row) : undefined;
}

export function listDeliveriesByClient(clientId: string, limit = 20, offset = 0) {
  const rows = db
    .prepare(
      "SELECT * FROM deliveries WHERE client_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
    )
    .all(clientId, limit, offset) as Record<string, unknown>[];
  return rows.map(toDelivery);
}

export function listDeliveriesByMotoboy(motoboyId: string, limit = 20, offset = 0) {
  const rows = db
    .prepare(
      "SELECT * FROM deliveries WHERE motoboy_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
    )
    .all(motoboyId, limit, offset) as Record<string, unknown>[];
  return rows.map(toDelivery);
}

export function listOpenDeliveries(limit = 20) {
  const rows = db
    .prepare(
      "SELECT * FROM deliveries WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?",
    )
    .all(limit) as Record<string, unknown>[];
  return rows.map(toDelivery);
}

export interface CreateDeliveryInput {
  clientId: string;
  pickup: { lat: number; lng: number; address: string; contactName: string };
  dropoff: { lat: number; lng: number; address: string; contactName: string };
  packageDescription: string;
  estimatedDistanceKm: number;
  fareEstimate: number;
}

export function createDelivery(input: CreateDeliveryInput) {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO deliveries (
      id, client_id, status,
      pickup_lat, pickup_lng, pickup_address, pickup_contact_name,
      dropoff_lat, dropoff_lng, dropoff_address, dropoff_contact_name,
      package_description, estimated_distance_km, fare_estimate,
      created_at, updated_at
    ) VALUES (
      @id, @client_id, 'pending',
      @pickup_lat, @pickup_lng, @pickup_address, @pickup_contact_name,
      @dropoff_lat, @dropoff_lng, @dropoff_address, @dropoff_contact_name,
      @package_description, @estimated_distance_km, @fare_estimate,
      @created_at, @updated_at
    )
  `).run({
    id,
    client_id: input.clientId,
    pickup_lat: input.pickup.lat,
    pickup_lng: input.pickup.lng,
    pickup_address: input.pickup.address,
    pickup_contact_name: input.pickup.contactName,
    dropoff_lat: input.dropoff.lat,
    dropoff_lng: input.dropoff.lng,
    dropoff_address: input.dropoff.address,
    dropoff_contact_name: input.dropoff.contactName,
    package_description: input.packageDescription,
    estimated_distance_km: input.estimatedDistanceKm,
    fare_estimate: input.fareEstimate,
    created_at: now,
    updated_at: now,
  });
  return findDeliveryById(id)!;
}

export type DeliveryStatus =
  | "pending"
  | "accepted"
  | "picked_up"
  | "in_transit"
  | "delivered"
  | "failed";

export function updateDeliveryStatus(
  id: string,
  status: DeliveryStatus,
  motoboyId?: string,
  fareActual?: number,
) {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE deliveries
    SET status = @status,
        motoboy_id = COALESCE(@motoboy_id, motoboy_id),
        fare_actual = COALESCE(@fare_actual, fare_actual),
        updated_at = @updated_at
    WHERE id = @id
  `).run({
    id,
    status,
    motoboy_id: motoboyId ?? null,
    fare_actual: fareActual ?? null,
    updated_at: now,
  });
  return findDeliveryById(id);
}
