import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ShieldState = "safe" | "warning" | "danger" | "off";

interface CommunityMember {
  id: string;
  label: string;
  type: "driver" | "patron" | "passenger";
}

interface ShieldStatusProps {
  state: ShieldState;
  communityCount: number;
  communityMembers?: CommunityMember[];
  onSOSPress?: () => void;
  className?: string;
}

const STATE_COLORS: Record<ShieldState, string> = {
  safe: "stroke-electric fill-electric/10",
  warning: "stroke-gold fill-gold/10",
  danger: "stroke-danger fill-danger/15",
  off: "stroke-muted-foreground fill-none",
};

const MEMBER_COLORS: Record<CommunityMember["type"], string> = {
  driver: "bg-electric",
  patron: "bg-gold",
  passenger: "bg-ice",
};

/**
 * ShieldStatus — community safety shield with animated states and SOS button.
 * Respects prefers-reduced-motion.
 */
export function ShieldStatus({
  state,
  communityCount,
  communityMembers = [],
  onSOSPress,
  className,
}: ShieldStatusProps) {
  const prefersReduced = React.useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const [sosConfirmOpen, setSosConfirmOpen] = React.useState(false);
  const sosHoldTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSOSDown = () => {
    sosHoldTimer.current = setTimeout(() => {
      setSosConfirmOpen(true);
    }, 500);
  };

  const handleSOSUp = () => {
    if (sosHoldTimer.current) {
      clearTimeout(sosHoldTimer.current);
      sosHoldTimer.current = null;
    }
  };

  // Generate stable radial positions for community dots
  const dots = React.useMemo(() => {
    const visible = communityMembers.slice(0, 12);
    return visible.map((member, i) => {
      const angle = (i / 12) * 2 * Math.PI - Math.PI / 2;
      const radius = 100 + ((i * 7) % 80); // 100–180px
      const x = 50 + (radius / 2) * Math.cos(angle); // percent of container
      const y = 50 + (radius / 2) * Math.sin(angle);
      return { ...member, x, y, angle };
    });
  }, [communityMembers]);

  const shieldAnim = cn(
    !prefersReduced && state === "safe" && "animate-pulse [animation-duration:3000ms]",
    !prefersReduced && state === "warning" && "animate-pulse [animation-duration:1500ms]",
    !prefersReduced && state === "danger" && "animate-[pulse_600ms_ease-in-out_infinite]",
  );

  return (
    <div
      className={cn("relative flex flex-col items-center", className)}
      aria-label={`Estado do escudo: ${state}`}
    >
      {/* Community member dots */}
      <div
        className="relative h-64 w-64"
        aria-label={`${communityCount} membros da comunidade próximos`}
        role="img"
      >
        {/* Connection lines (SVG) */}
        <svg
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {dots.map((dot) => (
            <line
              key={`line-${dot.id}`}
              x1="50"
              y1="50"
              x2={dot.x}
              y2={dot.y}
              stroke="oklch(0.72 0.22 246)"
              strokeWidth="0.3"
              opacity="0.15"
            />
          ))}
        </svg>

        {/* Community dots */}
        {dots.map((dot, i) => (
          <div
            key={dot.id}
            className={cn(
              "absolute h-2.5 w-2.5 rounded-full",
              MEMBER_COLORS[dot.type],
              !prefersReduced && "animate-[float_3s_ease-in-out_infinite]",
            )}
            style={{
              left: `${dot.x}%`,
              top: `${dot.y}%`,
              transform: "translate(-50%, -50%)",
              animationDelay: `${i * 200}ms`,
              animationDuration: `${2000 + i * 200}ms`,
            }}
            title={dot.label}
            aria-hidden="true"
          />
        ))}

        {/* Overflow indicator */}
        {communityCount > 12 && (
          <div className="absolute bottom-4 right-4 text-xs text-muted-foreground">
            +{communityCount - 12} mais
          </div>
        )}

        {/* Central shield SVG */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <svg
            width="80"
            height="90"
            viewBox="0 0 80 90"
            className={cn(shieldAnim)}
            aria-hidden="true"
          >
            <path
              d="M40 5 L72 18 L72 45 C72 63 57 78 40 85 C23 78 8 63 8 45 L8 18 Z"
              className={STATE_COLORS[state]}
              strokeWidth="2"
              strokeLinejoin="round"
              fill="currentFill"
            />
            {state === "safe" && (
              <path
                d="M28 45 L37 54 L52 38"
                stroke="oklch(0.72 0.22 246)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            )}
            {state === "warning" && (
              <>
                <line
                  x1="40"
                  y1="32"
                  x2="40"
                  y2="52"
                  stroke="oklch(0.84 0.16 88)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <circle cx="40" cy="60" r="2" fill="oklch(0.84 0.16 88)" />
              </>
            )}
            {state === "danger" && (
              <>
                <line
                  x1="40"
                  y1="28"
                  x2="40"
                  y2="52"
                  stroke="oklch(0.65 0.24 22)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <circle cx="40" cy="61" r="2.5" fill="oklch(0.65 0.24 22)" />
              </>
            )}
          </svg>
        </div>
      </div>

      {/* Status text */}
      <div
        aria-live="assertive"
        aria-atomic="true"
        className="mb-5 text-sm font-medium text-center"
      >
        {state === "safe" && <span className="text-electric">Protegido · Enxame ativo</span>}
        {state === "warning" && <span className="text-gold">Atenção · Área de risco</span>}
        {state === "danger" && <span className="text-danger">Perigo · Acionar suporte</span>}
        {state === "off" && <span className="text-muted-foreground">Escudo desativado</span>}
      </div>

      {/* SOS panic button */}
      {onSOSPress && (
        <>
          <button
            className={cn(
              "relative h-16 w-16 rounded-full",
              "bg-danger font-display text-xl font-bold text-white",
              "[box-shadow:0_0_16px_oklch(0.65_0.24_22/0.6)]",
              "active:scale-[0.92] transition-transform duration-150",
              "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-danger-glow focus-visible:ring-offset-3",
              "select-none",
            )}
            aria-label="Acionar alerta de emergência SOS (pressione e segure)"
            onPointerDown={handleSOSDown}
            onPointerUp={handleSOSUp}
            onPointerLeave={handleSOSUp}
          >
            SOS
          </button>

          {/* SOS confirm dialog */}
          {sosConfirmOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              aria-labelledby="sos-dialog-title"
            >
              <div className="mx-4 rounded-3xl border border-danger/40 bg-card p-6 max-w-[340px] w-full">
                <h2 id="sos-dialog-title" className="text-lg font-semibold text-danger mb-2">
                  Confirmar SOS?
                </h2>
                <p className="text-sm text-muted-foreground mb-5">
                  Um alerta de emergência será enviado para a comunidade e equipe de suporte.
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setSosConfirmOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1 bg-danger text-white hover:bg-danger/90"
                    onClick={() => {
                      setSosConfirmOpen(false);
                      onSOSPress?.();
                    }}
                  >
                    Acionar SOS
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
