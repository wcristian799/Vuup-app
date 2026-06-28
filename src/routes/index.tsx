import { createFileRoute } from "@tanstack/react-router";
import { Map as MapIcon, Radar, ShieldAlert, Wallet, Layers } from "lucide-react";

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
  return (
    <main
      className="relative mx-auto h-[100dvh] w-full max-w-[480px] overflow-hidden text-foreground"
      style={{ background: "var(--gradient-canvas)" }}
    >
      {/* Status bar placeholder */}
      <div className="flex h-8 items-center justify-between px-4 text-xs text-muted-foreground">
        <span>VUUP</span>
        <span className="font-mono">00:00</span>
      </div>

      {/* Main content area */}
      <div className="absolute inset-0 pt-8 pb-20 flex items-center justify-center">
        <div className="text-center px-6">
          <h1 className="font-display text-4xl font-bold text-electric mb-2">VUUP</h1>
          <p className="text-muted-foreground text-sm">Mobilidade urbana viva</p>
          <p className="mt-6 text-xs text-surface-3 opacity-60">
            Skeleton PWA — feature branches coming soon
          </p>
        </div>
      </div>

      {/* Bottom tab bar */}
      <nav className="absolute bottom-0 inset-x-0 h-20 border-t border-border bg-card/80 backdrop-blur-sm">
        <ul className="flex h-full items-center">
          {TABS.map(({ key, label, icon: Icon }) => (
            <li key={key} className="flex-1">
              <button
                className="flex w-full flex-col items-center gap-1 py-2 text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none"
                aria-label={label}
              >
                <Icon size={22} aria-hidden="true" />
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
