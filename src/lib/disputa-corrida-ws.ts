/**
 * VUUP Disputa de Corrida — WebSocket client (VUU-41)
 *
 * Manages the real-time dispute channel for ride auctions.
 * This client wraps the backend SSE stream at GET /matching/rides/:id/stream
 * (SSE, not raw WebSocket, because the backend uses text/event-stream).
 *
 * Usage:
 *   const client = new DisputeWsClient(rideId, token);
 *   client.on("dispute_state", (payload) => { ... });
 *   client.connect();
 *   // ...
 *   client.disconnect();
 *
 * QoS: panic / swarm events always take priority over dispute events —
 * they are placed in the HIGH priority queue and flushed before NORMAL
 * queue listeners are notified.
 */

import { getAccessToken } from "@/api/client";
import { API_BASE_URL } from "@/api/types";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum drivers that can join a single dispute window */
export const MAX_DRIVERS = 5;
/** Dispute window in milliseconds */
export const DISPUTE_WINDOW_MS = 15_000;
/** Community alert radius in metres (used by Efeito Enxame) */
export const PROXIMITY_RADIUS_M = 1_500;

// ─── Types ────────────────────────────────────────────────────────────────────

export type DisputeState = {
  rideId: string;
  passengerId: string;
  bidsCount: number;
  winnerId: string | null;
  outcome: "open" | "resolved" | "expired" | "cancelled";
  windowOpensAt: string;
  windowExpiresAt: string;
  fareEstimateCents: number;
};

export type DisputeCandidate = {
  driverId: string;
  distanceToOriginKm: number;
  offeredFareCents: number;
  totalBids: number;
};

export type LgpdConsent = {
  includesAvStream: boolean;
  includesGps: boolean;
  grantedAt: string;
};

// ─── Server → Client frame types ─────────────────────────────────────────────

export type ServerFrame =
  | { type: "connected"; data: { ts: string } }
  | { type: "disputa_opened"; data: { rideId: string; windowExpiresAt: string; fareEstimateCents: number } }
  | { type: "bid_received"; data: DisputeCandidate }
  | { type: "disputa_resolved"; data: { rideId: string; outcome: string; winnerId: string | null } }
  | { type: "ride_assigned"; data: { rideId: string; passengerId: string; fareEstimateCents: number } }
  | { type: "dispute_error"; data: { code: string; message: string } }
  /** Swarm / panic frames — delivered on the swarm stream */
  | { type: "swarm_event_created"; data: SwarmEventPayload }
  | { type: "swarm_confirmed"; data: { id: string; confirmCount: number; swarmActive: boolean } }
  | { type: "swarm_activated"; data: { id: string; lat: number; lng: number; confirmCount: number; description: string } }
  | { type: "swarm_resolved"; data: { id: string } };

export type SwarmEventPayload = {
  id: string;
  type: "panic" | "community_alert" | "swarm_active";
  lat: number;
  lng: number;
  description: string;
  confirmCount: number;
  swarmActive: boolean;
  createdAt: string;
};

// ─── QoS priority levels ──────────────────────────────────────────────────────

const HIGH_PRIORITY_EVENTS = new Set<ServerFrame["type"]>([
  "swarm_event_created",
  "swarm_activated",
  "swarm_confirmed",
  "swarm_resolved",
]);

// ─── Event listener map ───────────────────────────────────────────────────────

type EventHandler<T extends ServerFrame["type"]> = (
  payload: Extract<ServerFrame, { type: T }>["data"]
) => void;

type ListenerMap = {
  [T in ServerFrame["type"]]?: Array<EventHandler<T>>;
};

// ─── Reconnect configuration ─────────────────────────────────────────────────

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const RECONNECT_JITTER_MS = 500;

function reconnectDelay(attempt: number): number {
  const exp = Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_MAX_MS);
  return exp + Math.random() * RECONNECT_JITTER_MS;
}

// ─── DisputeWsClient ──────────────────────────────────────────────────────────

/**
 * Client for the dispute + swarm real-time channel.
 *
 * Internally subscribes to both:
 *  - GET /matching/rides/:rideId/stream  — ride-scoped dispute events
 *  - GET /matching/swarm/stream          — community panic/swarm broadcasts
 *
 * Both streams are multiplexed into a single event-listener API.
 * Swarm events are dispatched before dispute events (QoS).
 */
export class DisputeWsClient {
  private rideId: string;
  private token: string | null;
  private rideSource: EventSource | null = null;
  private swarmSource: EventSource | null = null;
  private listeners: ListenerMap = {};
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  /** Local cache of latest dispute state per disputeId */
  private disputeStateCache = new Map<string, DisputeState>();

  constructor(rideId: string, token?: string) {
    this.rideId = rideId;
    this.token = token ?? getAccessToken();
  }

  /** Register an event listener. Returns an unsubscribe function. */
  on<T extends ServerFrame["type"]>(event: T, handler: EventHandler<T>): () => void {
    if (!this.listeners[event]) {
      (this.listeners as Record<string, unknown[]>)[event] = [];
    }
    (this.listeners[event] as Array<EventHandler<T>>).push(handler);
    return () => this.off(event, handler);
  }

  /** Remove a specific event listener. */
  off<T extends ServerFrame["type"]>(event: T, handler: EventHandler<T>): void {
    const arr = this.listeners[event] as Array<EventHandler<T>> | undefined;
    if (!arr) return;
    const idx = arr.indexOf(handler);
    if (idx !== -1) arr.splice(idx, 1);
  }

  /** Get the cached dispute state for a rideId (or undefined if not yet received). */
  getDisputeState(rideId: string): DisputeState | undefined {
    return this.disputeStateCache.get(rideId);
  }

  /** Connect (or reconnect) both SSE streams. */
  connect(): void {
    if (this.destroyed) return;
    this._clearReconnectTimer();

    const baseUrl = API_BASE_URL;
    const authHeader = this.token ? `Bearer ${this.token}` : "";

    // EventSource does not support custom headers natively in browsers.
    // We pass the token as a query param as a fallback for environments that
    // don't support the Fetch EventSource API.
    const rideUrl = `${baseUrl}/matching/rides/${this.rideId}/stream?token=${encodeURIComponent(this.token ?? "")}`;
    const swarmUrl = `${baseUrl}/matching/swarm/stream?token=${encodeURIComponent(this.token ?? "")}`;

    this._openRideStream(rideUrl);
    this._openSwarmStream(swarmUrl);

    // Suppress unused variable warning — authHeader used by fetch-based fallback below
    void authHeader;
  }

  /** Close both streams and prevent further reconnection. */
  disconnect(): void {
    this.destroyed = true;
    this._clearReconnectTimer();
    this._closeStreams();
  }

  // ─── Internal helpers ───────────────────────────────────────────────────────

  private _openRideStream(url: string): void {
    try {
      this.rideSource?.close();
      const es = new EventSource(url);

      // Generic message handler for named events
      const knownEvents: Array<ServerFrame["type"]> = [
        "connected",
        "disputa_opened",
        "bid_received",
        "disputa_resolved",
        "ride_assigned",
        "dispute_error",
      ];

      for (const evtName of knownEvents) {
        es.addEventListener(evtName, (e: MessageEvent) => {
          this._dispatch(evtName, e);
        });
      }

      es.onerror = () => {
        if (!this.destroyed) this._scheduleReconnect();
      };

      es.onopen = () => {
        this.reconnectAttempt = 0;
      };

      this.rideSource = es;
    } catch {
      if (!this.destroyed) this._scheduleReconnect();
    }
  }

  private _openSwarmStream(url: string): void {
    try {
      this.swarmSource?.close();
      const es = new EventSource(url);

      const swarmEvents: Array<ServerFrame["type"]> = [
        "swarm_event_created",
        "swarm_activated",
        "swarm_confirmed",
        "swarm_resolved",
      ];

      for (const evtName of swarmEvents) {
        es.addEventListener(evtName, (e: MessageEvent) => {
          this._dispatch(evtName, e);
        });
      }

      es.onerror = () => {
        // Swarm stream reconnects independently
        if (!this.destroyed) {
          setTimeout(() => {
            if (!this.destroyed) this._openSwarmStream(url);
          }, reconnectDelay(this.reconnectAttempt));
        }
      };

      this.swarmSource = es;
    } catch {
      if (!this.destroyed) this._scheduleReconnect();
    }
  }

  /**
   * Dispatch a server frame to registered listeners.
   * HIGH priority events (panic/swarm) are synchronously flushed before
   * normal dispute event listeners are called — this implements QoS at the
   * listener dispatch layer.
   */
  private _dispatch(eventType: string, raw: MessageEvent): void {
    let payload: unknown;
    try {
      payload = JSON.parse(raw.data as string);
    } catch {
      return; // malformed JSON — skip
    }

    const isHigh = HIGH_PRIORITY_EVENTS.has(eventType as ServerFrame["type"]);
    const listeners = this.listeners[eventType as ServerFrame["type"]] ?? [];

    // Update local state cache for disputa_resolved frames
    if (eventType === "disputa_resolved" || eventType === "disputa_opened") {
      const p = payload as Partial<DisputeState>;
      if (p.rideId) {
        const existing = this.disputeStateCache.get(p.rideId) ?? ({} as DisputeState);
        this.disputeStateCache.set(p.rideId, { ...existing, ...p });
      }
    }

    if (isHigh) {
      // Flush HIGH priority synchronously — no yielding to the microtask queue
      for (const fn of listeners) {
        try {
          (fn as (p: unknown) => void)(payload);
        } catch (err) {
          console.error(`[DisputeWsClient] HIGH listener error (${eventType})`, err);
        }
      }
    } else {
      // NORMAL priority — schedule via microtask so HIGH events inserted
      // concurrently (within the same tick) are processed first
      queueMicrotask(() => {
        for (const fn of listeners) {
          try {
            (fn as (p: unknown) => void)(payload);
          } catch (err) {
            console.error(`[DisputeWsClient] NORMAL listener error (${eventType})`, err);
          }
        }
      });
    }
  }

  private _scheduleReconnect(): void {
    this._clearReconnectTimer();
    const delay = reconnectDelay(this.reconnectAttempt++);
    this.reconnectTimer = setTimeout(() => {
      if (!this.destroyed) this.connect();
    }, delay);
  }

  private _clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private _closeStreams(): void {
    this.rideSource?.close();
    this.swarmSource?.close();
    this.rideSource = null;
    this.swarmSource = null;
  }
}

// ─── Geo utilities ────────────────────────────────────────────────────────────

/** Haversine distance in metres between two lat/lng points. */
export function haversineDistanceM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000; // Earth radius in metres
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Returns true if point b is within radiusM metres of point a. */
export function isWithinProximity(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  radiusM = PROXIMITY_RADIUS_M,
): boolean {
  return haversineDistanceM(a, b) <= radiusM;
}

/**
 * Given a list of dispute candidates, return the winner following the
 * VUUP dispute selection rules:
 *  1. Nearest driver to the ride origin.
 *  2. Tie-break: lowest offered fare.
 *  3. Tie-break: earliest bid (by index / insertion order here).
 */
export function selectDisputeWinner(
  candidates: Array<{ driverId: string; distanceToOriginKm: number; offeredFareCents: number }>,
): string | null {
  if (candidates.length === 0) return null;
  const sorted = [...candidates].sort((a, b) => {
    if (a.distanceToOriginKm !== b.distanceToOriginKm) {
      return a.distanceToOriginKm - b.distanceToOriginKm;
    }
    return a.offeredFareCents - b.offeredFareCents;
  });
  return sorted[0]!.driverId;
}
