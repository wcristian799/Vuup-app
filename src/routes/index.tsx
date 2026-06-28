import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Map as MapIcon, Layers, ShieldAlert, User, Package } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { StatusBar } from "@/components/vuup/StatusBar";
import { MapaVivo } from "@/components/vuup/MapaVivo";
import { RideSelectorMatrix, type RideTypeKey } from "@/components/vuup/RideSelectorMatrix";
import { SafetyCenter } from "@/components/vuup/SafetyCenter";
import { ScreenTransition } from "@/components/vuup/ScreenTransition";
import { DriverDashboard } from "@/components/vuup/DriverDashboard";
import { EntregasScreen } from "@/components/vuup/EntregasScreen";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: VuupPassengerApp,
});

type Tab = "map" | "matrix" | "entregas" | "profile" | "shield";

const TABS: { key: Tab; label: string; icon: typeof MapIcon }[] = [
  { key: "map", label: "Início", icon: MapIcon },
  { key: "matrix", label: "Corridas", icon: Layers },
  { key: "entregas", label: "Entregas", icon: Package },
  { key: "profile", label: "Perfil", icon: User },
  { key: "shield", label: "Segurança", icon: ShieldAlert },
];

// ─── Main passenger app ───────────────────────────────────────────────────────

function VuupPassengerApp() {
  const [activeTab, setActiveTab] = React.useState<Tab>("map");
  // When a ride type is confirmed from Matrix, we stash the selection here
  const [confirmedRide, setConfirmedRide] = React.useState<RideTypeKey | null>(null);

  const handleSelectRide = () => {
    setActiveTab("matrix");
  };

  const handleConfirmRide = (rideType: RideTypeKey) => {
    setConfirmedRide(rideType);
    setActiveTab("map");
  };

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
              <div className="absolute inset-0 pt-8 pb-20 overflow-hidden" aria-label="Entregas e Comércio">
                <EntregasScreen />
              </div>
            </ScreenTransition>
          )}
          {activeTab === "profile" && (
            <ScreenTransition motionKey="profile">
              <div className="absolute inset-0 pt-8 pb-20 overflow-hidden" aria-label="Perfil do motorista">
                <DriverDashboard isPatrono={true} tier="ouro" />
              </div>
            </ScreenTransition>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom tab bar */}
      <nav
        className="absolute bottom-0 inset-x-0 h-20 border-t border-border bg-card/80 backdrop-blur-sm"
        aria-label="Navegação principal"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="flex h-full items-end pb-3">
          {TABS.map(({ key, label, icon: Icon }) => {
            const isActive = activeTab === key;
            return (
              <li key={key} className="flex-1 relative">
                {isActive && <div className="tab-active-indicator" aria-hidden="true" />}
                <button
                  className={cn(
                    "flex w-full flex-col items-center gap-1 py-1 transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                    isActive ? "text-electric" : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-label={label}
                  aria-pressed={isActive}
                  onClick={() => setActiveTab(key)}
                >
                  <Icon size={22} aria-hidden="true" />
                  <span className="text-[10px] font-medium leading-none">{label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Ride confirmed toast (shown when back on map after confirming) */}
      {confirmedRide && activeTab === "map" && (
        <div
          className={cn(
            "absolute top-10 inset-x-4 z-50 rounded-2xl border border-neon/40 bg-surface-2 px-4 py-3",
            "flex items-center gap-3 [box-shadow:0_0_16px_oklch(0.86_0.24_148/0.3)]",
            "animate-in slide-in-from-top-2 duration-300",
          )}
          role="status"
          aria-live="polite"
          aria-label={`Corrida ${confirmedRide} confirmada`}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neon/20 shrink-0">
            <span className="text-neon text-sm font-bold" aria-hidden="true">
              ✓
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-neon">Corrida confirmada!</p>
            <p className="text-xs text-muted-foreground capitalize truncate">
              {confirmedRide.replace("-", " ")} · Procurando motorista...
            </p>
          </div>
          <button
            className="text-muted-foreground hover:text-foreground text-lg leading-none shrink-0 -mt-1"
            onClick={() => setConfirmedRide(null)}
            aria-label="Fechar notificação"
          >
            ×
          </button>
        </div>
      )}
    </main>
  );
}
