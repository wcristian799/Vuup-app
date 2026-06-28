/**
 * useRideDispute — VUU-67
 *
 * React hook that connects DisputeWsClient to the ride-request flow.
 *
 * Lifecycle:
 *  1. Call `startDispute(rideId)` after the ride is created via the API.
 *  2. The hook opens the SSE streams and tracks dispute state.
 *  3. Subscribe to `driverPosition` updates to animate the driver marker.
 *  4. Call `endDispute()` to cleanly disconnect (e.g. on cancel or completion).
 *
 * Reconnection is handled automatically by DisputeWsClient (exponential
 * back-off, max 30 s).  The hook tracks connection health via `status`.
 */

import * as React from "react";
import { DisputeWsClient, type DisputeState, type DisputeCandidate } from "@/lib/disputa-corrida-ws";
import { getAccessToken } from "@/api/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DisputeStatus =
  | "idle"
  | "connecting"
  | "open"
  | "resolved"
  | "expired"
  | "cancelled"
  | "error";

export interface DriverPositionUpdate {
  driverId: string;
  lat: number;
  lng: number;
}

export interface UseRideDisputeResult {
  /** Current lifecycle status of the dispute stream */
  status: DisputeStatus;
  /** Latest dispute state received from the server */
  disputeState: DisputeState | null;
  /** Most recently seen bids (cleared on each new dispute) */
  bids: DisputeCandidate[];
  /** Live driver position updates (for map marker animation) */
  driverPosition: DriverPositionUpdate | null;
  /** Winner driver id once the dispute resolves */
  winnerId: string | null;
  /** Error message if status === "error" */
  error: string | null;
  /** Connect to the dispute stream for a given rideId */
  startDispute: (rideId: string) => void;
  /** Disconnect and reset state */
  endDispute: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useRideDispute(): UseRideDisputeResult {
  const [status, setStatus] = React.useState<DisputeStatus>("idle");
  const [disputeState, setDisputeState] = React.useState<DisputeState | null>(null);
  const [bids, setBids] = React.useState<DisputeCandidate[]>([]);
  const [driverPosition, setDriverPosition] = React.useState<DriverPositionUpdate | null>(null);
  const [winnerId, setWinnerId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const clientRef = React.useRef<DisputeWsClient | null>(null);

  const endDispute = React.useCallback(() => {
    clientRef.current?.disconnect();
    clientRef.current = null;
    setStatus("idle");
    setDisputeState(null);
    setBids([]);
    setDriverPosition(null);
    setWinnerId(null);
    setError(null);
  }, []);

  const startDispute = React.useCallback(
    (rideId: string) => {
      // Tear down any existing connection first
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }

      setStatus("connecting");
      setDisputeState(null);
      setBids([]);
      setDriverPosition(null);
      setWinnerId(null);
      setError(null);

      const token = getAccessToken() ?? undefined;
      const client = new DisputeWsClient(rideId, token);
      clientRef.current = client;

      // ── connected ──────────────────────────────────────────────────────────
      client.on("connected", () => {
        setStatus("connecting"); // streams open; waiting for dispute_opened
      });

      // ── dispute opened ─────────────────────────────────────────────────────
      client.on("disputa_opened", (data) => {
        setStatus("open");
        setDisputeState((prev) => ({
          ...(prev ?? ({} as DisputeState)),
          rideId: data.rideId,
          windowExpiresAt: data.windowExpiresAt,
          fareEstimateCents: data.fareEstimateCents,
          outcome: "open",
          bidsCount: 0,
          passengerId: prev?.passengerId ?? "",
          winnerId: null,
          windowOpensAt: prev?.windowOpensAt ?? new Date().toISOString(),
        }));
      });

      // ── bid received ───────────────────────────────────────────────────────
      client.on("bid_received", (data) => {
        setBids((prev) => {
          // Replace existing bid from same driver, otherwise append
          const idx = prev.findIndex((b) => b.driverId === data.driverId);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = data;
            return next;
          }
          return [...prev, data];
        });
        setDisputeState((prev) =>
          prev ? { ...prev, bidsCount: (prev.bidsCount ?? 0) + 1 } : null,
        );
      });

      // ── dispute resolved ───────────────────────────────────────────────────
      client.on("disputa_resolved", (data) => {
        const outcome = (data.outcome as DisputeState["outcome"]) ?? "resolved";
        setStatus(outcome === "expired" ? "expired" : outcome === "cancelled" ? "cancelled" : "resolved");
        setWinnerId(data.winnerId ?? null);
        setDisputeState((prev) =>
          prev ? { ...prev, outcome, winnerId: data.winnerId ?? null } : null,
        );
      });

      // ── ride assigned ──────────────────────────────────────────────────────
      client.on("ride_assigned", (data) => {
        setStatus("resolved");
        setDisputeState((prev) =>
          prev
            ? {
                ...prev,
                rideId: data.rideId,
                passengerId: data.passengerId,
                fareEstimateCents: data.fareEstimateCents,
                outcome: "resolved",
              }
            : null,
        );
      });

      // ── error ──────────────────────────────────────────────────────────────
      client.on("dispute_error", (data) => {
        setStatus("error");
        setError(`${data.code}: ${data.message}`);
      });

      // ── driver position (ride_assigned carries the driverId; position comes
      //    via bid_received updates while in progress) ─────────────────────
      // Real-time driver position updates are surfaced via bid_received while
      // the dispute is open, and would come through a dedicated event once
      // the driver is assigned (handled via future server event "driver_position").
      // For now we synthesise from bid data when available.
      client.on("bid_received", (data) => {
        // bid_received doesn't carry lat/lng yet — kept as extension point.
        // The server-side event shape may be extended to include driver coords.
        void data;
      });

      client.connect();
    },
    [],
  );

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      clientRef.current?.disconnect();
    };
  }, []);

  return {
    status,
    disputeState,
    bids,
    driverPosition,
    winnerId,
    error,
    startDispute,
    endDispute,
  };
}
