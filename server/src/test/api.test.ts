/**
 * Smoke tests for the VUUP API server
 * Tests auth flow, ride creation, and wallet endpoints using Hono's test helper.
 */

import { describe, it, expect } from "vitest";
import app from "../index.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(res: Response): Promise<any> {
  return res.json();
}

// ─── /health ─────────────────────────────────────────────────────────────────

describe("GET /health", () => {
  it("returns 200 with status ok", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.status).toBe("ok");
    expect(body.mode).toBe("mock");
  });
});

// ─── /auth ───────────────────────────────────────────────────────────────────

describe("POST /auth/otp-request", () => {
  it("returns 200 for any phone", async () => {
    const res = await app.request("/auth/otp-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "+5511999990001" }),
    });
    expect(res.status).toBe(200);
  });
});

describe("POST /auth/login", () => {
  it("issues JWT for valid OTP (any 6-digit code)", async () => {
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "+5511999990001", otpCode: "123456" }),
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
    expect(body.user.role).toBe("passenger");
  });

  it("rejects OTP shorter than 6 digits", async () => {
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "+5511999990001", otpCode: "12345" }),
    });
    expect(res.status).toBe(400);
  });
});

// ─── Protected routes need auth ───────────────────────────────────────────────

describe("Protected routes", () => {
  it("GET /users/me returns 401 without token", async () => {
    const res = await app.request("/users/me");
    expect(res.status).toBe(401);
  });

  it("GET /wallet returns 401 without token", async () => {
    const res = await app.request("/wallet");
    expect(res.status).toBe(401);
  });

  it("GET /rides returns 401 without token", async () => {
    const res = await app.request("/rides");
    expect(res.status).toBe(401);
  });

  it("GET /safety/events returns 401 without token", async () => {
    const res = await app.request("/safety/events");
    expect(res.status).toBe(401);
  });
});

// ─── Full auth + protected resource flow ────────────────────────────────────

async function getToken(phone = "+5511999990002"): Promise<string> {
  const res = await app.request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, otpCode: "999999" }),
  });
  const body = await json(res);
  return body.accessToken as string;
}

describe("Authenticated flows", () => {
  it("GET /users/me returns user profile", async () => {
    const token = await getToken();
    const res = await app.request("/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.id).toBeTruthy();
    expect(body.role).toBeTruthy();
  });

  it("POST /rides creates a ride", async () => {
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
    // POST /rides now returns { ride, fareBreakdown, vipWindow }
    expect(body.ride.status).toBe("searching");
    expect(body.ride.fareEstimate).toBeGreaterThan(0);
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

  it("GET /safety/events returns community feed", async () => {
    const token = await getToken();
    const res = await app.request("/safety/events", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("GET /carpool/routes returns active routes", async () => {
    const token = await getToken();
    const res = await app.request("/carpool/routes", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });
});
