import * as React from "react";
import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { Map as MapIcon, Layers, ShieldAlert, User, Wallet } from "lucide-react";
import { StatusBar } from "@/components/vuup/StatusBar";
import { MapaVivo, type SelectedDestination } from "@/components/vuup/MapaVivo";
import { QuickRegisterDialog } from "@/components/vuup/QuickRegisterDialog";
import { isAuthenticated } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useRideDispute } from "@/hooks/use-ride-dispute";
import { apiClient } from "@/api/client";

export const Route = createFileRoute("/")({
  component: VuupPassengerApp,
  // No auth guard (VUU-82): the app is freely navigable. Registration happens
  // on-demand, at the moment of requesting a ride.
});

// Bottom nav items — each links to a real route
const NAV_ITEMS = [
  { to: "/", label: "Início", icon: MapIcon },
  { to: "/rides", label: "Corridas", icon: Layers },
  { to: "/wallet", label: "Carteira", icon: Wallet },
  { to: "/profile", label: "Perfil", icon: User },
  { to: "/safety", label: "Segurança", icon: ShieldAlert },
] as const;

// ─── Main passenger app (home/map screen) ─────────────────────────────────────

function VuupPassengerApp() {
  // Track the user's confirmed destination from the map panel
  const [pendingDestination, setPendingDestination] = React.useState<SelectedDestination | null>(
    null,
  );

  // Quick-register modal state (VUU-82) — opened when an unauthenticated user
  // tries to request a ride.
  const [registerOpen, setRegisterOpen] = React.useState(false);

  // Dispute / realtime ride state
  const { status: disputeStatus, startDispute, endDispute, bids, winnerId } = useRideDispute();

  /**
   * Create the ride via the API and open the SSE dispute stream. Assumes a
   * session already exists (apiClient sends the bearer token).
   */
  async function createRideAndDispute(destination: SelectedDestination) {
    try {
      // Use user position as a rough origin placeholder — reverse-geocoding of
      // the actual GPS position is a follow-up (VUU-68).
      const ride = await apiClient.rides.create({
        routeType: "livre",
        origin: {
          lat: -23.5505,
          lng: -46.6333,
          address: "Localização atual",
        },
        destination: {
          lat: destination.lat,
          lng: destination.lng,
          address: destination.label,
        },
      });
      // Open SSE dispute stream — auto-reconnects on drop
      startDispute(ride.id);
    } catch (err) {
      console.warn("[VuupPassengerApp] Could not create ride:", err);
      // Still allow the user to see the map — stream will be started once
      // connectivity is restored (the user can retry by tapping the button again).
    }
  }

  /**
   * Called when the user taps "Ir para X" in the bottom panel. If there is no
   * session yet, open the quick-register modal first (VUU-82); otherwise create
   * the ride immediately.
   */
  async function handleSelectRide(destination: SelectedDestination | null) {
    if (!destination) return;
    setPendingDestination(destination);

    if (!isAuthenticated()) {
      setRegisterOpen(true);
      return;
    }
    await createRideAndDispute(destination);
  }

  /** After a successful quick-register, continue the ride the user asked for. */
  function handleRegistered() {
    if (pendingDestination) {
      void createRideAndDispute(pendingDestination);
    }
  }

  // Side-effects on dispute lifecycle changes
  React.useEffect(() => {
    if (disputeStatus === "resolved" && winnerId) {
      // Future: navigate to /rides/:id tracking screen
      console.info("[VuupPassengerApp] Dispute resolved — driver:", winnerId);
    }
    if (disputeStatus === "expired" || disputeStatus === "cancelled") {
      endDispute();
    }
  }, [disputeStatus, winnerId, endDispute]);

  return (
    <main
      className="relative mx-auto h-[100dvh] w-full max-w-[480px] overflow-hidden text-foreground"
      style={{ background: "var(--gradient-canvas)" }}
    >
      {/* Status bar */}
      <StatusBar />

      {/* Main content area — home shows the live map.
       * Other sections (Corridas, Carteira, Perfil, Segurança) are now their
       * own routes reachable via the bottom nav, not in-page tabs. */}
      <div className="absolute inset-0 pt-8 pb-20 overflow-hidden">
        <div className="absolute inset-0 pt-8 pb-20" aria-label="Mapa Vivo">
          <MapaVivo onSelectRide={handleSelectRide} />
        </div>
      </div>

      {/* Quick-register modal — opens when an anonymous user requests a ride */}
      <QuickRegisterDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        onRegistered={handleRegistered}
      />

      {/* Realtime dispute status banner — shown while searching or matching */}
      {disputeStatus !== "idle" && disputeStatus !== "resolved" && (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "absolute top-10 inset-x-4 z-50 rounded-2xl border px-4 py-3",
            "flex items-center gap-3 animate-in slide-in-from-top-2 duration-300",
            disputeStatus === "open"
              ? "border-neon/40 bg-surface-2 [box-shadow:0_0_16px_oklch(0.86_0.24_148/0.3)]"
              : "border-electric/40 bg-surface-2 [box-shadow:0_0_16px_oklch(0.72_0.22_246/0.3)]",
          )}
        >
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full shrink-0",
              disputeStatus === "open" ? "bg-neon/20" : "bg-electric/20",
            )}
          >
            <span
              className={cn(
                "text-sm font-bold",
                disputeStatus === "open" ? "text-neon" : "text-electric",
              )}
              aria-hidden="true"
            >
              {disputeStatus === "open" ? bids.length : "…"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                "text-sm font-semibold",
                disputeStatus === "open" ? "text-neon" : "text-electric",
              )}
            >
              {disputeStatus === "connecting" && "Conectando..."}
              {disputeStatus === "open" &&
                (bids.length > 0
                  ? `${bids.length} motorista${bids.length > 1 ? "s" : ""} disputando`
                  : "Procurando motoristas...")}
              {disputeStatus === "error" && "Erro na conexão"}
              {disputeStatus === "expired" && "Disputa expirada"}
              {disputeStatus === "cancelled" && "Corrida cancelada"}
            </p>
            {pendingDestination && (
              <p className="text-xs text-muted-foreground truncate">→ {pendingDestination.label}</p>
            )}
          </div>
          <button
            className="text-muted-foreground hover:text-foreground text-lg leading-none shrink-0 -mt-1"
            onClick={endDispute}
            aria-label="Cancelar busca"
          >
            ×
          </button>
        </div>
      )}

      {/* Ride confirmed banner */}
      {disputeStatus === "resolved" && winnerId && (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "absolute top-10 inset-x-4 z-50 rounded-2xl border border-neon/40 bg-surface-2 px-4 py-3",
            "flex items-center gap-3 [box-shadow:0_0_16px_oklch(0.86_0.24_148/0.3)]",
            "animate-in slide-in-from-top-2 duration-300",
          )}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neon/20 shrink-0">
            <span className="text-neon text-sm font-bold" aria-hidden="true">
              ✓
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-neon">Motorista encontrado!</p>
            <p className="text-xs text-muted-foreground truncate">A caminho do seu endereço...</p>
          </div>
          <button
            className="text-muted-foreground hover:text-foreground text-lg leading-none shrink-0 -mt-1"
            onClick={endDispute}
            aria-label="Fechar notificação"
          >
            ×
          </button>
        </div>
      )}

      {/* Bottom nav — real router Links */}
      <BottomNav />
    </main>
  );
}

// ─── Shared bottom nav ────────────────────────────────────────────────────────

function BottomNav() {
  const location = useRouterState({ select: (s) => s.location });
  const pathname = location.pathname;

  return (
    <nav
      className="absolute bottom-0 inset-x-0 h-20 border-t border-border bg-card/80 backdrop-blur-sm z-30"
      aria-label="Navegação principal"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex h-full items-end pb-3">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
          const isActive = pathname === to;
          return (
            <li key={to} className="flex-1 relative">
              {isActive && <div className="tab-active-indicator" aria-hidden="true" />}
              <Link
                to={to}
                className={cn(
                  "flex w-full flex-col items-center gap-1 py-1 transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                  isActive ? "text-electric" : "text-muted-foreground hover:text-foreground",
                )}
                aria-label={label}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon size={22} aria-hidden="true" />
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
