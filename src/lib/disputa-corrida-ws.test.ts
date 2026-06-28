/**
 * VUU-41 — disputa-corrida-ws.ts unit tests
 *
 * Tests:
 *  1. Haversine distance calculation
 *  2. isWithinProximity gate
 *  3. selectDisputeWinner algorithm
 *  4. DisputeWsClient — event listener management (on/off/unsubscribe)
 *  5. DisputeWsClient — dispute state cache update
 *  6. DisputeWsClient — QoS: swarm events dispatch before dispute events
 *  7. DisputeWsClient — reconnect timer management
 *  8. Constants sanity checks
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  haversineDistanceM,
  isWithinProximity,
  selectDisputeWinner,
  DisputeWsClient,
  MAX_DRIVERS,
  DISPUTE_WINDOW_MS,
  PROXIMITY_RADIUS_M,
} from "./disputa-corrida-ws";

// ─── Mock EventSource ─────────────────────────────────────────────────────────

type EventListener = (e: MessageEvent) => void;

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  private eventListeners: Map<string, EventListener[]> = new Map();
  onerror: (() => void) | null = null;
  onopen: (() => void) | null = null;
  readyState = 1; // OPEN

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, fn: EventListener) {
    if (!this.eventListeners.has(type)) this.eventListeners.set(type, []);
    this.eventListeners.get(type)!.push(fn);
  }

  removeEventListener(type: string, fn: EventListener) {
    const arr = this.eventListeners.get(type);
    if (!arr) return;
    const idx = arr.indexOf(fn);
    if (idx !== -1) arr.splice(idx, 1);
  }

  /** Simulate a named SSE event from the server */
  emit(type: string, data: unknown) {
    const fns = this.eventListeners.get(type) ?? [];
    const evt = { data: JSON.stringify(data) } as MessageEvent;
    for (const fn of fns) fn(evt);
  }

  close() {
    this.readyState = 2; // CLOSED
  }
}

// ─── Test setup ───────────────────────────────────────────────────────────────

beforeEach(() => {
  MockEventSource.instances = [];
  vi.stubGlobal("EventSource", MockEventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ─── Geo utilities ────────────────────────────────────────────────────────────

describe("haversineDistanceM", () => {
  it("returns 0 for identical points", () => {
    expect(haversineDistanceM({ lat: -23.55, lng: -46.63 }, { lat: -23.55, lng: -46.63 })).toBe(0);
  });

  it("approximates ~111 km per degree of latitude", () => {
    const d = haversineDistanceM({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it("is symmetric", () => {
    const a = { lat: -23.55, lng: -46.63 };
    const b = { lat: -23.56, lng: -46.64 };
    expect(haversineDistanceM(a, b)).toBeCloseTo(haversineDistanceM(b, a), 1);
  });

  it("correctly handles same latitude — only lng difference", () => {
    // At equator: 1 degree ≈ 111.19 km
    const d = haversineDistanceM({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });
});

describe("isWithinProximity", () => {
  const origin = { lat: -23.5505, lng: -46.6333 };

  it("returns true for a point within 1.5 km", () => {
    // 0.005 deg ≈ 550 m
    expect(isWithinProximity(origin, { lat: -23.555, lng: -46.633 })).toBe(true);
  });

  it("returns false for a point beyond 1.5 km", () => {
    // 0.02 deg ≈ 2.2 km
    expect(isWithinProximity(origin, { lat: -23.57, lng: -46.633 })).toBe(false);
  });

  it("respects custom radius", () => {
    const far = { lat: -23.6, lng: -46.63 }; // ~5.5 km
    expect(isWithinProximity(origin, far, 10_000)).toBe(true);
    expect(isWithinProximity(origin, far, 1_000)).toBe(false);
  });

  it("returns true at exactly 0 m", () => {
    expect(isWithinProximity(origin, origin)).toBe(true);
  });
});

// ─── selectDisputeWinner ─────────────────────────────────────────────────────

describe("selectDisputeWinner", () => {
  it("returns null for empty candidate list", () => {
    expect(selectDisputeWinner([])).toBeNull();
  });

  it("picks the single candidate when only one", () => {
    const w = selectDisputeWinner([
      { driverId: "a", distanceToOriginKm: 1, offeredFareCents: 1000 },
    ]);
    expect(w).toBe("a");
  });

  it("picks nearest driver", () => {
    const w = selectDisputeWinner([
      { driverId: "far", distanceToOriginKm: 5, offeredFareCents: 900 },
      { driverId: "near", distanceToOriginKm: 1, offeredFareCents: 1000 },
      { driverId: "mid", distanceToOriginKm: 3, offeredFareCents: 950 },
    ]);
    expect(w).toBe("near");
  });

  it("breaks distance tie by lowest fare", () => {
    const w = selectDisputeWinner([
      { driverId: "expensive", distanceToOriginKm: 1, offeredFareCents: 1000 },
      { driverId: "cheap", distanceToOriginKm: 1, offeredFareCents: 800 },
    ]);
    expect(w).toBe("cheap");
  });

  it("breaks distance+fare tie by insertion order", () => {
    const w = selectDisputeWinner([
      { driverId: "first", distanceToOriginKm: 1, offeredFareCents: 800 },
      { driverId: "second", distanceToOriginKm: 1, offeredFareCents: 800 },
    ]);
    expect(w).toBe("first");
  });

  it("works with 5 candidates (MAX_DRIVERS)", () => {
    const candidates = Array.from({ length: 5 }, (_, i) => ({
      driverId: `d${i}`,
      distanceToOriginKm: 5 - i, // d4 is nearest
      offeredFareCents: 1000,
    }));
    expect(selectDisputeWinner(candidates)).toBe("d4");
  });
});

// ─── DisputeWsClient — listener management ───────────────────────────────────

describe("DisputeWsClient — listener management", () => {
  it("registers and calls an event listener", async () => {
    const client = new DisputeWsClient("ride-1", "tok");
    client.connect();

    const handler = vi.fn();
    client.on("bid_received", handler);

    // Simulate SSE event on ride stream
    const [rideSource] = MockEventSource.instances;
    rideSource!.emit("bid_received", {
      driverId: "d1",
      distanceToOriginKm: 0.5,
      offeredFareCents: 900,
      totalBids: 1,
    });

    // Flush microtasks
    await new Promise((r) => setTimeout(r, 0));

    expect(handler).toHaveBeenCalledWith({
      driverId: "d1",
      distanceToOriginKm: 0.5,
      offeredFareCents: 900,
      totalBids: 1,
    });

    client.disconnect();
  });

  it("unsubscribes correctly via returned cleanup fn", async () => {
    const client = new DisputeWsClient("ride-2", "tok");
    client.connect();

    const handler = vi.fn();
    const unsub = client.on("disputa_resolved", handler);
    unsub();

    const [rideSource] = MockEventSource.instances;
    rideSource!.emit("disputa_resolved", { rideId: "ride-2", outcome: "resolved", winnerId: "d1" });
    await new Promise((r) => setTimeout(r, 0));

    expect(handler).not.toHaveBeenCalled();
    client.disconnect();
  });

  it("off() removes a specific listener", async () => {
    const client = new DisputeWsClient("ride-3", "tok");
    client.connect();

    const h1 = vi.fn();
    const h2 = vi.fn();
    client.on("disputa_opened", h1);
    client.on("disputa_opened", h2);
    client.off("disputa_opened", h1);

    const [rideSource] = MockEventSource.instances;
    rideSource!.emit("disputa_opened", {
      rideId: "ride-3",
      windowExpiresAt: "2099-01-01T00:00:00Z",
      fareEstimateCents: 1200,
    });
    await new Promise((r) => setTimeout(r, 0));

    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalled();

    client.disconnect();
  });
});

// ─── DisputeWsClient — state cache ───────────────────────────────────────────

describe("DisputeWsClient — dispute state cache", () => {
  it("caches state on disputa_opened", async () => {
    const client = new DisputeWsClient("ride-4", "tok");
    client.connect();

    const [rideSource] = MockEventSource.instances;
    rideSource!.emit("disputa_opened", {
      rideId: "ride-4",
      windowExpiresAt: "2099-01-01T00:00:00Z",
      fareEstimateCents: 1500,
    });
    await new Promise((r) => setTimeout(r, 0));

    const state = client.getDisputeState("ride-4");
    expect(state).toBeDefined();
    expect(state!.fareEstimateCents).toBe(1500);

    client.disconnect();
  });

  it("updates cache on disputa_resolved", async () => {
    const client = new DisputeWsClient("ride-5", "tok");
    client.connect();

    const [rideSource] = MockEventSource.instances;
    rideSource!.emit("disputa_resolved", {
      rideId: "ride-5",
      outcome: "resolved",
      winnerId: "winner-driver",
    });
    await new Promise((r) => setTimeout(r, 0));

    const state = client.getDisputeState("ride-5");
    expect(state?.winnerId).toBe("winner-driver");
    expect(state?.outcome).toBe("resolved");

    client.disconnect();
  });
});

// ─── DisputeWsClient — QoS ───────────────────────────────────────────────────

describe("DisputeWsClient — QoS (panic > dispute events)", () => {
  it("swarm_activated calls handler synchronously (HIGH priority)", () => {
    const client = new DisputeWsClient("ride-6", "tok");
    client.connect();

    const callOrder: string[] = [];

    // Normal priority
    client.on("bid_received", () => callOrder.push("bid"));
    // High priority
    client.on("swarm_activated", () => callOrder.push("swarm"));

    const rideSource = MockEventSource.instances[0]!;
    const swarmSource = MockEventSource.instances[1]!;

    // Emit normal first, then high
    rideSource.emit("bid_received", {
      driverId: "d1",
      distanceToOriginKm: 0.5,
      offeredFareCents: 900,
      totalBids: 1,
    });
    swarmSource.emit("swarm_activated", {
      id: "sw1",
      lat: -23.55,
      lng: -46.63,
      confirmCount: 3,
      description: "Panic",
    });

    // Swarm handler should be called synchronously, bid handler via microtask
    expect(callOrder).toEqual(["swarm"]);

    client.disconnect();
  });

  it("swarm_event_created is dispatched synchronously (HIGH priority)", () => {
    const client = new DisputeWsClient("ride-7", "tok");
    client.connect();

    const called = vi.fn();
    client.on("swarm_event_created", called);

    const swarmSource = MockEventSource.instances[1]!;
    swarmSource.emit("swarm_event_created", {
      id: "sw2",
      type: "panic",
      lat: -23.55,
      lng: -46.63,
      description: "Emergency",
      confirmCount: 1,
      swarmActive: false,
      createdAt: new Date().toISOString(),
    });

    expect(called).toHaveBeenCalledTimes(1);
    client.disconnect();
  });
});

// ─── DisputeWsClient — reconnect ─────────────────────────────────────────────

describe("DisputeWsClient — reconnect on error", () => {
  it("disconnect prevents reconnect after error", () => {
    vi.useFakeTimers();
    const client = new DisputeWsClient("ride-8", "tok");
    client.connect();

    const initialCount = MockEventSource.instances.length;

    // Disconnect before triggering error
    client.disconnect();

    const [rideSource] = MockEventSource.instances;
    rideSource!.onerror?.();

    // Advance timers — no new EventSource should be created
    vi.advanceTimersByTime(10_000);

    expect(MockEventSource.instances.length).toBe(initialCount);
  });
});

// ─── Constants ────────────────────────────────────────────────────────────────

describe("Constants sanity checks", () => {
  it("MAX_DRIVERS is 5", () => expect(MAX_DRIVERS).toBe(5));
  it("DISPUTE_WINDOW_MS is 15 seconds", () => expect(DISPUTE_WINDOW_MS).toBe(15_000));
  it("PROXIMITY_RADIUS_M is 1.5 km", () => expect(PROXIMITY_RADIUS_M).toBe(1_500));
});
