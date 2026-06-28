import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Map as MapIcon, Radar, ShieldAlert, Wallet, Layers } from "lucide-react";
import { StatusBar } from "@/components/vuup/StatusBar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: VuupHome,
});

type Tab = "map" | "matrix" | "cockpit" | "radar" | "shield";

const TABS: { key: Tab; label: string; icon: typeof MapIcon }[] = [
  { key: "map", label: "Mapa", icon: MapIcon },
  { key: "matrix", label: "Matrix", icon: Layers },
  { key: "cockpit", label: "Cockpit", icon: Wallet },
  { key: "radar", label: "Radar", icon: Radar },
  { key: "shield", label: "Escudo", icon: ShieldAlert },
];

function VuupHome() {
  const [activeTab, setActiveTab] = React.useState<Tab>("map");

  return (
    <main
      className="relative mx-auto h-[100dvh] w-full max-w-[480px] overflow-hidden text-foreground"
      style={{ background: "var(--gradient-canvas)" }}
    >
      {/* Status bar */}
      <StatusBar />

      {/* Main content area */}
      <div className="absolute inset-0 pt-8 pb-20 flex items-center justify-center overflow-y-auto">
        <div className="text-center px-6">
          <h1 className="font-display text-4xl font-bold text-electric mb-2">VUUP</h1>
          <p className="text-muted-foreground text-sm mb-1">Mobilidade urbana viva</p>
          <p className="text-xs text-muted-foreground/60">
            Tab ativa: <span className="text-electric font-medium">{activeTab}</span>
          </p>
          <div className="mt-6">
            <Link
              to="/gallery"
              className="inline-flex items-center gap-1.5 rounded-full border border-electric/40 bg-electric/10 px-4 py-2 text-sm text-electric hover:bg-electric/20 transition-colors"
            >
              Ver galeria de componentes →
            </Link>
          </div>
        </div>
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
    </main>
  );
}
