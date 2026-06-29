/**
 * Smoke tests for the VUUP API server (SQLite-backed)
 *
 * DB_PATH=:memory: is set in vitest.config.ts — each test worker gets
 * a fresh in-memory database. The beforeAll block seeds it so tests
 * have representative data.
 */

import { describe, it, expect, beforeAll } from "vitest";
import app from "../index.js";
import db from "../db/database.js";

// ─── Test seed (mirrors src/db/seed.ts but inline for isolation) ──────────────

beforeAll(() => {
  const NOW = new Date().toISOString();
  const YESTERDAY = new Date(Date.now() - 86_400_000).toISOString();
  const NEXT_MONTH = new Date(Date.now() + 30 * 86_400_000).toISOString();

  // Users
  const users = [
    [
      "00000000-0000-0000-0000-000000000001",
      "Ana Costa",
      "ana@vuup.app",
      "+5511999990001",
      "passenger",
      4.8,
      42,
    ],
    [
      "00000000-0000-0000-0000-000000000002",
      "Carlos Moto",
      "carlos@vuup.app",
      "+5511999990002",
      "driver",
      4.9,
      327,
    ],
    [
      "00000000-0000-0000-0000-000000000003",
      "Roberto Fund.",
      "roberto@vuup.app",
      "+5511999990003",
      "founder",
      null,
      0,
    ],
  ];
  const insUser = db.prepare(`
    INSERT OR IGNORE INTO users (id, full_name, email, phone, role, status, rating, total_rides, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
  `);
  for (const [id, name, email, phone, role, rating, rides] of users) {
    insUser.run(id, name, email, phone, role, rating, rides, YESTERDAY, NOW);
  }

  // Wallets
  const wallets = [
    ["20000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000001", 8750, 0, 0],
    [
      "20000000-0000-0000-0000-000000000002",
      "00000000-0000-0000-0000-000000000002",
      124300,
      2900,
      528000,
    ],
    [
      "20000000-0000-0000-0000-000000000003",
      "00000000-0000-0000-0000-000000000003",
      312000,
      0,
      1200000,
    ],
  ];
  const insWallet = db.prepare(`
    INSERT OR IGNORE INTO wallets (id, user_id, balance_cents, pending_cents, lifetime_earnings_cents, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const [id, uid, bal, pend, lifetime] of wallets) {
    insWallet.run(id, uid, bal, pend, lifetime, NOW);
  }

  // Carpool route
  db.prepare(
    `
    INSERT OR IGNORE INTO carpool_routes
      (id, driver_id, name, route_type, stops_json, max_passengers, current_passengers, fare_per_seat, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `,
  ).run(
    "40000000-0000-0000-0000-000000000001",
    "00000000-0000-0000-0000-000000000002",
    "Paulista → Santa Cecília",
    "fixa",
    JSON.stringify([{ lat: -23.5642, lng: -46.6522, address: "Paulista", order: 0 }]),
    3,
    1,
    700,
    YESTERDAY,
  );

  // Safety event
  db.prepare(
    `
    INSERT OR IGNORE INTO safety_events
      (id, reporter_id, type, location_lat, location_lng, description, is_resolved, upvotes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, 7, ?)
  `,
  ).run(
    "50000000-0000-0000-0000-000000000001",
    "00000000-0000-0000-0000-000000000002",
    "police_checkpoint",
    -23.549,
    -46.6388,
    "Blitz policial",
    NOW,
  );

  // Coupon
  db.prepare(
    `
    INSERT OR IGNORE INTO coupons
      (id, code, discount_type, discount_value, max_usages, usages_count, min_fare_cents, valid_from, valid_until, is_active)
    VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, 1)
  `,
  ).run(
    "70000000-0000-0000-0000-000000000001",
    "VUUP10",
    "percent",
    10,
    1000,
    500,
    YESTERDAY,
    NEXT_MONTH,
  );
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(res: Response): Promise<any> {
  return res.json();
}

async function getToken(phone = "+5511999990002"): Promise<string> {
  const res = await app.request("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  const body = await json(res);
  return body.accessToken as string;
}

// ─── /health ─────────────────────────────────────────────────────────────────

describe("GET /health", () => {
  it("returns 200 with status ok and persistent mode", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.status).toBe("ok");
    expect(body.mode).toBe("persistent");
  });
});

// ─── /auth ───────────────────────────────────────────────────────────────────

describe("POST /auth/register", () => {
  it("issues JWT for a phone (no OTP)", async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "+5511999990001", fullName: "Ana" }),
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
    expect(body.user.role).toBe("passenger");
  });

  it("rejects missing phone", async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: "Sem telefone" }),
    });
    expect(res.status).toBe(400);
  });

  it("auto-creates new user on first register (phone-only)", async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "+5599888887777" }),
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.user.role).toBe("passenger");
  });

  it("re-registering an existing phone logs into the same account (no profile overwrite)", async () => {
    const phone = "+5511955554444";
    const first = await json(
      await app.request("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, fullName: "Dono Original" }),
      }),
    );
    const second = await json(
      await app.request("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, fullName: "Tentativa Takeover" }),
      }),
    );
    expect(second.user.id).toBe(first.user.id);
    expect(second.user.fullName).toBe("Dono Original");
  });
});

describe("POST /auth/refresh", () => {
  it("refreshes access token using refresh token", async () => {
    const loginRes = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "+5511999990001" }),
    });
    const { refreshToken } = await json(loginRes);

    const res = await app.request("/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.accessToken).toBeTruthy();
  });
});

// ─── Protected routes need auth ───────────────────────────────────────────────

describe("Protected routes — 401 without token", () => {
  for (const path of [
    "/users/me",
    "/wallet",
    "/rides",
    "/safety/events",
    "/carpool/routes",
    "/deliveries",
  ]) {
    it(`GET ${path} returns 401`, async () => {
      const res = await app.request(path);
      expect(res.status).toBe(401);
    });
  }
});

// ─── Authenticated flows ──────────────────────────────────────────────────────

describe("Authenticated flows", () => {
  it("GET /users/me returns user profile", async () => {
    const token = await getToken();
    const res = await app.request("/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.id).toBeTruthy();
    expect(body.role).toBe("driver");
  });

  it("PATCH /users/me updates name", async () => {
    const token = await getToken("+5511999990001");
    const res = await app.request("/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fullName: "Ana Silva" }),
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.fullName).toBe("Ana Silva");
  });

  it("POST /rides creates a ride and persists it", async () => {
    const token = await getToken("+5511999990001");
    const res = await app.request("/rides", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        routeType: "livre",
        origin: { lat: -23.5505, lng: -46.6333, address: "Paulista" },
        destination: { lat: -23.5489, lng: -46.6388, address: "Augusta" },
      }),
    });
    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.ride.status).toBe("searching");
    expect(body.ride.fareEstimate).toBeGreaterThan(0);
    expect(body.ride.id).toBeTruthy();

    // Verify persisted — GET the ride back
    const get = await app.request(`/rides/${body.ride.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(get.status).toBe(200);
    const getRide = await json(get);
    expect(getRide.ride.id).toBe(body.ride.id);
  });

  it("POST /rides with coupon applies discount", async () => {
    const token = await getToken("+5511999990001");
    const res = await app.request("/rides", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        routeType: "livre",
        origin: { lat: -23.5505, lng: -46.6333, address: "Paulista" },
        destination: { lat: -23.5489, lng: -46.6388, address: "Augusta" },
        couponCode: "VUUP10",
      }),
    });
    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.fareBreakdown.couponDiscountCents).toBeGreaterThan(0);
  });

  it("GET /wallet returns balance", async () => {
    const token = await getToken("+5511999990002");
    const res = await app.request("/wallet", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(typeof body.balanceCents).toBe("number");
  });

  it("GET /wallet/transactions returns paginated list", async () => {
    const token = await getToken("+5511999990002");
    const res = await app.request("/wallet/transactions", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination).toBeDefined();
  });

  it("GET /safety/events returns feed", async () => {
    const token = await getToken();
    const res = await app.request("/safety/events", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  it("POST /safety/events creates and persists an event", async () => {
    const token = await getToken();
    const res = await app.request("/safety/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        type: "road_hazard",
        location: { lat: -23.55, lng: -46.63 },
        description: "Buraco na pista",
      }),
    });
    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.id).toBeTruthy();
    expect(body.upvotes).toBe(0);
  });

  it("GET /carpool/routes returns seeded route", async () => {
    const token = await getToken();
    const res = await app.request("/carpool/routes", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  it("POST /deliveries creates a delivery", async () => {
    const token = await getToken("+5511999990001");
    const res = await app.request("/deliveries", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        pickup: { lat: -23.55, lng: -46.63, address: "Rua A, 100", contactName: "João" },
        dropoff: { lat: -23.56, lng: -46.64, address: "Rua B, 200", contactName: "Maria" },
        packageDescription: "Caixa pequena",
      }),
    });
    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.delivery.status).toBe("pending");
    expect(body.delivery.fareEstimate).toBeGreaterThan(0);
  });

  it("POST /coupons/validate returns valid for VUUP10", async () => {
    const token = await getToken();
    const res = await app.request("/coupons/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code: "VUUP10" }),
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.valid).toBe(true);
    expect(body.coupon.discountType).toBe("percent");
  });
});

// ─── Authz by user type ───────────────────────────────────────────────────────

describe("Authorization by user type", () => {
  it("driver cannot create a ride (403)", async () => {
    const token = await getToken("+5511999990002"); // driver
    const res = await app.request("/rides", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        routeType: "livre",
        origin: { lat: -23.55, lng: -46.63, address: "A" },
        destination: { lat: -23.56, lng: -46.64, address: "B" },
      }),
    });
    expect(res.status).toBe(403);
  });

  it("passenger cannot set patron driver to non-driver (400)", async () => {
    const token = await getToken("+5511999990001"); // passenger
    const res = await app.request("/patron", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        // Roberto is a founder, not a driver
        driverId: "00000000-0000-0000-0000-000000000003",
        label: "Test",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("passenger cannot create a carpool route (403)", async () => {
    const token = await getToken("+5511999990001"); // passenger
    const res = await app.request("/carpool/routes", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: "Test route",
        routeType: "fixa",
        stops: [{ lat: -23.55, lng: -46.63, address: "A", order: 0 }],
        maxPassengers: 2,
        farePerSeat: 500,
      }),
    });
    expect(res.status).toBe(403);
  });
});
