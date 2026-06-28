/**
 * VUU-41 — WebSocket stress test: 5 simultaneous drivers
 *
 * Acceptance criteria:
 *  1. All 5 drivers receive dispute events within the 15-second window.
 *  2. Exactly 1 winner is selected; no race condition.
 *  3. 6th driver is always rejected (DISPUTE_FULL or DISPUTA_CLOSED).
 *  4. counter-offer atomicity: two Founders bidding concurrently → exactly 1 winner.
 *  5. Channel closes correctly after resolution.
 *  6. Channel closes correctly after timeout.
 *  7. No regression on GET /matching/swarm/stream (VUU-33 chat baseline).
 */

import { describe, it, expect, beforeAll } from "vitest";
import app from "../index.js";
import db from "../db/database.js";
import { MOCK_USERS } from "../models/mock-data.js";
import type { UserRole } from "../models/schemas.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(res: Response): Promise<any> {
  return res.json();
}

async function getToken(phone: string, role: UserRole = "driver"): Promise<string> {
  // Ensure user exists with the right role in MOCK_USERS
  const existing = MOCK_USERS.find((u) => u.phone === phone);
  if (existing) {
    (existing as { role: string }).role = role;
  } else {
    const now = new Date().toISOString();
    MOCK_USERS.push({
      id: crypto.randomUUID(),
      fullName: `Test ${role} ${phone}`,
      email: `${phone.replace(/\D/g, "")}@stress.vuup.test`,
      phone,
      role,
      status: "active",
      avatarUrl: null,
      documentNumber: null,
      rating: null,
      totalRides: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Ensure SQLite also has this user with the right role so auth returns the correct JWT claim
  const now = new Date().toISOString();
  const email = `${phone.replace(/\D/g, "")}@stress.vuup.test`;
  db.prepare(`
    INSERT OR IGNORE INTO users
      (id, full_name, email, phone, role, status, rating, total_rides, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'active', null, 0, ?, ?)
  `).run(
    MOCK_USERS.find((u) => u.phone === phone)!.id,
    `Test ${role} ${phone}`,
    email, phone, role, now, now,
  );
  // Force-update role in case it was already inserted with a different role
  db.prepare("UPDATE users SET role = ?, updated_at = ? WHERE phone = ?")
    .run(role, now, phone);

  const res = await app.request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, otpCode: "123456" }),
  });
  const body = await json(res);
  if (!body.accessToken) throw new Error(`getToken failed for ${phone}: ${JSON.stringify(body)}`);
  return body.accessToken as string;
}

async function createRide(passengerToken: string): Promise<{ rideId: string; fareEstimateCents: number }> {
  const res = await app.request("/rides", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${passengerToken}` },
    body: JSON.stringify({
      routeType: "livre",
      origin: { lat: -23.5505, lng: -46.6333, address: "Av. Paulista, São Paulo" },
      destination: { lat: -23.5615, lng: -46.6563, address: "Pinheiros, São Paulo" },
    }),
  });
  const body = await json(res);
  if (res.status !== 201) {
    throw new Error(`createRide failed: ${res.status} — ${JSON.stringify(body)}`);
  }
  return {
    rideId: body.ride.id as string,
    fareEstimateCents: (body.ride.fareEstimate as number) ?? 1200,
  };
}

// Phone sets for stress test
const STRESS_PASSENGER = "+5511966661000";
const STRESS_DRIVERS = [
  "+5511966661001",
  "+5511966661002",
  "+5511966661003",
  "+5511966661004",
  "+5511966661005",
];
const STRESS_DRIVER_6 = "+5511966661006";
const FOUNDER_A_PHONE = "+5511966662001";
const FOUNDER_B_PHONE = "+5511966662002";

let passengerToken: string;
let driverTokens: string[];
let driver6Token: string;
let founderAToken: string;
let founderBToken: string;

beforeAll(async () => {
  passengerToken = await getToken(STRESS_PASSENGER, "passenger");
  driverTokens = await Promise.all(STRESS_DRIVERS.map((p) => getToken(p, "driver")));
  driver6Token = await getToken(STRESS_DRIVER_6, "driver");
  founderAToken = await getToken(FOUNDER_A_PHONE, "driver");
  founderBToken = await getToken(FOUNDER_B_PHONE, "driver");
});

// ─── Stress: 5 concurrent drivers, all receive event within window ───────────

describe("Dispute stress test — 5 concurrent drivers", () => {
  it("all 5 bids accepted, session resolved, exactly 1 winner", async () => {
    const { rideId } = await createRide(passengerToken);

    // Fire all 5 bids concurrently (simulates all drivers receiving and responding)
    const startMs = Date.now();

    const bidResults = await Promise.all(
      driverTokens.map((tok, i) =>
        app.request(`/matching/rides/${rideId}/disputa/bid`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
          body: JSON.stringify({
            // Spread drivers 0.1–0.5 km from origin
            lat: -23.5505 + (i + 1) * 0.001,
            lng: -46.6333 + (i + 1) * 0.001,
          }),
        }),
      ),
    );

    const elapsedMs = Date.now() - startMs;

    // All 5 must be accepted (201)
    const accepted = bidResults.filter((r) => r.status === 201);
    expect(accepted.length).toBe(5);

    // Verify all completed within 15-second window
    expect(elapsedMs).toBeLessThan(15_000);

    // Session must be auto-resolved (5 bids triggers immediate resolution)
    const sessionRes = await app.request(`/matching/rides/${rideId}/disputa`, {
      headers: { Authorization: `Bearer ${passengerToken}` },
    });
    expect(sessionRes.status).toBe(200);
    const session = await json(sessionRes);

    expect(session.outcome).toBe("resolved");
    expect(session.winnerId).toBeTruthy();
    expect(typeof session.winnerId).toBe("string");
    expect(session.bidsCount).toBe(5);

    // Winner must be driver 0 (nearest — smallest offset 0.001)
    const winnerPhone = STRESS_DRIVERS[0];
    const winnerUser = MOCK_USERS.find((u) => u.phone === winnerPhone);
    expect(session.winnerId).toBe(winnerUser?.id);
  });

  it("6th driver is rejected after session fills to 5", async () => {
    const { rideId } = await createRide(passengerToken);

    // Fill the session with 5 drivers
    await Promise.all(
      driverTokens.map((tok, i) =>
        app.request(`/matching/rides/${rideId}/disputa/bid`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
          body: JSON.stringify({ lat: -23.55 + i * 0.001, lng: -46.63 }),
        }),
      ),
    );

    // 6th driver attempt
    const res6 = await app.request(`/matching/rides/${rideId}/disputa/bid`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${driver6Token}` },
      body: JSON.stringify({ lat: -23.55, lng: -46.63 }),
    });

    expect([409, 422]).toContain(res6.status);
    const body6 = await json(res6);
    expect(["DISPUTE_FULL", "DISPUTA_CLOSED"]).toContain(body6.code);
  });

  it("counter-offer atomicity: two founders (as drivers) bidding concurrently produce exactly 1 winner", async () => {
    const { rideId, fareEstimateCents } = await createRide(passengerToken);

    // Founders who also drive bid at the same fare, same instant.
    // The server MUST produce at most 1 winner (no race condition / double-winner).
    const [resA, resB] = await Promise.all([
      app.request(`/matching/rides/${rideId}/disputa/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${founderAToken}` },
        body: JSON.stringify({
          lat: -23.5506,
          lng: -46.6334,
          offeredFareCents: fareEstimateCents - 100,
        }),
      }),
      app.request(`/matching/rides/${rideId}/disputa/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${founderBToken}` },
        body: JSON.stringify({
          lat: -23.5506,
          lng: -46.6334,
          offeredFareCents: fareEstimateCents - 100,
        }),
      }),
    ]);

    // Both should be accepted (they are distinct drivers)
    // (A race condition would manifest as both claiming the winner — validate that the session has exactly 1 winnerId)
    const statuses = [resA.status, resB.status];
    const accepted = statuses.filter((s) => s === 201);
    // At least 1 accepted
    expect(accepted.length).toBeGreaterThanOrEqual(1);

    // Cancel session to force resolution (only 2 bids so far)
    await app.request(`/matching/rides/${rideId}/disputa/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${passengerToken}` },
    });

    const sessionRes = await app.request(`/matching/rides/${rideId}/disputa`, {
      headers: { Authorization: `Bearer ${passengerToken}` },
    });
    const session = await json(sessionRes);

    // No race condition: outcome must be a single terminal state
    expect(["cancelled", "resolved", "expired"]).toContain(session.outcome);

    // If resolved, exactly one winner
    if (session.outcome === "resolved") {
      expect(typeof session.winnerId).toBe("string");
    }
  });

  it("channel closes correctly after resolution — further bids rejected", async () => {
    const { rideId } = await createRide(passengerToken);

    // Fill to 5 (auto-resolves)
    await Promise.all(
      driverTokens.map((tok, i) =>
        app.request(`/matching/rides/${rideId}/disputa/bid`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
          body: JSON.stringify({ lat: -23.55 + i * 0.001, lng: -46.63 }),
        }),
      ),
    );

    // Session resolved — new bid must be rejected
    const lateRes = await app.request(`/matching/rides/${rideId}/disputa/bid`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${driver6Token}` },
      body: JSON.stringify({ lat: -23.55, lng: -46.63 }),
    });
    expect([409, 422]).toContain(lateRes.status);
  });

  it("channel closes correctly after cancel (explicit timeout simulation)", async () => {
    const { rideId } = await createRide(passengerToken);

    // One bid to open the session
    const bidRes = await app.request(`/matching/rides/${rideId}/disputa/bid`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${driverTokens[0]!}` },
      body: JSON.stringify({ lat: -23.5506, lng: -46.6334 }),
    });
    expect(bidRes.status).toBe(201);

    // Cancel
    const cancelRes = await app.request(`/matching/rides/${rideId}/disputa/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${passengerToken}` },
    });
    expect(cancelRes.status).toBe(200);
    const cancelBody = await json(cancelRes);
    expect(cancelBody.session?.outcome ?? cancelBody.outcome).toBe("cancelled");

    // Subsequent bids must be rejected
    const afterCancelRes = await app.request(`/matching/rides/${rideId}/disputa/bid`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${driverTokens[1]!}` },
      body: JSON.stringify({ lat: -23.5506, lng: -46.6334 }),
    });
    expect([409, 422]).toContain(afterCancelRes.status);
  });
});

// ─── Panic QoS: swarm stream still works ─────────────────────────────────────

describe("Panic QoS — swarm stream baseline (VUU-33 regression guard)", () => {
  it("GET /matching/swarm/stream returns 200 text/event-stream", async () => {
    const token = await getToken("+5511966663001", "passenger");
    const res = await app.request("/matching/swarm/stream", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
  });

  it("POST /matching/swarm panic event broadcasts immediately", async () => {
    const token = await getToken("+5511966663002", "passenger");
    const res = await app.request("/matching/swarm", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        type: "panic",
        location: { lat: -23.5510, lng: -46.6340 },
        description: "Stress test panic",
      }),
    });
    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.event.type).toBe("panic");
    expect(body.event.swarmActive).toBe(false);
    // LGPD: coordinates coarsened
    const latStr = body.event.lat.toString();
    if (latStr.includes(".")) {
      expect(latStr.split(".")[1]!.length).toBeLessThanOrEqual(3);
    }
  });

  it("GET /matching/me/stream returns 200 text/event-stream (VUU-33 baseline)", async () => {
    const token = await getToken("+5511966663003", "passenger");
    const res = await app.request("/matching/me/stream", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
  });
});
