/**
 * VUU-26 — Entregas e Comércio: Delivery integration tests
 *
 * Covers:
 *  1. POST /deliveries — create delivery order (client)
 *  2. GET  /deliveries/available — pending orders visible to motoboys
 *  3. PATCH /deliveries/:id/accept — motoboy accepts a pending delivery
 *  4. Delivery state machine:
 *     - accepted → picked_up → in_transit → delivered
 *     - accepted → picked_up → in_transit → failed
 *     - invalid transitions rejected (422)
 *  5. Payment settlement on delivery:
 *     - client wallet debited when delivered
 *     - motoboy wallet credited (net of platform fee)
 *  6. Authorization: only responsible motoboy can update status
 *  7. Duplicate acceptance: second motoboy gets 409
 *  8. Unauthenticated requests rejected (401)
 */

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import app from "../index.js";
import db from "../db/database.js";
import { MOCK_DELIVERIES } from "../routes/delivery.js";
import { MOCK_WALLETS, MOCK_USERS } from "../models/mock-data.js";

// ─── SQLite seed ──────────────────────────────────────────────────────────────
// Auth (SQLite) must find users with the same fixed UUIDs used in MOCK_WALLETS/
// MOCK_USERS so that JWTs carry the right userId for mock data lookups.

beforeAll(() => {
  const NOW = new Date().toISOString();
  const YESTERDAY = new Date(Date.now() - 86_400_000).toISOString();

  const insUser = db.prepare(`
    INSERT OR IGNORE INTO users
      (id, full_name, email, phone, role, status, rating, total_rides, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
  `);
  insUser.run(
    "00000000-0000-0000-0000-000000000001",
    "Ana Costa",
    "ana@vuup.app",
    "+5511999990001",
    "passenger",
    4.8,
    42,
    YESTERDAY,
    NOW,
  );
  insUser.run(
    "00000000-0000-0000-0000-000000000002",
    "Carlos Moto",
    "carlos@vuup.app",
    "+5511999990002",
    "driver",
    4.9,
    327,
    YESTERDAY,
    NOW,
  );
  insUser.run(
    "00000000-0000-0000-0000-000000000003",
    "Roberto Fundador",
    "roberto@vuup.app",
    "+5511999990003",
    "founder",
    4.7,
    15,
    YESTERDAY,
    NOW,
  );
  insUser.run(
    "00000000-0000-0000-0000-000000000004",
    "Marcos Motoboy",
    "marcos@vuup.app",
    "+5511999990004",
    "motoboy",
    4.6,
    89,
    YESTERDAY,
    NOW,
  );
  insUser.run(
    "00000000-0000-0000-0000-000000000005",
    "Bia Motoboy",
    "bia@vuup.app",
    "+5511999990005",
    "motoboy",
    4.5,
    67,
    YESTERDAY,
    NOW,
  );
  insUser.run(
    "00000000-0000-0000-0000-000000000099",
    "Admin",
    "admin@vuup.app",
    "+5511999990099",
    "admin",
    5.0,
    0,
    YESTERDAY,
    NOW,
  );
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function json(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

async function getToken(phone: string): Promise<string> {
  const res = await app.request("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  const body = await json(res);
  if (!body.accessToken) {
    throw new Error(`getToken failed for ${phone}: ${JSON.stringify(body)}`);
  }
  return body.accessToken as string;
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

function ensureMotoboyUser(phone: string, fullName: string): string {
  const existing = MOCK_USERS.find((u) => u.phone === phone);
  if (existing) {
    (existing as { role: string }).role = "motoboy";
    // Also ensure SQLite has this user with the same ID
    const now = new Date().toISOString();
    db.prepare(
      `
      INSERT OR IGNORE INTO users
        (id, full_name, email, phone, role, status, rating, total_rides, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'motoboy', 'active', null, 0, ?, ?)
    `,
    ).run(existing.id, fullName, `${phone.replace(/\D/g, "")}@test.vuup.app`, phone, now, now);
    return existing.id;
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  MOCK_USERS.push({
    id,
    fullName,
    email: `${phone.replace(/\D/g, "")}@test.vuup.app`,
    phone,
    role: "motoboy",
    status: "active",
    avatarUrl: null,
    documentNumber: null,
    rating: null,
    totalRides: 0,
    createdAt: now,
    updatedAt: now,
  });
  // Also insert into SQLite with the same ID so auth finds it
  db.prepare(
    `
    INSERT OR IGNORE INTO users
      (id, full_name, email, phone, role, status, rating, total_rides, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'motoboy', 'active', null, 0, ?, ?)
  `,
  ).run(id, fullName, `${phone.replace(/\D/g, "")}@test.vuup.app`, phone, now, now);
  return id;
}

function ensureWalletForUser(userId: string) {
  const existing = MOCK_WALLETS.find((w) => w.userId === userId);
  if (existing) return;
  MOCK_WALLETS.push({
    id: crypto.randomUUID(),
    userId,
    balanceCents: 50000, // R$500 initial balance
    pendingCents: 0,
    lifetimeEarningsCents: 0,
    campaignDiscountRemainingDays: 0,
    campaignDiscountDailyAmountCents: 0,
    campaignDiscountStartedAt: null,
    updatedAt: new Date().toISOString(),
  });
}

const CLIENT_PHONE = "+5511999990001"; // Ana — passenger/client
const MOTOBOY_PHONE = "+5511999990010"; // Motoboy 1
const MOTOBOY2_PHONE = "+5511999990011"; // Motoboy 2

const PICKUP = {
  lat: -23.5505,
  lng: -46.6333,
  address: "Av. Paulista, 1000",
  contactName: "Remetente Silva",
};
const DROPOFF = {
  lat: -23.5489,
  lng: -46.6388,
  address: "Rua Augusta, 500",
  contactName: "Destinatario Santos",
};
const PACKAGE = "Caixa pequena — frágil";

// ─── Test setup ───────────────────────────────────────────────────────────────

function resetDeliveries() {
  MOCK_DELIVERIES.length = 0;
}

function resetWalletBalance(userId: string, balanceCents: number) {
  const w = MOCK_WALLETS.find((w) => w.userId === userId);
  if (w) w.balanceCents = balanceCents;
}

// ─── POST /deliveries ─────────────────────────────────────────────────────────

describe("POST /deliveries", () => {
  beforeEach(resetDeliveries);

  it("rejects unauthenticated request", async () => {
    const res = await app.request("/deliveries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pickup: PICKUP, dropoff: DROPOFF, packageDescription: PACKAGE }),
    });
    expect(res.status).toBe(401);
  });

  it("creates a pending delivery order with fare estimate", async () => {
    const token = await getToken(CLIENT_PHONE);
    const res = await app.request("/deliveries", {
      method: "POST",
      headers: authHeader(token),
      body: JSON.stringify({ pickup: PICKUP, dropoff: DROPOFF, packageDescription: PACKAGE }),
    });
    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.delivery).toBeDefined();
    const delivery = body.delivery as Record<string, unknown>;
    expect(delivery.status).toBe("pending");
    expect(delivery.motoboyId).toBeNull();
    expect(typeof delivery.fareEstimate).toBe("number");
    expect(delivery.fareEstimate as number).toBeGreaterThan(0);
    expect(delivery.estimatedDistanceKm).toBeGreaterThan(0);
    expect(delivery.packageDescription).toBe(PACKAGE);
  });

  it("rejects missing packageDescription", async () => {
    const token = await getToken(CLIENT_PHONE);
    const res = await app.request("/deliveries", {
      method: "POST",
      headers: authHeader(token),
      body: JSON.stringify({ pickup: PICKUP, dropoff: DROPOFF }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects packageDescription longer than 200 chars", async () => {
    const token = await getToken(CLIENT_PHONE);
    const res = await app.request("/deliveries", {
      method: "POST",
      headers: authHeader(token),
      body: JSON.stringify({
        pickup: PICKUP,
        dropoff: DROPOFF,
        packageDescription: "x".repeat(201),
      }),
    });
    expect(res.status).toBe(400);
  });
});

// ─── GET /deliveries/available ────────────────────────────────────────────────

describe("GET /deliveries/available", () => {
  beforeEach(resetDeliveries);

  it("returns empty list when no pending deliveries exist", async () => {
    const motoboyId = ensureMotoboyUser(MOTOBOY_PHONE, "Motoboy Um");
    ensureWalletForUser(motoboyId);
    const token = await getToken(MOTOBOY_PHONE);
    const res = await app.request("/deliveries/available", { headers: authHeader(token) });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(Array.isArray(body.data)).toBe(true);
    expect((body.data as unknown[]).length).toBe(0);
  });

  it("shows newly created pending orders", async () => {
    const clientToken = await getToken(CLIENT_PHONE);
    await app.request("/deliveries", {
      method: "POST",
      headers: authHeader(clientToken),
      body: JSON.stringify({ pickup: PICKUP, dropoff: DROPOFF, packageDescription: PACKAGE }),
    });

    const motoboyId = ensureMotoboyUser(MOTOBOY_PHONE, "Motoboy Um");
    ensureWalletForUser(motoboyId);
    const motoboyToken = await getToken(MOTOBOY_PHONE);
    const res = await app.request("/deliveries/available", { headers: authHeader(motoboyToken) });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect((body.data as unknown[]).length).toBeGreaterThanOrEqual(1);
    const first = (body.data as Array<Record<string, unknown>>)[0]!;
    expect(first.status).toBe("pending");
  });
});

// ─── PATCH /deliveries/:id/accept ────────────────────────────────────────────

describe("PATCH /deliveries/:id/accept", () => {
  beforeEach(resetDeliveries);

  it("motoboy accepts a pending delivery", async () => {
    const clientToken = await getToken(CLIENT_PHONE);
    const createRes = await app.request("/deliveries", {
      method: "POST",
      headers: authHeader(clientToken),
      body: JSON.stringify({ pickup: PICKUP, dropoff: DROPOFF, packageDescription: PACKAGE }),
    });
    const { delivery } = (await json(createRes)) as { delivery: { id: string } };

    const motoboyId = ensureMotoboyUser(MOTOBOY_PHONE, "Motoboy Um");
    ensureWalletForUser(motoboyId);
    const motoboyToken = await getToken(MOTOBOY_PHONE);
    const res = await app.request(`/deliveries/${delivery.id}/accept`, {
      method: "PATCH",
      headers: authHeader(motoboyToken),
    });
    expect(res.status).toBe(200);
    const body = (await json(res)) as Record<string, unknown>;
    expect(body.status).toBe("accepted");
    expect(body.motoboyId).toBeTruthy();
  });

  it("returns 404 for non-existent delivery", async () => {
    const motoboyId = ensureMotoboyUser(MOTOBOY_PHONE, "Motoboy Um");
    ensureWalletForUser(motoboyId);
    const token = await getToken(MOTOBOY_PHONE);
    const res = await app.request("/deliveries/non-existent-id/accept", {
      method: "PATCH",
      headers: authHeader(token),
    });
    expect(res.status).toBe(404);
  });

  it("returns 409 when a second motoboy tries to accept an already-accepted delivery", async () => {
    const clientToken = await getToken(CLIENT_PHONE);
    const createRes = await app.request("/deliveries", {
      method: "POST",
      headers: authHeader(clientToken),
      body: JSON.stringify({ pickup: PICKUP, dropoff: DROPOFF, packageDescription: PACKAGE }),
    });
    const { delivery } = (await json(createRes)) as { delivery: { id: string } };

    const motoboy1Id = ensureMotoboyUser(MOTOBOY_PHONE, "Motoboy Um");
    ensureWalletForUser(motoboy1Id);
    const motoboy2Id = ensureMotoboyUser(MOTOBOY2_PHONE, "Motoboy Dois");
    ensureWalletForUser(motoboy2Id);

    const token1 = await getToken(MOTOBOY_PHONE);
    await app.request(`/deliveries/${delivery.id}/accept`, {
      method: "PATCH",
      headers: authHeader(token1),
    });

    const token2 = await getToken(MOTOBOY2_PHONE);
    const res2 = await app.request(`/deliveries/${delivery.id}/accept`, {
      method: "PATCH",
      headers: authHeader(token2),
    });
    expect(res2.status).toBe(409);
  });
});

// ─── Delivery state machine ────────────────────────────────────────────────────

describe("Delivery state machine (full happy path)", () => {
  beforeEach(resetDeliveries);

  it("full lifecycle: pending → accepted → picked_up → in_transit → delivered", async () => {
    const clientToken = await getToken(CLIENT_PHONE);
    const motoboyId = ensureMotoboyUser(MOTOBOY_PHONE, "Motoboy Um");
    ensureWalletForUser(motoboyId);
    const clientId = "00000000-0000-0000-0000-000000000001";
    resetWalletBalance(clientId, 50000);

    // Create
    const createRes = await app.request("/deliveries", {
      method: "POST",
      headers: authHeader(clientToken),
      body: JSON.stringify({ pickup: PICKUP, dropoff: DROPOFF, packageDescription: PACKAGE }),
    });
    expect(createRes.status).toBe(201);
    const { delivery } = (await json(createRes)) as {
      delivery: { id: string; fareEstimate: number };
    };

    // Accept
    const motoboyToken = await getToken(MOTOBOY_PHONE);
    const acceptRes = await app.request(`/deliveries/${delivery.id}/accept`, {
      method: "PATCH",
      headers: authHeader(motoboyToken),
    });
    expect(acceptRes.status).toBe(200);

    // picked_up
    const pickRes = await app.request(`/deliveries/${delivery.id}/status`, {
      method: "PATCH",
      headers: authHeader(motoboyToken),
      body: JSON.stringify({ status: "picked_up" }),
    });
    expect(pickRes.status).toBe(200);
    const pickBody = (await json(pickRes)) as Record<string, unknown>;
    expect(pickBody.status).toBe("picked_up");

    // in_transit
    const transitRes = await app.request(`/deliveries/${delivery.id}/status`, {
      method: "PATCH",
      headers: authHeader(motoboyToken),
      body: JSON.stringify({ status: "in_transit" }),
    });
    expect(transitRes.status).toBe(200);

    // delivered — triggers payment settlement
    const clientWalletBefore = MOCK_WALLETS.find((w) => w.userId === clientId)!.balanceCents;
    const motoboyWalletBefore = MOCK_WALLETS.find((w) => w.userId === motoboyId)?.balanceCents ?? 0;

    const deliveredRes = await app.request(`/deliveries/${delivery.id}/status`, {
      method: "PATCH",
      headers: authHeader(motoboyToken),
      body: JSON.stringify({ status: "delivered" }),
    });
    expect(deliveredRes.status).toBe(200);
    const deliveredBody = (await json(deliveredRes)) as Record<string, unknown>;
    expect(deliveredBody.status).toBe("delivered");
    expect(typeof deliveredBody.fareActual).toBe("number");

    const fare = delivery.fareEstimate;
    const expectedFee = Math.round((fare * 15) / 100);
    const expectedMotoboyEarning = fare - expectedFee;

    const clientWalletAfter = MOCK_WALLETS.find((w) => w.userId === clientId)!.balanceCents;
    const motoboyWalletAfter = MOCK_WALLETS.find((w) => w.userId === motoboyId)!.balanceCents;

    expect(clientWalletBefore - clientWalletAfter).toBe(fare);
    expect(motoboyWalletAfter - motoboyWalletBefore).toBe(expectedMotoboyEarning);
  });

  it("full lifecycle: accepted → picked_up → in_transit → failed (no payment)", async () => {
    const clientToken = await getToken(CLIENT_PHONE);
    const motoboyId = ensureMotoboyUser(MOTOBOY_PHONE, "Motoboy Um");
    ensureWalletForUser(motoboyId);

    const createRes = await app.request("/deliveries", {
      method: "POST",
      headers: authHeader(clientToken),
      body: JSON.stringify({ pickup: PICKUP, dropoff: DROPOFF, packageDescription: PACKAGE }),
    });
    const { delivery } = (await json(createRes)) as { delivery: { id: string } };

    const motoboyToken = await getToken(MOTOBOY_PHONE);
    await app.request(`/deliveries/${delivery.id}/accept`, {
      method: "PATCH",
      headers: authHeader(motoboyToken),
    });
    await app.request(`/deliveries/${delivery.id}/status`, {
      method: "PATCH",
      headers: authHeader(motoboyToken),
      body: JSON.stringify({ status: "picked_up" }),
    });
    await app.request(`/deliveries/${delivery.id}/status`, {
      method: "PATCH",
      headers: authHeader(motoboyToken),
      body: JSON.stringify({ status: "in_transit" }),
    });

    const motoboyWalletBefore = MOCK_WALLETS.find((w) => w.userId === motoboyId)?.balanceCents ?? 0;

    const failedRes = await app.request(`/deliveries/${delivery.id}/status`, {
      method: "PATCH",
      headers: authHeader(motoboyToken),
      body: JSON.stringify({ status: "failed" }),
    });
    expect(failedRes.status).toBe(200);
    const failedBody = (await json(failedRes)) as Record<string, unknown>;
    expect(failedBody.status).toBe("failed");

    // No payment settlement on failure — wallet unchanged
    const motoboyWalletAfter = MOCK_WALLETS.find((w) => w.userId === motoboyId)?.balanceCents ?? 0;
    expect(motoboyWalletAfter).toBe(motoboyWalletBefore);
  });

  it("rejects invalid state transition (e.g. pending → delivered)", async () => {
    const clientToken = await getToken(CLIENT_PHONE);
    const motoboyId = ensureMotoboyUser(MOTOBOY_PHONE, "Motoboy Um");
    ensureWalletForUser(motoboyId);

    const createRes = await app.request("/deliveries", {
      method: "POST",
      headers: authHeader(clientToken),
      body: JSON.stringify({ pickup: PICKUP, dropoff: DROPOFF, packageDescription: PACKAGE }),
    });
    const { delivery } = (await json(createRes)) as { delivery: { id: string } };

    const motoboyToken = await getToken(MOTOBOY_PHONE);
    await app.request(`/deliveries/${delivery.id}/accept`, {
      method: "PATCH",
      headers: authHeader(motoboyToken),
    });

    // Try to jump directly from accepted to delivered (must go through picked_up → in_transit first)
    const res = await app.request(`/deliveries/${delivery.id}/status`, {
      method: "PATCH",
      headers: authHeader(motoboyToken),
      body: JSON.stringify({ status: "delivered" }),
    });
    expect(res.status).toBe(422);
    const body = await json(res);
    expect(body.code).toBe("INVALID_TRANSITION");
  });

  it("rejects status update by a different motoboy (403)", async () => {
    const clientToken = await getToken(CLIENT_PHONE);
    const motoboy1Id = ensureMotoboyUser(MOTOBOY_PHONE, "Motoboy Um");
    ensureWalletForUser(motoboy1Id);
    const motoboy2Id = ensureMotoboyUser(MOTOBOY2_PHONE, "Motoboy Dois");
    ensureWalletForUser(motoboy2Id);

    const createRes = await app.request("/deliveries", {
      method: "POST",
      headers: authHeader(clientToken),
      body: JSON.stringify({ pickup: PICKUP, dropoff: DROPOFF, packageDescription: PACKAGE }),
    });
    const { delivery } = (await json(createRes)) as { delivery: { id: string } };

    const token1 = await getToken(MOTOBOY_PHONE);
    await app.request(`/deliveries/${delivery.id}/accept`, {
      method: "PATCH",
      headers: authHeader(token1),
    });

    const token2 = await getToken(MOTOBOY2_PHONE);
    const res = await app.request(`/deliveries/${delivery.id}/status`, {
      method: "PATCH",
      headers: authHeader(token2),
      body: JSON.stringify({ status: "picked_up" }),
    });
    expect(res.status).toBe(403);
  });
});

// ─── GET /deliveries — list user deliveries ───────────────────────────────────

describe("GET /deliveries", () => {
  beforeEach(resetDeliveries);

  it("client sees their own deliveries", async () => {
    const clientToken = await getToken(CLIENT_PHONE);
    await app.request("/deliveries", {
      method: "POST",
      headers: authHeader(clientToken),
      body: JSON.stringify({ pickup: PICKUP, dropoff: DROPOFF, packageDescription: PACKAGE }),
    });

    const res = await app.request("/deliveries?role=client", { headers: authHeader(clientToken) });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect((body.data as unknown[]).length).toBeGreaterThanOrEqual(1);
  });

  it("motoboy list is empty before accepting anything", async () => {
    const motoboyId = ensureMotoboyUser(MOTOBOY_PHONE, "Motoboy Um");
    ensureWalletForUser(motoboyId);
    const token = await getToken(MOTOBOY_PHONE);
    const res = await app.request("/deliveries?role=motoboy", { headers: authHeader(token) });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect((body.data as unknown[]).length).toBe(0);
  });

  it("motoboy sees their accepted deliveries", async () => {
    const clientToken = await getToken(CLIENT_PHONE);
    const createRes = await app.request("/deliveries", {
      method: "POST",
      headers: authHeader(clientToken),
      body: JSON.stringify({ pickup: PICKUP, dropoff: DROPOFF, packageDescription: PACKAGE }),
    });
    const { delivery } = (await json(createRes)) as { delivery: { id: string } };

    const motoboyId = ensureMotoboyUser(MOTOBOY_PHONE, "Motoboy Um");
    ensureWalletForUser(motoboyId);
    const motoboyToken = await getToken(MOTOBOY_PHONE);
    await app.request(`/deliveries/${delivery.id}/accept`, {
      method: "PATCH",
      headers: authHeader(motoboyToken),
    });

    const res = await app.request("/deliveries?role=motoboy", {
      headers: authHeader(motoboyToken),
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect((body.data as unknown[]).length).toBeGreaterThanOrEqual(1);
  });
});
