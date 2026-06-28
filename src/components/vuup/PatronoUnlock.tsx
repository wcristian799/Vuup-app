import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * PatronoUnlock — full-screen celebration overlay for first Patrono unlock.
 *
 * Spec (PatronoCardSpec.unlockAnimation):
 * 1. Full-screen overlay: gold/10, z-index modal
 * 2. Patrono shield morphs in (duration 900ms, slowReveal)
 * 3. 20 gold particles radial burst, 4–8px, fade 1200ms
 * 4. "Bem-vindo, Patrono" text fades in
 * 5. Auto-dismiss after 3s or tap anywhere
 *
 * Respects prefers-reduced-motion (skips particles, instant fade-in).
 */

interface Particle {
  id: number;
  x: number; // center offset px
  y: number;
  size: number;
  angle: number;
  distance: number;
}

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: 0,
    y: 0,
    size: 4 + Math.random() * 4,
    angle: (i / count) * 2 * Math.PI,
    distance: 60 + Math.random() * 80,
  }));
}

interface PatronoUnlockProps {
  onDismiss: () => void;
}

export function PatronoUnlock({ onDismiss }: PatronoUnlockProps) {
  const [phase, setPhase] = React.useState<"enter" | "show" | "exit">("enter");
  const [particlesActive, setParticlesActive] = React.useState(false);
  const PARTICLES = React.useMemo(() => generateParticles(20), []);

  const prefersReduced = React.useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  React.useEffect(() => {
    // Phase: enter → show
    const t1 = setTimeout(() => setPhase("show"), 50);
    // Launch particles after shield appears
    const t2 = setTimeout(() => setParticlesActive(true), prefersReduced ? 0 : 600);
    // Auto-dismiss after 3s
    const t3 = setTimeout(() => {
      setPhase("exit");
      setTimeout(onDismiss, 500);
    }, 3000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onDismiss, prefersReduced]);

  const handleTap = () => {
    setPhase("exit");
    setTimeout(onDismiss, 400);
  };

  const isVisible = phase === "show";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center cursor-pointer"
      style={{
        background: "oklch(0.84 0.16 88 / 0.10)",
        backdropFilter: "blur(4px)",
        opacity: phase === "exit" ? 0 : 1,
        transition: "opacity 400ms ease",
      }}
      onClick={handleTap}
      role="dialog"
      aria-modal="true"
      aria-label="Você se tornou Patrono! Toque para fechar"
    >
      {/* Patrono shield SVG */}
      <div
        style={{
          transform: isVisible ? "scale(1)" : "scale(0.5)",
          opacity: isVisible ? 1 : 0,
          transition: prefersReduced
            ? "none"
            : "transform 900ms cubic-bezier(0.16, 1, 0.3, 1), opacity 600ms ease",
        }}
        className="relative mb-6"
      >
        {/* Particles */}
        {!prefersReduced &&
          PARTICLES.map((p) => {
            const tx = Math.cos(p.angle) * p.distance;
            const ty = Math.sin(p.angle) * p.distance;
            return (
              <div
                key={p.id}
                aria-hidden="true"
                className="absolute rounded-full"
                style={{
                  width: p.size,
                  height: p.size,
                  background: "oklch(0.84 0.16 88)",
                  left: "50%",
                  top: "50%",
                  marginLeft: -p.size / 2,
                  marginTop: -p.size / 2,
                  transform: particlesActive ? `translate(${tx}px, ${ty}px)` : "translate(0, 0)",
                  opacity: particlesActive ? 0 : 1,
                  transition: particlesActive
                    ? `transform 1200ms cubic-bezier(0.2, 0.8, 0.4, 1) ${p.id * 30}ms, opacity 1200ms ease ${p.id * 20}ms`
                    : "none",
                }}
              />
            );
          })}

        {/* Gold shield SVG */}
        <svg width="120" height="135" viewBox="0 0 80 90" aria-hidden="true">
          <path
            d="M40 5 L72 18 L72 45 C72 63 57 78 40 85 C23 78 8 63 8 45 L8 18 Z"
            stroke="oklch(0.84 0.16 88)"
            strokeWidth="2"
            strokeLinejoin="round"
            fill="oklch(0.84 0.16 88 / 0.15)"
            style={{
              filter: "drop-shadow(0 0 12px oklch(0.84 0.16 88 / 0.7))",
            }}
          />
          {/* ✦ sparkle */}
          <text
            x="40"
            y="50"
            textAnchor="middle"
            dominantBaseline="middle"
            fill="oklch(0.84 0.16 88)"
            fontSize="20"
            fontFamily="'Space Grotesk', sans-serif"
            fontWeight="700"
          >
            ✦
          </text>
        </svg>
      </div>

      {/* Welcome text */}
      <div
        className="text-center px-6"
        style={{
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? "translateY(0)" : "translateY(20px)",
          transition: prefersReduced
            ? "none"
            : "opacity 600ms ease 400ms, transform 600ms ease 400ms",
        }}
      >
        <p
          className="font-display font-extrabold mb-2"
          style={{
            fontSize: "1.875rem",
            color: "oklch(0.84 0.16 88)",
            textShadow: "0 0 24px oklch(0.92 0.1 88 / 0.5)",
          }}
        >
          Bem-vindo, Patrono
        </p>
        <p className="text-sm text-muted-foreground">Você desbloqueou benefícios exclusivos</p>
        <p className="text-xs text-muted-foreground mt-4 opacity-60">Toque para continuar</p>
      </div>
    </div>
  );
}
