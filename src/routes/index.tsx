import * as React from "react";
import { createFileRoute, redirect, Link, useRouterState } from "@tanstack/react-router";
import { Map as MapIcon, Layers, ShieldAlert, User, Wallet } from "lucide-react";
import { StatusBar } from "@/components/vuup/StatusBar";
import { MapaVivo } from "@/components/vuup/MapaVivo";
import { isAuthenticated } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: VuupPassengerApp,
  beforeLoad: () => {
    // Guard: redirect to /login if not authenticated
    if (!isAuthenticated()) {
      throw redirect({ to: "/login" });
    }
  },
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
  return (
    <main
      className="relative mx-auto h-[100dvh] w-full max-w-[480px] overflow-hidden text-foreground"
      style={{ background: "var(--gradient-canvas)" }}
    >
      {/* Status bar */}
      <StatusBar />

      {/* Main content area */}
      <div className="absolute inset-0 pt-8 pb-20 overflow-hidden">
        {/*
         * Map and Matrix are always rendered (map needs Leaflet to stay mounted),
         * so they use the original opacity-toggle approach.
         * All other tabs use ScreenTransition for animated entrance/exit.
         */}

        {/* Mapa Vivo — always mounted, opacity-toggled */}
        <div
          className={cn(
            "absolute inset-0 pt-8 pb-20 transition-opacity duration-200",
            activeTab === "map"
              ? "opacity-100 pointer-events-auto z-10"
              : "opacity-0 pointer-events-none z-0",
          )}
          aria-hidden={activeTab !== "map"}
        >
          <MapaVivo onSelectRide={handleSelectRide} />
        </div>

        {/* Matrix Slider — always mounted */}
        <div
          className={cn(
            "absolute inset-0 pt-8 pb-20 transition-opacity duration-200",
            activeTab === "matrix"
              ? "opacity-100 pointer-events-auto z-10"
              : "opacity-0 pointer-events-none z-0",
          )}
          aria-hidden={activeTab !== "matrix"}
        >
          <RideSelectorMatrix onConfirm={handleConfirmRide} destination="Destino selecionado" />
        </div>

        {/* Animated tabs — rendered only when active, animated in/out */}
        <AnimatePresence mode="wait" initial={false}>
          {activeTab === "shield" && (
            <ScreenTransition motionKey="shield">
              <div className="absolute inset-0 pt-8 pb-20" aria-label="Centro de segurança">
                <SafetyCenter />
              </div>
            </ScreenTransition>
          )}
          {activeTab === "entregas" && (
            <ScreenTransition motionKey="entregas">
              <div
                className="absolute inset-0 pt-8 pb-20 overflow-hidden"
                aria-label="Entregas e Comércio"
              >
                <EntregasScreen />
              </div>
            </ScreenTransition>
          )}
          {activeTab === "profile" && (
            <ScreenTransition motionKey="profile">
              <div
                className="absolute inset-0 pt-8 pb-20 overflow-hidden"
                aria-label="Perfil do motorista"
              >
                <DriverDashboard isPatrono={true} tier="ouro" />
              </div>
            </ScreenTransition>
          )}
        </AnimatePresence>
      </div>

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
