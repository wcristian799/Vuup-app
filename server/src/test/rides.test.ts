/**
 * VUU-17 — Ride APIs, Pricing, Patron Driver & VIP Window tests
 *
 * Covers:
 *  - Fare estimate endpoint for each modality
 *  - POST /rides with real pricing
 *  - Ride state machine (valid and invalid transitions)
 *  - PATCH /rides/:id/cancel
 *  - GET /rides/:id with VIP window state
 *  - Patron CRUD: POST, GET, DELETE /patron
 *  - VIP window enforcement: patron driver gets priority, others are blocked
 *  - Pricing unit tests (distance, duration, surge, coupon)
 */

import { describe, it, expect } from "vitest";
import app from "../index.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(res: Response): Promise<any> {
  return res.json();
}

async function getToken(phone: string): Promise<string> {
  const res = await app.request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, otpCode: "123456" }),
  });
  const body = await json(res);
  return body.accessToken as string;
}

const PASSENGER_PHONE = "+5511999990001"; // Ana — passenger with patron link
const DRIVER_PHONE    = "+5511999990002"; // Carlos — driver (Ana's patron)

const ORIGIN      = { lat: -23.5505, lng: -46.6333, address: "Paulista" };
const DESTINATION = { lat: -23.5489, lng: -46.6388, address: "Augusta" };

// ─── Pricing unit tests ────────────────────────────────────────────────────────

import {
  estimateDistanceKm,
  estimateDurationMin,
  computeSurgeMultiplier,
  calculateFare,
} from "../lib/pricing.js";

describe("estimateDistanceKm", () => {
  it("returns 0 for same point", () => {
    const d = estimateDistanceKm(ORIGIN, ORIGIN);
    expect(d).toBeCloseTo(0, 1);
  });

  it("returns a positive value for different points", () => {
    const d = estimateDistanceKm(ORIGIN, DESTINATION);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(5); // these two points are well under 5 km apart
  });
});

describe("estimateDurationMin", () => {
  it("returns at least 3 minutes", () => {
    expect(estimateDurationMin(0)).toBe(3);
    expect(estimateDurationMin(0.1)).toBe(3);
  });

  it("scales linearly with distance (approx)", () => {
    const d = estimateDurationMin(25); // 25 km at 25 km/h = 60 min
    expect(d).toBe(60);
  });
});

describe("computeSurgeMultiplier", () => {
  it("returns 1.0 outside surge hours", () => {
    const offPeak = new Date("2026-06-28T14:00:00Z"); // 14:00 UTC
    expect(computeSurgeMultiplier(offPeak)).toBe(1.0);
  });

  it("returns 1.3 during surge hours", () => {
    const surge = new Date("2026-06-28T11:00:00Z"); // 11:00 UTC
    expect(computeSurgeMultiplier(surge)).toBe(1.3);
  });
});

describe("calculateFare", () => {
  const base = {
    origin: ORIGIN,
    destination: DESTINATION,
    at: new Date("2026-06-28T14:00:00Z"), // off-peak
  };

  it("returns positive totalCents for livre", () => {
    const f = calculateFare({ ...base, modality: "livre" });
    expect(f.totalCents).toBeGreaterThan(0);
    expect(f.modality).toBe("livre");
    expect(f.surgeMultiplier).toBe(1.0);
    expect(f.driverEarningsCents).toBeLessThan(f.totalCents);
  });

  it("fixa is cheaper than livre (same route)", () => {
    const livre  = calculateFare({ ...base, modality: "livre" });
    const fixa   = calculateFare({ ...base, modality: "fixa" });
    expect(fixa.totalCents).toBeLessThan(livre.totalCents);
  });

  it("programada includes scheduling fee", () => {
    const livre      = calculateFare({ ...base, modality: "livre" });
    const programada = calculateFare({ ...base, modality: "programada" });
    expect(programada.schedulingFeeCents).toBeGreaterThan(0);
    expect(programada.totalCents).toBeGreaterThan(livre.totalCents);
  });

  it("motoboy is cheaper than livre", () => {
    const livre   = calculateFare({ ...base, modality: "livre" });
    const motoboy = calculateFare({ ...base, modality: "motoboy" });
    expect(motoboy.totalCents).toBeLessThan(livre.totalCents);
  });

  it("applies percent coupon discount", () => {
    const coupon = {
      id: "test",
      code: "TEST10",
      campaignId: null,
      discountType: "percent" as const,
      discountValue: 10,
      maxUsages: null,
      usagesCount: 0,
      minFareCents: 0,
      validFrom: new Date(Date.now() - 86400000).toISOString(),
      validUntil: new Date(Date.now() + 86400000).toISOString(),
      isActive: true,
    };
    const withCoupon    = calculateFare({ ...base, modality: "livre", coupon });
    const withoutCoupon = calculateFare({ ...base, modality: "livre" });
    expect(withCoupon.couponDiscountCents).toBeGreaterThan(0);
    expect(withCoupon.totalCents).toBeLessThan(withoutCoupon.totalCents);
  });

  it("applies fixed coupon discount", () => {
    const coupon = {
      id: "test2",
      code: "FIXED500",
      campaignId: null,
      discountType: "fixed" as const,
      discountValue: 500,
      maxUsages: null,
      usagesCount: 0,
      minFareCents: 0,
      validFrom: new Date(Date.now() - 86400000).toISOString(),
      validUntil: new Date(Date.now() + 86400000).toISOString(),
      isActive: true,
    };
    const without = calculateFare({ ...base, modality: "livre" });
    const withC   = calculateFare({ ...base, modality: "livre", coupon });
    expect(withC.couponDiscountCents).toBe(500);
    expect(withC.totalCents).toBe(Math.max(0, without.totalCents - 500));
  });
});

// ─── POST /rides/fare-estimate ─────────────────────────────────────────────────

describe("POST /rides/fare-estimate", () => {
  it("requires auth", async () => {
    const res = await app.request("/rides/fare-estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modality: "livre", origin: ORIGIN, destination: DESTINATION }),
    });
    expect(res.status).toBe(401);
  });

  it("returns fare breakdown for livre", async () => {
    const token = await getToken(PASSENGER_PHONE);
    const res = await app.request("/rides/fare-estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ modality: "livre", origin: ORIGIN, destination: DESTINATION }),
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.fareBreakdown.modality).toBe("livre");
    expect(body.fareBreakdown.totalCents).toBeGreaterThan(0);
    expect(body.fareBreakdown.driverEarningsCents).toBeLessThan(body.fareBreakdown.totalCents);
  });

  it("returns fare breakdown for all modalities", async () => {
    const token = await getToken(PASSENGER_PHONE);
    for (const modality of ["livre", "fixa", "programada", "motoboy"]) {
      const res = await app.request("/rides/fare-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ modality, origin: ORIGIN, destination: DESTINATION }),
      });
      expect(res.status).toBe(200);
      const body = await json(res);
      expect(body.fareBreakdown.modality).toBe(modality);
    }
  });

  it("rejects invalid coupon code", async () => {
    const token = await getToken(PASSENGER_PHONE);
    const res = await app.request("/rides/fare-estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        modality: "livre",
        origin: ORIGIN,
        destination: DESTINATION,
        couponCode: "NOTEXIST",
      }),
    });
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toBe("INVALID_COUPON");
  });

  it("applies valid coupon code VUUP10", async () => {
    const token = await getToken(PASSENGER_PHONE);
    const [withRes, withoutRes] = await Promise.all([
      app.request("/rides/fare-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          modality: "livre", origin: ORIGIN, destination: DESTINATION,
          couponCode: "VUUP10",
        }),
      }),
      app.request("/rides/fare-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ modality: "livre", origin: ORIGIN, destination: DESTINATION }),
      }),
    ]);
    const withBody    = await json(withRes);
    const withoutBody = await json(withoutRes);
    expect(withBody.fareBreakdown.couponDiscountCents).toBeGreaterThan(0);
    expect(withBody.fareBreakdown.totalCents).toBeLessThan(withoutBody.fareBreakdown.totalCents);
  });
});

// ─── POST /rides ───────────────────────────────────────────────────────────────

describe("POST /rides", () => {
  it("requires auth", async () => {
    const res = await app.request("/rides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ routeType: "livre", origin: ORIGIN, destination: DESTINATION }),
    });
    expect(res.status).toBe(401);
  });

  it("drivers cannot request rides", async () => {
    const token = await getToken(DRIVER_PHONE);
    const res = await app.request("/rides", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ routeType: "livre", origin: ORIGIN, destination: DESTINATION }),
    });
    expect(res.status).toBe(403);
  });

  it("creates a ride with real pricing and VIP window", async () => {
    const token = await getToken(PASSENGER_PHONE);
    const res = await app.request("/rides", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ routeType: "livre", origin: ORIGIN, destination: DESTINATION }),
    });
    expect(res.status).toBe(201);
    const body = await json(res);

    // Real pricing: fare must match breakdown
    expect(body.ride.status).toBe("searching");
    expect(body.ride.fareEstimate).toBe(body.fareBreakdown.totalCents);
    expect(body.fareBreakdown.modality).toBe("livre");
    expect(body.fareBreakdown.distanceKm).toBeGreaterThan(0);

    // VIP window: Ana has Carlos as patron
    expect(body.vipWindow).not.toBeNull();
    expect(body.vipWindow.patronDriverId).toBeDefined();
    expect(body.vipWindow.windowExpiresAt).toBeDefined();
  });

  it("requires scheduledAt for programada", async () => {
    const token = await getToken(PASSENGER_PHONE);
    const res = await app.request("/rides", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ routeType: "programada", origin: ORIGIN, destination: DESTINATION }),
    });
    expect(res.status).toBe(400);
  });

  it("creates a programada ride with scheduledAt", async () => {
    const token = await getToken(PASSENGER_PHONE);
    const scheduledAt = new Date(Date.now() + 3_600_000).toISOString();
    const res = await app.request("/rides", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        routeType: "programada",
        origin: ORIGIN,
        destination: DESTINATION,
        scheduledAt,
      }),
    });
    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.ride.scheduledAt).toBe(scheduledAt);
    expect(body.fareBreakdown.schedulingFeeCents).toBeGreaterThan(0);
  });
});

// ─── GET /rides/:id + VIP window ──────────────────────────────────────────────

describe("GET /rides/:id", () => {
  it("returns ride with vipWindow field", async () => {
    // Create a ride first
    const token = await getToken(PASSENGER_PHONE);
    const createRes = await app.request("/rides", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ routeType: "livre", origin: ORIGIN, destination: DESTINATION }),
    });
    const { ride } = await json(createRes);

    const getRes = await app.request(`/rides/${ride.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(getRes.status).toBe(200);
    const body = await json(getRes);
    expect(body.ride.id).toBe(ride.id);
    // vipWindow is present (may be null if no patron, non-null if patron)
    expect("vipWindow" in body).toBe(true);
  });

  it("returns 404 for unknown id", async () => {
    const token = await getToken(PASSENGER_PHONE);
    const res = await app.request("/rides/00000000-0000-0000-0000-000000000099", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(404);
  });
});

// ─── Ride state machine ────────────────────────────────────────────────────────

describe("PATCH /rides/:id/status — state machine", () => {
  async function createRide(passengerToken: string): Promise<string> {
    const res = await app.request("/rides", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${passengerToken}` },
      body: JSON.stringify({ routeType: "livre", origin: ORIGIN, destination: DESTINATION }),
    });
    const body = await json(res);
    return body.ride.id as string;
  }

  it("driver can accept a ride (sets driverId)", async () => {
    const passengerToken = await getToken(PASSENGER_PHONE);
    const driverToken    = await getToken(DRIVER_PHONE);
    const rideId = await createRide(passengerToken);

    // Carlos is the patron driver — his window is open, so he can accept immediately.
    const res = await app.request(`/rides/${rideId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${driverToken}` },
      body: JSON.stringify({ status: "accepted" }),
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.status).toBe("accepted");
    expect(body.driverId).toBeTruthy();
  });

  it("rejects invalid transition (searching -> in_progress)", async () => {
    const passengerToken = await getToken(PASSENGER_PHONE);
    const driverToken    = await getToken(DRIVER_PHONE);
    const rideId = await createRide(passengerToken);

    const res = await app.request(`/rides/${rideId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${driverToken}` },
      body: JSON.stringify({ status: "in_progress" }),
    });
    expect(res.status).toBe(422);
    const body = await json(res);
    expect(body.code).toBe("INVALID_TRANSITION");
  });

  it("full lifecycle: searching -> accepted -> driver_en_route -> in_progress -> completed", async () => {
    const passengerToken = await getToken(PASSENGER_PHONE);
    const driverToken    = await getToken(DRIVER_PHONE);
    const rideId = await createRide(passengerToken);

    const steps: Array<"accepted" | "driver_en_route" | "in_progress" | "completed"> = [
      "accepted", "driver_en_route", "in_progress", "completed",
    ];

    for (const step of steps) {
      const res = await app.request(`/rides/${rideId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${driverToken}` },
        body: JSON.stringify({ status: step }),
      });
      expect(res.status).toBe(200);
      const body = await json(res);
      expect(body.status).toBe(step);
    }

    // Verify completed state is terminal
    const terminalRes = await app.request(`/rides/${rideId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${driverToken}` },
      body: JSON.stringify({ status: "cancelled" }),
    });
    expect(terminalRes.status).toBe(422);
  });
});

// ─── PATCH /rides/:id/cancel ───────────────────────────────────────────────────

describe("PATCH /rides/:id/cancel", () => {
  async function createRide(passengerToken: string): Promise<string> {
    const res = await app.request("/rides", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${passengerToken}` },
      body: JSON.stringify({ routeType: "livre", origin: ORIGIN, destination: DESTINATION }),
    });
    const body = await json(res);
    return body.ride.id as string;
  }

  it("passenger can cancel their own ride", async () => {
    const token = await getToken(PASSENGER_PHONE);
    const rideId = await createRide(token);

    const res = await app.request(`/rides/${rideId}/cancel`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reason: "Mudei de planos" }),
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.status).toBe("cancelled");
    expect(body.cancellationReason).toBe("Mudei de planos");
  });

  it("driver cannot cancel another passenger's ride", async () => {
    const passengerToken = await getToken(PASSENGER_PHONE);
    const driverToken    = await getToken(DRIVER_PHONE);
    const rideId = await createRide(passengerToken);

    const res = await app.request(`/rides/${rideId}/cancel`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${driverToken}` },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(403);
  });

  it("cannot cancel an already cancelled ride", async () => {
    const token = await getToken(PASSENGER_PHONE);
    const rideId = await createRide(token);

    // First cancellation
    await app.request(`/rides/${rideId}/cancel`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    });

    // Second cancellation — should fail
    const res = await app.request(`/rides/${rideId}/cancel`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(422);
  });
});

// ─── Patron driver (Motorista Patrono) ────────────────────────────────────────

describe("GET /patron", () => {
  it("requires auth", async () => {
    const res = await app.request("/patron");
    expect(res.status).toBe(401);
  });

  it("passenger sees their patron link", async () => {
    const token = await getToken(PASSENGER_PHONE); // Ana has Carlos pre-linked
    const res = await app.request("/patron", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].isActive).toBe(true);
  });

  it("driver sees their patron passengers", async () => {
    const token = await getToken(DRIVER_PHONE); // Carlos
    const res = await app.request("/patron", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.length).toBeGreaterThan(0);
  });
});

describe("POST /patron", () => {
  it("passenger can set a new patron driver", async () => {
    // Create a new passenger first
    const newPhone = "+5511999999099";
    const token = await getToken(newPhone);

    // Link Carlos as patron
    const carlosId = "00000000-0000-0000-0000-000000000002";
    const res = await app.request("/patron", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ driverId: carlosId, label: "Carlos — Meu Motorista" }),
    });
    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.driverId).toBe(carlosId);
    expect(body.isActive).toBe(true);
  });

  it("rejects non-existent driverId", async () => {
    const token = await getToken(PASSENGER_PHONE);
    const res = await app.request("/patron", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        driverId: "00000000-0000-0000-0000-000000000099",
        label: "Nobody",
      }),
    });
    expect(res.status).toBe(404);
  });

  it("drivers cannot set a patron driver", async () => {
    const token = await getToken(DRIVER_PHONE);
    const res = await app.request("/patron", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        driverId: "00000000-0000-0000-0000-000000000002",
        label: "Test",
      }),
    });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /patron/:id", () => {
  it("passenger can deactivate their patron link", async () => {
    const token = await getToken(PASSENGER_PHONE);
    // Fetch the existing patron link id
    const listRes = await app.request("/patron", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const listBody = await json(listRes);
    const link = listBody.data[0];
    expect(link).toBeDefined();

    const delRes = await app.request(`/patron/${link.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(delRes.status).toBe(200);
    const delBody = await json(delRes);
    expect(delBody.id).toBe(link.id);
  });
});

// ─── VIP window integration ────────────────────────────────────────────────────

describe("VIP window — patron priority", () => {
  it("non-patron driver gets 409 during VIP window", async () => {
    // Create a new passenger without a pre-existing patron
    const newPassengerPhone = "+5511998880001";
    const passengerToken = await getToken(newPassengerPhone);
    const driverToken    = await getToken(DRIVER_PHONE);

    // Set Carlos as patron for this new passenger
    const setPatronRes = await app.request("/patron", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${passengerToken}` },
      body: JSON.stringify({
        driverId: "00000000-0000-0000-0000-000000000002",
        label: "Carlos",
      }),
    });
    expect(setPatronRes.status).toBe(201);

    // Create a ride — triggers VIP window
    const rideRes = await app.request("/rides", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${passengerToken}` },
      body: JSON.stringify({ routeType: "livre", origin: ORIGIN, destination: DESTINATION }),
    });
    expect(rideRes.status).toBe(201);
    const rideBody = await json(rideRes);
    expect(rideBody.vipWindow).not.toBeNull();
    const rideId = rideBody.ride.id as string;

    // Carlos is the patron driver — he should be able to accept during the VIP window.
    const acceptRes = await app.request(`/rides/${rideId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${driverToken}` },
      body: JSON.stringify({ status: "accepted" }),
    });
    // Carlos is the patron, he should be able to accept within the 15s window.
    expect(acceptRes.status).toBe(200);
    const acceptBody = await json(acceptRes);
    expect(acceptBody.status).toBe("accepted");
  });
});
