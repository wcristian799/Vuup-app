/**
 * SQLite database setup using better-sqlite3.
 *
 * - DB file path: resolved from DB_PATH env var, defaults to ./data/vuup.db
 * - In-memory mode for tests: set DB_PATH=:memory:
 * - Schema migrations run at startup (idempotent via IF NOT EXISTS / CREATE INDEX IF NOT EXISTS)
 * - WAL mode + foreign keys enabled for every connection
 */

import Database, { type Database as DatabaseType } from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DB_PATH = process.env["DB_PATH"] ?? resolve(process.cwd(), "data", "vuup.db");

// Ensure data directory exists (skip for :memory:)
if (DB_PATH !== ":memory:") {
  mkdirSync(dirname(DB_PATH), { recursive: true });
}

export const db: DatabaseType = new Database(DB_PATH);

// Performance & integrity
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("synchronous = NORMAL");

// ─── Schema ───────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id              TEXT PRIMARY KEY,
    full_name       TEXT NOT NULL,
    email           TEXT NOT NULL UNIQUE,
    phone           TEXT NOT NULL UNIQUE,
    role            TEXT NOT NULL CHECK(role IN ('passenger','driver','motoboy','founder','admin')),
    status          TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','pending_verification')),
    avatar_url      TEXT,
    document_number TEXT,
    rating          REAL,
    total_rides     INTEGER NOT NULL DEFAULT 0,
    password_hash   TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
  );

  -- otp_codes table removed (VUU-82: OTP auth dropped). Registration is
  -- phone-first at ride time; no per-phone codes are stored.

  CREATE TABLE IF NOT EXISTS refresh_tokens (
    token      TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    revoked    INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);

  CREATE TABLE IF NOT EXISTS wallets (
    id                      TEXT PRIMARY KEY,
    user_id                 TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    balance_cents           INTEGER NOT NULL DEFAULT 0,
    pending_cents           INTEGER NOT NULL DEFAULT 0,
    lifetime_earnings_cents INTEGER NOT NULL DEFAULT 0,
    updated_at              TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id                  TEXT PRIMARY KEY,
    wallet_id           TEXT NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    type                TEXT NOT NULL,
    amount_cents        INTEGER NOT NULL,
    balance_after_cents INTEGER NOT NULL,
    reference_id        TEXT,
    description         TEXT NOT NULL,
    created_at          TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_tx_wallet ON transactions(wallet_id);

  CREATE TABLE IF NOT EXISTS rides (
    id                       TEXT PRIMARY KEY,
    passenger_id             TEXT NOT NULL REFERENCES users(id),
    driver_id                TEXT REFERENCES users(id),
    route_type               TEXT NOT NULL CHECK(route_type IN ('livre','fixa','programada')),
    status                   TEXT NOT NULL DEFAULT 'searching'
                               CHECK(status IN ('searching','accepted','driver_en_route','in_progress','completed','cancelled')),
    origin_lat               REAL NOT NULL,
    origin_lng               REAL NOT NULL,
    origin_address           TEXT NOT NULL,
    destination_lat          REAL NOT NULL,
    destination_lng          REAL NOT NULL,
    destination_address      TEXT NOT NULL,
    estimated_distance_km    REAL NOT NULL,
    estimated_duration_min   INTEGER NOT NULL,
    fare_estimate            INTEGER NOT NULL,
    fare_actual              INTEGER,
    coupon_code              TEXT,
    coupon_discount_cents    INTEGER NOT NULL DEFAULT 0,
    scheduled_at             TEXT,
    started_at               TEXT,
    completed_at             TEXT,
    cancelled_at             TEXT,
    cancellation_reason      TEXT,
    fare_breakdown_json      TEXT,
    created_at               TEXT NOT NULL,
    updated_at               TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_rides_passenger ON rides(passenger_id);
  CREATE INDEX IF NOT EXISTS idx_rides_driver    ON rides(driver_id);
  CREATE INDEX IF NOT EXISTS idx_rides_status    ON rides(status);

  CREATE TABLE IF NOT EXISTS vip_windows (
    ride_id            TEXT PRIMARY KEY REFERENCES rides(id) ON DELETE CASCADE,
    patron_driver_id   TEXT NOT NULL REFERENCES users(id),
    window_opens_at    TEXT NOT NULL,
    window_expires_at  TEXT NOT NULL,
    outcome            TEXT NOT NULL DEFAULT 'pending' CHECK(outcome IN ('pending','accepted','expired'))
  );

  CREATE TABLE IF NOT EXISTS patron_links (
    id           TEXT PRIMARY KEY,
    passenger_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    driver_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label        TEXT NOT NULL DEFAULT 'Meu Motorista',
    is_active    INTEGER NOT NULL DEFAULT 1,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_patron_passenger ON patron_links(passenger_id, is_active);
  CREATE INDEX IF NOT EXISTS idx_patron_driver    ON patron_links(driver_id,    is_active);

  CREATE TABLE IF NOT EXISTS deliveries (
    id                     TEXT PRIMARY KEY,
    client_id              TEXT NOT NULL REFERENCES users(id),
    motoboy_id             TEXT REFERENCES users(id),
    status                 TEXT NOT NULL DEFAULT 'pending'
                             CHECK(status IN ('pending','accepted','picked_up','in_transit','delivered','failed')),
    pickup_lat             REAL NOT NULL,
    pickup_lng             REAL NOT NULL,
    pickup_address         TEXT NOT NULL,
    pickup_contact_name    TEXT NOT NULL,
    dropoff_lat            REAL NOT NULL,
    dropoff_lng            REAL NOT NULL,
    dropoff_address        TEXT NOT NULL,
    dropoff_contact_name   TEXT NOT NULL,
    package_description    TEXT NOT NULL,
    estimated_distance_km  REAL NOT NULL,
    fare_estimate          INTEGER NOT NULL,
    fare_actual            INTEGER,
    created_at             TEXT NOT NULL,
    updated_at             TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_delivery_client  ON deliveries(client_id);
  CREATE INDEX IF NOT EXISTS idx_delivery_motoboy ON deliveries(motoboy_id);

  CREATE TABLE IF NOT EXISTS campaigns (
    id              TEXT PRIMARY KEY,
    client_id       TEXT NOT NULL REFERENCES users(id),
    name            TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'draft'
                      CHECK(status IN ('draft','active','paused','completed','cancelled')),
    target_audience TEXT NOT NULL,   -- JSON array of roles
    budget_cents    INTEGER NOT NULL,
    spent_cents     INTEGER NOT NULL DEFAULT 0,
    impressions     INTEGER NOT NULL DEFAULT 0,
    clicks          INTEGER NOT NULL DEFAULT 0,
    coupon_ids      TEXT NOT NULL DEFAULT '[]', -- JSON array
    starts_at       TEXT NOT NULL,
    ends_at         TEXT NOT NULL,
    created_at      TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_campaign_client ON campaigns(client_id);

  CREATE TABLE IF NOT EXISTS coupons (
    id             TEXT PRIMARY KEY,
    code           TEXT NOT NULL UNIQUE,
    campaign_id    TEXT REFERENCES campaigns(id),
    discount_type  TEXT NOT NULL CHECK(discount_type IN ('fixed','percent')),
    discount_value REAL NOT NULL,
    max_usages     INTEGER,
    usages_count   INTEGER NOT NULL DEFAULT 0,
    min_fare_cents INTEGER NOT NULL DEFAULT 0,
    valid_from     TEXT NOT NULL,
    valid_until    TEXT NOT NULL,
    is_active      INTEGER NOT NULL DEFAULT 1
  );

  CREATE INDEX IF NOT EXISTS idx_coupon_code ON coupons(code);

  CREATE TABLE IF NOT EXISTS safety_events (
    id           TEXT PRIMARY KEY,
    reporter_id  TEXT NOT NULL REFERENCES users(id),
    ride_id      TEXT REFERENCES rides(id),
    type         TEXT NOT NULL,
    location_lat REAL NOT NULL,
    location_lng REAL NOT NULL,
    description  TEXT NOT NULL,
    is_resolved  INTEGER NOT NULL DEFAULT 0,
    upvotes      INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL,
    resolved_at  TEXT
  );

  CREATE TABLE IF NOT EXISTS carpool_routes (
    id                TEXT PRIMARY KEY,
    driver_id         TEXT NOT NULL REFERENCES users(id),
    name              TEXT NOT NULL,
    route_type        TEXT NOT NULL CHECK(route_type IN ('livre','fixa','programada')),
    stops_json        TEXT NOT NULL,  -- JSON array
    max_passengers    INTEGER NOT NULL DEFAULT 4,
    current_passengers INTEGER NOT NULL DEFAULT 0,
    fare_per_seat     INTEGER NOT NULL,
    departure_time    TEXT,
    scheduled_at      TEXT,
    is_active         INTEGER NOT NULL DEFAULT 1,
    created_at        TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_carpool_driver ON carpool_routes(driver_id);
`);

export default db;
