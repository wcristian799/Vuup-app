#!/usr/bin/env node
/**
 * VUUP database seed script.
 *
 * Run once to populate the DB with representative data for development.
 * Safe to re-run — skips rows that already exist (INSERT OR IGNORE).
 *
 * Usage:
 *   node --import tsx/esm src/db/seed.ts
 *   # or via npm script: npm run seed
 */

import "../db/database.js"; // initialise schema
import db from "../db/database.js";

const NOW = new Date().toISOString();
const YESTERDAY = new Date(Date.now() - 86_400_000).toISOString();
const NEXT_MONTH = new Date(Date.now() + 30 * 86_400_000).toISOString();
const NEXT_3M = new Date(Date.now() + 90 * 86_400_000).toISOString();

// ─── Users ────────────────────────────────────────────────────────────────────

const USERS = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    full_name: "Ana Costa",
    email: "ana@vuup.app",
    phone: "+5511999990001",
    role: "passenger",
    status: "active",
    avatar_url: null,
    document_number: "12345678901",
    rating: 4.8,
    total_rides: 42,
    created_at: YESTERDAY,
    updated_at: NOW,
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    full_name: "Carlos Moto",
    email: "carlos@vuup.app",
    phone: "+5511999990002",
    role: "driver",
    status: "active",
    avatar_url: null,
    document_number: "98765432100",
    rating: 4.9,
    total_rides: 327,
    created_at: YESTERDAY,
    updated_at: NOW,
  },
  {
    id: "00000000-0000-0000-0000-000000000003",
    full_name: "Roberto Fundador",
    email: "roberto@vuup.app",
    phone: "+5511999990003",
    role: "founder",
    status: "active",
    avatar_url: null,
    document_number: "11122233344",
    rating: null,
    total_rides: 0,
    created_at: YESTERDAY,
    updated_at: NOW,
  },
  {
    id: "00000000-0000-0000-0000-000000000004",
    full_name: "Mário Entregador",
    email: "mario@vuup.app",
    phone: "+5511999990004",
    role: "motoboy",
    status: "active",
    avatar_url: null,
    document_number: "55566677788",
    rating: 4.7,
    total_rides: 189,
    created_at: YESTERDAY,
    updated_at: NOW,
  },
  {
    id: "00000000-0000-0000-0000-000000000005",
    full_name: "Admin VUUP",
    email: "admin@vuup.app",
    phone: "+5511999990005",
    role: "admin",
    status: "active",
    avatar_url: null,
    document_number: null,
    rating: null,
    total_rides: 0,
    created_at: YESTERDAY,
    updated_at: NOW,
  },
];

const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users
    (id, full_name, email, phone, role, status, avatar_url, document_number, rating, total_rides, created_at, updated_at)
  VALUES
    (@id, @full_name, @email, @phone, @role, @status, @avatar_url, @document_number, @rating, @total_rides, @created_at, @updated_at)
`);

for (const u of USERS) insertUser.run(u);
console.log(`Seeded ${USERS.length} users`);

// ─── Wallets ──────────────────────────────────────────────────────────────────

const WALLETS = [
  {
    id: "20000000-0000-0000-0000-000000000001",
    user_id: "00000000-0000-0000-0000-000000000001",
    balance_cents: 8750,
    pending_cents: 0,
    lifetime_earnings_cents: 0,
    updated_at: NOW,
  },
  {
    id: "20000000-0000-0000-0000-000000000002",
    user_id: "00000000-0000-0000-0000-000000000002",
    balance_cents: 124300,
    pending_cents: 2900,
    lifetime_earnings_cents: 528000,
    updated_at: NOW,
  },
  {
    id: "20000000-0000-0000-0000-000000000003",
    user_id: "00000000-0000-0000-0000-000000000003",
    balance_cents: 312000,
    pending_cents: 0,
    lifetime_earnings_cents: 1_200_000,
    updated_at: NOW,
  },
  {
    id: "20000000-0000-0000-0000-000000000004",
    user_id: "00000000-0000-0000-0000-000000000004",
    balance_cents: 45200,
    pending_cents: 1500,
    lifetime_earnings_cents: 98700,
    updated_at: NOW,
  },
  {
    id: "20000000-0000-0000-0000-000000000005",
    user_id: "00000000-0000-0000-0000-000000000005",
    balance_cents: 0,
    pending_cents: 0,
    lifetime_earnings_cents: 0,
    updated_at: NOW,
  },
];

const insertWallet = db.prepare(`
  INSERT OR IGNORE INTO wallets
    (id, user_id, balance_cents, pending_cents, lifetime_earnings_cents, updated_at)
  VALUES
    (@id, @user_id, @balance_cents, @pending_cents, @lifetime_earnings_cents, @updated_at)
`);

for (const w of WALLETS) insertWallet.run(w);
console.log(`Seeded ${WALLETS.length} wallets`);

// ─── Transactions ─────────────────────────────────────────────────────────────

const TRANSACTIONS = [
  {
    id: "30000000-0000-0000-0000-000000000001",
    wallet_id: "20000000-0000-0000-0000-000000000002",
    type: "ride_earning",
    amount_cents: 1305,
    balance_after_cents: 124300,
    reference_id: "10000000-0000-0000-0000-000000000001",
    description: "Corrida #10000000-01 — tarifa R$14,50",
    created_at: YESTERDAY,
  },
  {
    id: "30000000-0000-0000-0000-000000000002",
    wallet_id: "20000000-0000-0000-0000-000000000003",
    type: "passive_income",
    amount_cents: 8400,
    balance_after_cents: 312000,
    reference_id: null,
    description: "Dividendo fundador — Zona Pinheiros Junho/2026",
    created_at: NOW,
  },
];

const insertTx = db.prepare(`
  INSERT OR IGNORE INTO transactions
    (id, wallet_id, type, amount_cents, balance_after_cents, reference_id, description, created_at)
  VALUES
    (@id, @wallet_id, @type, @amount_cents, @balance_after_cents, @reference_id, @description, @created_at)
`);

for (const t of TRANSACTIONS) insertTx.run(t);
console.log(`Seeded ${TRANSACTIONS.length} transactions`);

// ─── Rides ────────────────────────────────────────────────────────────────────

const RIDES = [
  {
    id: "10000000-0000-0000-0000-000000000001",
    passenger_id: "00000000-0000-0000-0000-000000000001",
    driver_id: "00000000-0000-0000-0000-000000000002",
    route_type: "livre",
    status: "completed",
    origin_lat: -23.5505,
    origin_lng: -46.6333,
    origin_address: "Av. Paulista, 1000 — SP",
    destination_lat: -23.5489,
    destination_lng: -46.6388,
    destination_address: "Rua Augusta, 500 — SP",
    estimated_distance_km: 2.3,
    estimated_duration_min: 8,
    fare_estimate: 1450,
    fare_actual: 1450,
    coupon_code: null,
    coupon_discount_cents: 0,
    scheduled_at: null,
    started_at: YESTERDAY,
    completed_at: YESTERDAY,
    cancelled_at: null,
    cancellation_reason: null,
    fare_breakdown_json: null,
    created_at: YESTERDAY,
    updated_at: NOW,
  },
];

const insertRide = db.prepare(`
  INSERT OR IGNORE INTO rides
    (id, passenger_id, driver_id, route_type, status,
     origin_lat, origin_lng, origin_address,
     destination_lat, destination_lng, destination_address,
     estimated_distance_km, estimated_duration_min,
     fare_estimate, fare_actual, coupon_code, coupon_discount_cents,
     scheduled_at, started_at, completed_at, cancelled_at, cancellation_reason,
     fare_breakdown_json, created_at, updated_at)
  VALUES
    (@id, @passenger_id, @driver_id, @route_type, @status,
     @origin_lat, @origin_lng, @origin_address,
     @destination_lat, @destination_lng, @destination_address,
     @estimated_distance_km, @estimated_duration_min,
     @fare_estimate, @fare_actual, @coupon_code, @coupon_discount_cents,
     @scheduled_at, @started_at, @completed_at, @cancelled_at, @cancellation_reason,
     @fare_breakdown_json, @created_at, @updated_at)
`);

for (const r of RIDES) insertRide.run(r);
console.log(`Seeded ${RIDES.length} rides`);

// ─── Patron links ─────────────────────────────────────────────────────────────

db.prepare(`
  INSERT OR IGNORE INTO patron_links (id, passenger_id, driver_id, label, is_active, created_at, updated_at)
  VALUES (?, ?, ?, ?, 1, ?, ?)
`).run(
  "60000000-0000-0000-0000-000000000001",
  "00000000-0000-0000-0000-000000000001",
  "00000000-0000-0000-0000-000000000002",
  "Carlos — Motorista Fixo",
  YESTERDAY,
  NOW,
);
console.log("Seeded 1 patron link");

// ─── Safety events ────────────────────────────────────────────────────────────

const SAFETY = [
  {
    id: "50000000-0000-0000-0000-000000000001",
    reporter_id: "00000000-0000-0000-0000-000000000002",
    ride_id: null,
    type: "police_checkpoint",
    location_lat: -23.549,
    location_lng: -46.6388,
    description: "Blitz policial na Rua Augusta com Paulista",
    is_resolved: 0,
    upvotes: 7,
    created_at: NOW,
    resolved_at: null,
  },
  {
    id: "50000000-0000-0000-0000-000000000002",
    reporter_id: "00000000-0000-0000-0000-000000000001",
    ride_id: null,
    type: "road_hazard",
    location_lat: -23.5612,
    location_lng: -46.6565,
    description: "Buraco grande na pista sentido centro",
    is_resolved: 1,
    upvotes: 12,
    created_at: YESTERDAY,
    resolved_at: NOW,
  },
];

const insertSafety = db.prepare(`
  INSERT OR IGNORE INTO safety_events
    (id, reporter_id, ride_id, type, location_lat, location_lng, description, is_resolved, upvotes, created_at, resolved_at)
  VALUES
    (@id, @reporter_id, @ride_id, @type, @location_lat, @location_lng, @description, @is_resolved, @upvotes, @created_at, @resolved_at)
`);

for (const s of SAFETY) insertSafety.run(s);
console.log(`Seeded ${SAFETY.length} safety events`);

// ─── Carpool routes ───────────────────────────────────────────────────────────

db.prepare(`
  INSERT OR IGNORE INTO carpool_routes
    (id, driver_id, name, route_type, stops_json, max_passengers, current_passengers, fare_per_seat, departure_time, scheduled_at, is_active, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
`).run(
  "40000000-0000-0000-0000-000000000001",
  "00000000-0000-0000-0000-000000000002",
  "Paulista → Consolação → Santa Cecília",
  "fixa",
  JSON.stringify([
    { lat: -23.5642, lng: -46.6522, address: "Paulista MASP", order: 0 },
    { lat: -23.5535, lng: -46.6621, address: "Consolação", order: 1 },
    { lat: -23.538, lng: -46.6523, address: "Santa Cecília", order: 2 },
  ]),
  3,
  1,
  700,
  "07:30",
  null,
  YESTERDAY,
);
console.log("Seeded 1 carpool route");

// ─── Coupons ──────────────────────────────────────────────────────────────────

const COUPONS = [
  {
    id: "70000000-0000-0000-0000-000000000001",
    code: "VUUP10",
    campaign_id: null,
    discount_type: "percent",
    discount_value: 10,
    max_usages: 1000,
    usages_count: 0,
    min_fare_cents: 500,
    valid_from: YESTERDAY,
    valid_until: NEXT_MONTH,
    is_active: 1,
  },
  {
    id: "70000000-0000-0000-0000-000000000002",
    code: "PRIMEIRAVIAGEM",
    campaign_id: null,
    discount_type: "fixed",
    discount_value: 500,
    max_usages: null,
    usages_count: 0,
    min_fare_cents: 800,
    valid_from: YESTERDAY,
    valid_until: NEXT_3M,
    is_active: 1,
  },
];

const insertCoupon = db.prepare(`
  INSERT OR IGNORE INTO coupons
    (id, code, campaign_id, discount_type, discount_value, max_usages, usages_count, min_fare_cents, valid_from, valid_until, is_active)
  VALUES
    (@id, @code, @campaign_id, @discount_type, @discount_value, @max_usages, @usages_count, @min_fare_cents, @valid_from, @valid_until, @is_active)
`);

for (const c of COUPONS) insertCoupon.run(c);
console.log(`Seeded ${COUPONS.length} coupons`);

console.log("\n✓ Seed complete");
