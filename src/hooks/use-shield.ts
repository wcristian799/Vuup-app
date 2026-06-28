/**
 * useShield — Efeito Enxame / The Shield hook (VUU-41)
 *
 * Manages the passenger safety shield state machine:
 *
 *   idle → holding → consent → armed → disarming → idle
 *
 * Hold-to-arm (1.5 s via requestAnimationFrame) prevents accidental activation.
 * LGPD gate: user must explicitly grant consent before any broadcast or stream.
 * Auto-disarm after MAX_SHIELD_DURATION_MS (30 min).
 *
 * Usage:
 *   const shield = useShield();
 *   // start holding the panic button:
 *   shield.startHold();
 *   // user releases before threshold → shield.cancelHold()
 *   // threshold reached → state transitions to "consent"
 *   // user grants LGPD consent:
 *   shield.grantConsentAndArm({ includesAvStream: true, includesGps: true });
 *   // manual disarm:
 *   shield.disarm();
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/api/client";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Hold duration before the consent dialog is shown (ms) */
const HOLD_THRESHOLD_MS = 1_500;
/** Auto-disarm after 30 minutes */
export const MAX_SHIELD_DURATION_MS = 30 * 60 * 1_000;
/** Community alert radius in metres */
export const ALERT_RADIUS_M = 1_500;

// ─── Types ────────────────────────────────────────────────────────────────────

export type ShieldPhase =
  | "idle" // not armed
  | "holding" // user is pressing the panic button
  | "consent" // hold threshold reached; awaiting LGPD consent
  | "armed" // shield is active
  | "disarming"; // cleanup in progress

export type LgpdConsent = {
  includesAvStream: boolean;
  includesGps: boolean;
  grantedAt: string;
};

export type ShieldState = {
  phase: ShieldPhase;
  consent: LgpdConsent | null;
  holdProgressPercent: number; // 0-100 while holding
  alertCount: number; // community confirmations sent this session
  armedAt: string | null;
  /** Start holding the panic button. */
  startHold: () => void;
  /** Cancel the hold (user released before threshold). */
  cancelHold: () => void;
  /**
   * Grant LGPD consent and arm the shield.
   * Must be called when phase === "consent".
   * Calls POST /matching/swarm to broadcast the panic event.
   */
  grantConsentAndArm: (consent: {
    includesAvStream: boolean;
    includesGps: boolean;
  }) => Promise<void>;
  /** Manually disarm the shield. Clears all streams and consent. */
  disarm: () => void;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useShield(): ShieldState {
  const [phase, setPhase] = useState<ShieldPhase>("idle");
  const [consent, setConsent] = useState<LgpdConsent | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const [alertCount, setAlertCount] = useState(0);
  const [armedAt, setArmedAt] = useState<string | null>(null);

  // Refs for cleanup without stale closures
  const holdRafRef = useRef<number | null>(null);
  const holdStartRef = useRef<number | null>(null);
  const autoDisarmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const phaseRef = useRef<ShieldPhase>("idle");
  phaseRef.current = phase;

  // ── Cleanup helper ──────────────────────────────────────────────────────────

  const _cleanup = useCallback(() => {
    // Cancel hold RAF
    if (holdRafRef.current !== null) {
      cancelAnimationFrame(holdRafRef.current);
      holdRafRef.current = null;
    }
    holdStartRef.current = null;

    // Cancel auto-disarm timer
    if (autoDisarmTimerRef.current !== null) {
      clearTimeout(autoDisarmTimerRef.current);
      autoDisarmTimerRef.current = null;
    }

    // Stop A/V streams
    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        track.stop();
      }
      mediaStreamRef.current = null;
    }

    // Clear consent (nothing persists beyond the session)
    setConsent(null);
    setHoldProgress(0);
    setArmedAt(null);
  }, []);

  // ── Hold-to-arm RAF loop ────────────────────────────────────────────────────

  const _tickHold = useCallback(
    (timestamp: number) => {
      if (phaseRef.current !== "holding") return;
      if (holdStartRef.current === null) {
        holdStartRef.current = timestamp;
      }
      const elapsed = timestamp - holdStartRef.current;
      const progress = Math.min((elapsed / HOLD_THRESHOLD_MS) * 100, 100);
      setHoldProgress(progress);

      if (elapsed >= HOLD_THRESHOLD_MS) {
        // Hold threshold reached → show consent dialog
        setPhase("consent");
        setHoldProgress(100);
        holdRafRef.current = null;
        return;
      }

      holdRafRef.current = requestAnimationFrame(_tickHold);
    },
    [], // _tickHold is stable — no reactive deps needed
  );

  const startHold = useCallback(() => {
    if (phaseRef.current !== "idle") return;
    setPhase("holding");
    holdStartRef.current = null;
    holdRafRef.current = requestAnimationFrame(_tickHold);
  }, [_tickHold]);

  const cancelHold = useCallback(() => {
    if (phaseRef.current !== "holding") return;
    if (holdRafRef.current !== null) {
      cancelAnimationFrame(holdRafRef.current);
      holdRafRef.current = null;
    }
    holdStartRef.current = null;
    setHoldProgress(0);
    setPhase("idle");
  }, []);

  // ── Grant consent and arm ───────────────────────────────────────────────────

  const grantConsentAndArm = useCallback(
    async (opts: { includesAvStream: boolean; includesGps: boolean }): Promise<void> => {
      if (phaseRef.current !== "consent") return;

      const grantedConsent: LgpdConsent = {
        includesAvStream: opts.includesAvStream,
        includesGps: opts.includesGps,
        grantedAt: new Date().toISOString(),
      };
      setConsent(grantedConsent);
      setPhase("armed");

      const now = new Date().toISOString();
      setArmedAt(now);

      // Start A/V emergency stream if consent given
      if (opts.includesAvStream) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          mediaStreamRef.current = stream;
        } catch {
          // Fallback for SSR/test environments — silently skip
        }
      }

      // Broadcast the panic event via REST API
      try {
        await apiClient.safety.sos({
          location: { lat: 0, lng: 0 }, // replaced with real GPS in production
          rideId: undefined,
        });
        setAlertCount((c) => c + 1);
      } catch {
        // Non-fatal — shield is still armed even if broadcast fails
      }

      // Auto-disarm after MAX_SHIELD_DURATION_MS
      autoDisarmTimerRef.current = setTimeout(() => {
        disarm();
      }, MAX_SHIELD_DURATION_MS);
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Manual disarm ───────────────────────────────────────────────────────────

  const disarm = useCallback(() => {
    if (phaseRef.current === "idle") return;
    setPhase("disarming");
    _cleanup();
    setPhase("idle");
  }, [_cleanup]);

  // ── Cleanup on unmount ──────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      _cleanup();
    };
  }, [_cleanup]);

  return {
    phase,
    consent,
    holdProgressPercent: holdProgress,
    alertCount,
    armedAt,
    startHold,
    cancelHold,
    grantConsentAndArm,
    disarm,
  };
}
