import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Map as MapIcon,
  Radar,
  ShieldAlert,
  Wallet,
  Layers,
  TrendingUp,
  Users,
  Crown,
  Navigation,
  Package,
  Bike,
  Car,
  Route as RouteIcon,
  ArrowRight,
  ChevronDown,
  Bell,
  Search,
  Plus,
  Minus,
  Locate,
  Star,
  Clock,
  Phone,
  MessageCircle,
  X,
  ShieldCheck,
  Zap,
  DollarSign,
  Calendar,
  Eye,
  Activity,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VUUP — Mobilidade urbana viva" },
      { name: "description", content: "App VUUP: corridas, motoboy, rotas coletivas, renda passiva e segurança comunitária por efeito enxame." },
    ],
  }),
  component: VuupApp,
});

type Tab = "map" | "matrix" | "cockpit" | "radar" | "shield";

const TABS: { key: Tab; label: string; icon: typeof MapIcon }[] = [
  { key: "map", label: "Mapa", icon: MapIcon },
  { key: "matrix", label: "Matrix", icon: Layers },
  { key: "cockpit", label: "Cockpit", icon: Wallet },
  { key: "radar", label: "Radar", icon: Radar },
  { key: "shield", label: "Escudo", icon: ShieldAlert },
];

function VuupApp() {
  const [tab, setTab] = useState<Tab>("map");

  return (
    <main
      className="relative mx-auto h-[100dvh] w-full max-w-[480px] overflow-hidden text-foreground"
      style={{ background: "var(--gradient-canvas)" }}
    >
      <StatusBar />

      <div className="absolute inset-0 pt-8 pb-20">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: [0.22, 0.8, 0.3, 1] }}
            className="h-full w-full"
          >
            {tab === "map" && <MapScreen />}
            {tab === "matrix" && <MatrixScreen onPickRide={() => setTab("map")} />}
            {tab === "cockpit" && <CockpitScreen />}
            {tab === "radar" && <RadarScreen />}
            {tab === "shield" && <ShieldScreen />}
          </motion.div>
        </AnimatePresence>
      </div>

      <TabBar tab={tab} setTab={setTab} />
    </main>
  );
}

/* ────────── Chrome ────────── */

function StatusBar() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    };
    tick();
    const i = setInterval(tick, 30000);
    return () => clearInterval(i);
  }, []);
  return (
    <div className="absolute inset-x-0 top-0 z-50 flex h-8 items-center justify-between px-6 text-[12px] font-semibold">
      <span className="font-mono tabular">{time || "—"}</span>
      <div className="flex items-center gap-1.5 text-foreground/80">
        <span className="text-[10px] uppercase tracking-widest">VUUP</span>
        <span className="h-1 w-1 rounded-full bg-neon shadow-[0_0_6px_var(--neon)]" />
      </div>
    </div>
  );
}

function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-40 px-3 pb-3">
      <div className="glass-strong flex items-center justify-between rounded-full p-1.5 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.7)]">
        {TABS.map((t) => {
          const active = tab === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="relative flex flex-1 flex-col items-center justify-center rounded-full px-2 py-2"
            >
              {active && (
                <motion.span
                  layoutId="tab-pill"
                  className="absolute inset-0 rounded-full"
                  style={{ background: "var(--gradient-electric)" }}
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <span className={`relative flex flex-col items-center gap-0.5 ${active ? "text-white" : "text-muted-foreground"}`}>
                <Icon className="h-4 w-4" />
                <span className="text-[9px] font-semibold uppercase tracking-wider">{t.label}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ────────── Screen 1: Mapa Vivo + corrida funcional ────────── */

type RideStage = "idle" | "searching" | "matched" | "enroute";

const RIDE_MODES = [
  { id: "exclusive", icon: Car, label: "Exclusiva", price: 18.9, eta: "3 min", tone: "electric" as const },
  { id: "shared", icon: RouteIcon, label: "Rota Livre", price: 7.4, eta: "5 min", tone: "neon" as const },
  { id: "moto", icon: Bike, label: "Motoboy", price: 12.0, eta: "2 min", tone: "gold" as const },
  { id: "package", icon: Package, label: "Entrega", price: 14.5, eta: "4 min", tone: "electric" as const },
];

function MapScreen() {
  const [sheetOpen, setSheetOpen] = useState(true);
  const [mode, setMode] = useState("exclusive");
  const [stage, setStage] = useState<RideStage>("idle");
  const [dest, setDest] = useState("Av. Paulista, 1578");
  const selected = RIDE_MODES.find((m) => m.id === mode)!;

  const confirm = () => {
    setStage("searching");
    setSheetOpen(true);
    setTimeout(() => setStage("matched"), 2400);
    setTimeout(() => setStage("enroute"), 5200);
  };

  const cancel = () => setStage("idle");

  return (
    <div className="relative h-full w-full">
      <LiveMap stage={stage} />

      {/* Top floating controls */}
      <div className="absolute inset-x-3 top-3 z-30 flex items-center justify-between">
        <button className="glass-strong flex h-11 w-11 items-center justify-center rounded-2xl active:scale-95">
          <Layers className="h-4 w-4" />
        </button>
        <div className="glass-strong flex items-center gap-2 rounded-full px-3.5 py-2.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neon shadow-[0_0_8px_var(--neon)]" />
          <span className="text-[11px] font-semibold">São Paulo · ao vivo</span>
        </div>
        <button className="glass-strong relative flex h-11 w-11 items-center justify-center rounded-2xl active:scale-95">
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-danger" />
        </button>
      </div>

      {/* Floating economy bubbles */}
      {stage === "idle" && (
        <>
          <FloatingBubble className="left-4 top-24" tone="neon" label="−32%" sub="Vila Mariana" />
          <FloatingBubble className="right-6 top-40" tone="gold" label="VIP" sub="janela ativa" />
        </>
      )}

      {/* Locate button */}
      <button
        className="glass-strong absolute right-3 bottom-[340px] z-20 flex h-11 w-11 items-center justify-center rounded-2xl active:scale-95"
        aria-label="Centralizar"
      >
        <Locate className="h-4 w-4 text-electric" />
      </button>

      {/* Bottom sheet */}
      <motion.div
        initial={false}
        animate={{ y: sheetOpen ? 0 : 240 }}
        transition={{ type: "spring", stiffness: 280, damping: 32 }}
        className="absolute inset-x-0 bottom-0 z-30"
      >
        <div className="glass-strong rounded-t-[28px] px-5 pb-6 pt-2">
          <button onClick={() => setSheetOpen((v) => !v)} className="mx-auto block py-2">
            <span className="block h-1 w-10 rounded-full bg-white/25" />
          </button>

          <AnimatePresence mode="wait">
            {stage === "idle" && (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {/* Destination input */}
                <button className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-surface/60 px-4 py-3 text-left active:scale-[0.99]">
                  <Search className="h-4 w-4 text-electric" />
                  <input
                    value={dest}
                    onChange={(e) => setDest(e.target.value)}
                    className="flex-1 bg-transparent text-sm font-medium outline-none"
                    placeholder="Para onde?"
                  />
                  <span className="rounded-full bg-neon/15 px-2 py-0.5 font-mono text-[10px] font-bold text-neon">
                    −R$ 8,40
                  </span>
                </button>

                {/* Mode chips */}
                <div className="mt-3 -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 scrollbar-none">
                  {RIDE_MODES.map((m) => (
                    <RideChip key={m.id} m={m} active={m.id === mode} onClick={() => setMode(m.id)} />
                  ))}
                </div>

                {/* Confirm */}
                <button
                  onClick={confirm}
                  className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold text-white glow-electric active:scale-[0.99]"
                  style={{ background: "var(--gradient-electric)" }}
                >
                  Confirmar {selected.label} · R$ {selected.price.toFixed(2).replace(".", ",")}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </motion.div>
            )}

            {stage === "searching" && (
              <motion.div key="searching" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-2">
                <div className="flex items-center gap-3">
                  <div className="relative h-12 w-12">
                    <span className="absolute inset-0 animate-pulse-ring rounded-full border-2 border-electric" />
                    <span className="absolute inset-0 animate-pulse-ring-slow rounded-full border-2 border-electric/60" />
                    <span className="absolute inset-2 rounded-full bg-electric shadow-[0_0_24px_var(--electric)]" />
                  </div>
                  <div className="flex-1">
                    <div className="font-display text-base font-semibold">Procurando fundador VUUP…</div>
                    <div className="text-xs text-muted-foreground">Avaliando 38 motoristas próximos</div>
                  </div>
                </div>
                <button onClick={cancel} className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl border border-white/15 bg-surface/60 text-sm font-semibold text-muted-foreground active:scale-[0.99]">
                  Cancelar busca
                </button>
              </motion.div>
            )}

            {(stage === "matched" || stage === "enroute") && (
              <motion.div key="matched" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="flex items-center gap-3 rounded-2xl border border-neon/30 bg-neon/5 p-3">
                  <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-full glow-neon" style={{ background: "var(--gradient-electric)" }}>
                    <span className="font-display text-base font-bold text-white">RC</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-display text-sm font-bold">Rafael C.</span>
                      <Crown className="h-3 w-3 text-gold" />
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Star className="h-3 w-3 fill-gold text-gold" /> 4.96 · Honda Civic · DPV-9821
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-lg font-bold text-neon">{stage === "matched" ? "2'" : "Em rota"}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{stage === "matched" ? "chegando" : "destino"}</div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <ActionBtn icon={Phone} label="Ligar" />
                  <ActionBtn icon={MessageCircle} label="Chat" />
                  <ActionBtn icon={ShieldAlert} label="SOS" tone="danger" />
                </div>

                <button onClick={cancel} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-surface/60 text-xs font-semibold text-muted-foreground">
                  <X className="h-3.5 w-3.5" /> Cancelar corrida
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

function RideChip({ m, active, onClick }: { m: typeof RIDE_MODES[number]; active: boolean; onClick: () => void }) {
  const Icon = m.icon;
  return (
    <button
      onClick={onClick}
      className={`relative flex min-w-[120px] flex-col gap-1 rounded-2xl border p-3 text-left transition-all active:scale-[0.98] ${
        active ? "border-electric/60 bg-electric/10 glow-electric" : "border-white/10 bg-surface/60"
      }`}
    >
      <div className="flex items-center justify-between">
        <Icon className={`h-4 w-4 ${active ? "text-electric" : "text-foreground/80"}`} />
        <span className="font-mono text-[10px] text-muted-foreground">{m.eta}</span>
      </div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-foreground/80">{m.label}</div>
      <div className="font-display text-base font-bold">R$ {m.price.toFixed(2).replace(".", ",")}</div>
    </button>
  );
}

function ActionBtn({ icon: Icon, label, tone }: { icon: typeof Phone; label: string; tone?: "danger" }) {
  return (
    <button
      className={`flex h-12 flex-col items-center justify-center gap-0.5 rounded-2xl border text-[10px] font-semibold uppercase tracking-wider active:scale-95 ${
        tone === "danger" ? "border-danger/40 bg-danger/10 text-danger" : "border-white/10 bg-surface/60 text-foreground/80"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function FloatingBubble({ className, tone, label, sub }: { className: string; tone: "neon" | "gold" | "electric"; label: string; sub: string }) {
  const styles = {
    neon: "glow-neon text-neon border-neon/40 bg-neon/10",
    gold: "glow-gold text-gold border-gold/40 bg-gold/10",
    electric: "glow-electric text-electric border-electric/40 bg-electric/10",
  }[tone];
  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.25, type: "spring", stiffness: 220, damping: 18 }}
      className={`absolute z-20 ${className}`}
    >
      <div className={`animate-float rounded-2xl border px-3 py-1.5 text-center backdrop-blur ${styles}`}>
        <div className="font-display text-sm font-bold leading-none">{label}</div>
        <div className="mt-0.5 text-[9px] uppercase tracking-wider opacity-80">{sub}</div>
      </div>
    </motion.div>
  );
}

/* ────────── Real Leaflet map ────────── */

function LiveMap({ stage }: { stage: RideStage }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);

  // SP coords
  const origin: [number, number] = [-23.5680, -46.6520]; // R. Pamplona ~
  const destination: [number, number] = [-23.5614, -46.6560]; // Av. Paulista 1578

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current || mapRef.current) return;

      const map = L.map(ref.current, {
        center: [(origin[0] + destination[0]) / 2, (origin[1] + destination[1]) / 2],
        zoom: 15,
        zoomControl: false,
        attributionControl: false,
        dragging: true,
      });
      mapRef.current = map;

      // Dark tiles (CARTO)
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd",
        maxZoom: 20,
      }).addTo(map);

      // Origin marker (pulse dot)
      const originIcon = L.divIcon({
        className: "",
        html: `<div style="position:relative;width:18px;height:18px">
          <span style="position:absolute;inset:-12px;border-radius:9999px;border:2px solid oklch(0.72 0.22 246);opacity:.4;animation:pulse-ring 2.4s infinite"></span>
          <span style="position:absolute;inset:0;border-radius:9999px;background:oklch(0.72 0.22 246);box-shadow:0 0 16px oklch(0.72 0.22 246);border:3px solid white"></span>
        </div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      L.marker(origin, { icon: originIcon }).addTo(map);

      // Destination pin
      const destIcon = L.divIcon({
        className: "",
        html: `<div style="display:flex;flex-direction:column;align-items:center">
          <div style="background:oklch(0.86 0.24 148);color:#000;padding:4px 8px;border-radius:8px;font-size:10px;font-weight:700;box-shadow:0 8px 20px -4px oklch(0.86 0.24 148 / 0.6)">DESTINO</div>
          <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid oklch(0.86 0.24 148)"></div>
        </div>`,
        iconSize: [60, 28],
        iconAnchor: [30, 28],
      });
      L.marker(destination, { icon: destIcon }).addTo(map);

      // Demand pulses around the area
      const pulses: [number, number][] = [
        [-23.5650, -46.6480],
        [-23.5710, -46.6580],
        [-23.5590, -46.6510],
        [-23.5660, -46.6620],
      ];
      pulses.forEach((p, i) => {
        const icon = L.divIcon({
          className: "",
          html: `<div style="position:relative;width:8px;height:8px">
            <span style="position:absolute;inset:-10px;border-radius:9999px;border:1px solid oklch(0.86 0.24 148);opacity:.6;animation:pulse-ring 2.${i}s infinite"></span>
            <span style="position:absolute;inset:0;border-radius:9999px;background:oklch(0.86 0.24 148);box-shadow:0 0 10px oklch(0.86 0.24 148)"></span>
          </div>`,
          iconSize: [8, 8],
          iconAnchor: [4, 4],
        });
        L.marker(p, { icon }).addTo(map);
      });

      // Fetch real route from OSRM
      try {
        const res = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${origin[1]},${origin[0]};${destination[1]},${destination[0]}?overview=full&geometries=geojson`
        );
        const data = await res.json();
        const coords = data?.routes?.[0]?.geometry?.coordinates as [number, number][] | undefined;
        if (coords && !cancelled) {
          const latlngs = coords.map(([lng, lat]) => [lat, lng]) as [number, number][];
          // glow underlay
          L.polyline(latlngs, { color: "#3b82f6", weight: 10, opacity: 0.25 }).addTo(map);
          const line = L.polyline(latlngs, { color: "#7dd3fc", weight: 4, opacity: 0.95 }).addTo(map);
          routeLayerRef.current = line;
          map.fitBounds(line.getBounds(), { padding: [60, 60] });
        }
      } catch {
        // fallback: straight line
        L.polyline([origin, destination], { color: "#7dd3fc", weight: 4, opacity: 0.9, dashArray: "8 8" }).addTo(map);
      }
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Driver marker appears on match
  useEffect(() => {
    let raf: number | null = null;
    (async () => {
      if (!mapRef.current) return;
      const L = (await import("leaflet")).default;
      if (stage === "matched" || stage === "enroute") {
        if (!driverMarkerRef.current) {
          const icon = L.divIcon({
            className: "",
            html: `<div style="background:oklch(0.84 0.16 88);color:#000;padding:6px;border-radius:9999px;box-shadow:0 0 20px oklch(0.84 0.16 88);border:2px solid white;display:grid;place-items:center;width:30px;height:30px;font-size:14px">🚗</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
          });
          // start slightly away from origin
          driverMarkerRef.current = L.marker([origin[0] - 0.004, origin[1] - 0.003], { icon }).addTo(mapRef.current);
        }
        // animate towards origin
        const target = origin;
        const start = driverMarkerRef.current.getLatLng();
        const t0 = performance.now();
        const dur = 2500;
        const step = (t: number) => {
          const k = Math.min(1, (t - t0) / dur);
          const lat = start.lat + (target[0] - start.lat) * k;
          const lng = start.lng + (target[1] - start.lng) * k;
          driverMarkerRef.current.setLatLng([lat, lng]);
          if (k < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      } else if (stage === "idle" && driverMarkerRef.current) {
        mapRef.current.removeLayer(driverMarkerRef.current);
        driverMarkerRef.current = null;
      }
    })();
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [stage]);

  return (
    <div className="absolute inset-0">
      <div ref={ref} className="absolute inset-0 z-0" style={{ background: "#0a0c14" }} />
      {/* gradient veils on top & bottom */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-32 bg-gradient-to-b from-background via-background/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-40 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}

/* ────────── Screen 2: Matrix de modalidades ────────── */

const MATRIX = [
  { id: "exclusive", icon: Car, label: "Exclusiva", tag: "Conforto", desc: "Sedans, ar, premium.", color: "electric", price: "R$ 18-26", demand: 92 },
  { id: "shared", icon: RouteIcon, label: "Rota Livre", tag: "Coletivo", desc: "Até 70% mais barato.", color: "neon", price: "R$ 5-9", demand: 78 },
  { id: "moto", icon: Bike, label: "Motoboy", tag: "Velocidade", desc: "Trânsito não trava.", color: "gold", price: "R$ 9-14", demand: 88 },
  { id: "delivery", icon: Package, label: "Entrega", tag: "Logística", desc: "Door-to-door com seguro.", color: "electric", price: "R$ 12-22", demand: 65 },
  { id: "collective", icon: Users, label: "Carona Bairro", tag: "Comunidade", desc: "Vizinhos com vizinhos.", color: "neon", price: "R$ 3-6", demand: 71 },
  { id: "schedule", icon: Calendar, label: "Agendada", tag: "Programado", desc: "Garanta horário e preço.", color: "gold", price: "R$ 22+", demand: 54 },
] as const;

function MatrixScreen({ onPickRide }: { onPickRide: () => void }) {
  const [selected, setSelected] = useState<string>("exclusive");

  return (
    <div className="h-full w-full overflow-y-auto px-5 pb-4 pt-4 scrollbar-none">
      <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-electric/80">02 · Matrix</div>
      <h1 className="mt-1 font-display text-3xl font-bold leading-tight">Como você quer<br/>se mover hoje?</h1>
      <p className="mt-2 text-xs text-muted-foreground">6 modalidades. Um único app. Preço dinâmico ao vivo.</p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        {MATRIX.map((m) => {
          const active = m.id === selected;
          const Icon = m.icon;
          const glow = m.color === "electric" ? "glow-electric border-electric/60" : m.color === "neon" ? "glow-neon border-neon/60" : "glow-gold border-gold/60";
          return (
            <button
              key={m.id}
              onClick={() => setSelected(m.id)}
              className={`relative flex flex-col gap-2 rounded-3xl border p-4 text-left transition-all active:scale-[0.98] ${
                active ? glow : "border-white/10 bg-surface/50"
              }`}
              style={active ? { background: `color-mix(in oklab, var(--${m.color}) 12%, var(--surface))` } : {}}
            >
              <div className="flex items-center justify-between">
                <div className={`grid h-9 w-9 place-items-center rounded-xl border ${active ? (m.color === "electric" ? "border-electric/40 bg-electric/15" : m.color === "neon" ? "border-neon/40 bg-neon/15" : "border-gold/40 bg-gold/15") : "border-white/10 bg-surface-2"}`}>
                  <Icon className={`h-4 w-4 ${m.color === "electric" ? "text-electric" : m.color === "neon" ? "text-neon" : "text-gold"}`} />
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">{m.demand}%</span>
              </div>
              <div className="mt-1">
                <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{m.tag}</div>
                <div className="font-display text-base font-bold leading-tight">{m.label}</div>
              </div>
              <div className="text-[10px] text-muted-foreground">{m.desc}</div>
              <div className="mt-1 flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-foreground">{m.price}</span>
                {active && <Zap className="h-3.5 w-3.5 text-electric" />}
              </div>
            </button>
          );
        })}
      </div>

      <button
        onClick={onPickRide}
        className="mt-5 mb-4 flex h-13 w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold text-white glow-electric active:scale-[0.99]"
        style={{ background: "var(--gradient-electric)" }}
      >
        Usar agora <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ────────── Screen 3: Cockpit do fundador ────────── */

function CockpitScreen() {
  const [earnings, setEarnings] = useState(0);
  const target = 8473.5;

  useEffect(() => {
    const t0 = performance.now();
    const dur = 1400;
    let raf: number;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      setEarnings(target * e);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  const days = [42, 58, 71, 49, 88, 95, 64];
  const today = new Date().getDay();

  return (
    <div className="h-full w-full overflow-y-auto px-5 pb-4 pt-4 scrollbar-none">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gold/80">03 · Cockpit</div>
          <h1 className="mt-1 font-display text-2xl font-bold">Olá, Rafael 👋</h1>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-[10px] font-bold text-gold">
          <Crown className="h-3 w-3" /> FUNDADOR
        </div>
      </div>

      {/* Earnings hero */}
      <div className="mt-4 rounded-3xl border border-gold/30 p-5 glow-gold" style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--gold) 14%, var(--surface)), var(--surface))" }}>
        <div className="text-[10px] uppercase tracking-widest text-gold/80">Saldo do mês</div>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="font-display text-4xl font-bold text-gradient-gold tabular">
            R$ {earnings.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-1 text-[11px] text-neon">
          <TrendingUp className="h-3 w-3" /> +18,4% vs mês anterior
        </div>

        {/* Sources mini-bars */}
        <div className="mt-4 space-y-2">
          <SourceBar label="Corridas" value={3820} pct={45} color="electric" />
          <SourceBar label="Renda passiva (carteira)" value={2960} pct={35} color="gold" />
          <SourceBar label="Marketplace de rotas" value={1693} pct={20} color="neon" />
        </div>
      </div>

      {/* Stats */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat label="Clientes" value="184" icon={Users} tone="electric" />
        <Stat label="Rotas" value="12" icon={RouteIcon} tone="neon" />
        <Stat label="Estrelas" value="4,96" icon={Star} tone="gold" />
      </div>

      {/* Week chart */}
      <div className="mt-4 rounded-3xl border border-white/10 bg-surface/60 p-4">
        <div className="flex items-center justify-between">
          <div className="font-display text-sm font-bold">Esta semana</div>
          <span className="font-mono text-[11px] text-muted-foreground">R$ 2.140,00</span>
        </div>
        <div className="mt-4 flex h-28 items-end justify-between gap-2">
          {days.map((v, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${v}%` }}
                transition={{ delay: i * 0.05, duration: 0.7, ease: [0.22, 0.8, 0.3, 1] }}
                className={`w-full rounded-md ${i === today ? "bg-electric shadow-[0_0_12px_var(--electric)]" : "bg-white/10"}`}
              />
              <span className={`text-[9px] ${i === today ? "text-electric font-bold" : "text-muted-foreground"}`}>
                {"DSTQQSS"[i]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Founder quota */}
      <div className="mt-3 mb-2 rounded-3xl border border-electric/30 bg-electric/5 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-display text-sm font-bold">Cota Fundador 087/500</div>
            <div className="text-[11px] text-muted-foreground">Renda vitalícia sobre nova região</div>
          </div>
          <Crown className="h-4 w-4 text-gold" />
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: "17.4%" }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="h-full"
            style={{ background: "var(--gradient-electric)" }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
          <span>87 vendidas</span>
          <span>413 restantes</span>
        </div>
      </div>
    </div>
  );
}

function SourceBar({ label, value, pct, color }: { label: string; value: number; pct: number; color: "electric" | "gold" | "neon" }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-foreground/80">{label}</span>
        <span className={`font-mono font-bold ${color === "electric" ? "text-electric" : color === "neon" ? "text-neon" : "text-gold"}`}>R$ {value.toLocaleString("pt-BR")}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/8">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: `var(--${color})` }}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon, tone }: { label: string; value: string; icon: typeof Users; tone: "electric" | "neon" | "gold" }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-surface/60 p-3">
      <Icon className={`h-3.5 w-3.5 ${tone === "electric" ? "text-electric" : tone === "neon" ? "text-neon" : "text-gold"}`} />
      <div className="mt-2 font-display text-xl font-bold tabular">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

/* ────────── Screen 4: Radar de demanda ────────── */

function RadarScreen() {
  const [pings, setPings] = useState([
    { id: 1, label: "Vila Mariana", dist: "0.8 km", value: "R$ 26", hot: true, x: 30, y: 35 },
    { id: 2, label: "Jardins", dist: "1.4 km", value: "R$ 38", hot: true, x: 65, y: 25 },
    { id: 3, label: "Itaim", dist: "2.1 km", value: "R$ 42", hot: false, x: 75, y: 60 },
    { id: 4, label: "Pinheiros", dist: "1.9 km", value: "R$ 31", hot: false, x: 22, y: 70 },
  ]);

  // shuffle values periodically
  useEffect(() => {
    const i = setInterval(() => {
      setPings((arr) => arr.map((p) => ({ ...p, value: `R$ ${20 + Math.floor(Math.random() * 30)}` })));
    }, 3000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="h-full w-full overflow-y-auto px-5 pb-4 pt-4 scrollbar-none">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-electric/80">04 · Radar</div>
          <h1 className="mt-1 font-display text-2xl font-bold">Onde o dinheiro está</h1>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-neon/30 bg-neon/10 px-2.5 py-1 text-[10px] font-bold text-neon">
          <Activity className="h-3 w-3" /> AO VIVO
        </div>
      </div>

      {/* Radar */}
      <div className="mt-4 relative aspect-square w-full overflow-hidden rounded-3xl border border-white/10 bg-surface/40">
        <div className="absolute inset-0 grid-bg opacity-30" />
        {/* rings */}
        {[0.95, 0.7, 0.45, 0.2].map((s, i) => (
          <div key={i} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-electric/20" style={{ width: `${s * 100}%`, height: `${s * 100}%` }} />
        ))}
        {/* sweep */}
        <motion.div
          className="absolute left-1/2 top-1/2 origin-left"
          style={{
            width: "50%",
            height: 2,
            background: "linear-gradient(90deg, oklch(0.72 0.22 246), transparent)",
            boxShadow: "0 0 12px oklch(0.72 0.22 246)",
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 4, ease: "linear", repeat: Infinity }}
        />
        {/* center */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="h-3 w-3 rounded-full bg-electric shadow-[0_0_16px_var(--electric)]" />
        </div>
        {/* pings */}
        {pings.map((p) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
          >
            <div className="relative">
              <span className={`absolute -inset-3 animate-pulse-ring rounded-full border-2 ${p.hot ? "border-danger" : "border-neon"}`} />
              <span className={`block h-3 w-3 rounded-full ${p.hot ? "bg-danger shadow-[0_0_10px_var(--danger)]" : "bg-neon shadow-[0_0_10px_var(--neon)]"}`} />
              <div className="absolute left-4 top-1/2 -translate-y-1/2 whitespace-nowrap">
                <div className="rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-bold backdrop-blur">{p.value}</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* hot zones list */}
      <div className="mt-4 space-y-2">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Zonas quentes</div>
        {pings.map((p) => (
          <div key={p.id} className={`flex items-center justify-between rounded-2xl border p-3 ${p.hot ? "border-danger/30 bg-danger/5" : "border-white/10 bg-surface/60"}`}>
            <div className="flex items-center gap-3">
              <div className={`grid h-9 w-9 place-items-center rounded-xl ${p.hot ? "bg-danger/15 text-danger" : "bg-neon/15 text-neon"}`}>
                <Navigation className="h-4 w-4" />
              </div>
              <div>
                <div className="font-display text-sm font-bold">{p.label}</div>
                <div className="text-[10px] text-muted-foreground">{p.dist} · pico em 5 min</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-sm font-bold text-foreground">{p.value}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">média</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ────────── Screen 5: Efeito Enxame (SOS) ────────── */

function ShieldScreen() {
  const [armed, setArmed] = useState(false);
  const [hold, setHold] = useState(0);
  const holdRef = useRef<number | null>(null);

  const startHold = () => {
    if (armed) return;
    const t0 = performance.now();
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / 1400);
      setHold(k);
      if (k >= 1) {
        setArmed(true);
        setHold(0);
        return;
      }
      holdRef.current = requestAnimationFrame(tick);
    };
    holdRef.current = requestAnimationFrame(tick);
  };
  const stopHold = () => {
    if (holdRef.current) cancelAnimationFrame(holdRef.current);
    if (!armed) setHold(0);
  };

  return (
    <div className={`relative h-full w-full overflow-y-auto px-5 pb-4 pt-4 scrollbar-none transition-colors ${armed ? "bg-danger/5" : ""}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className={`text-[10px] font-semibold uppercase tracking-[0.3em] ${armed ? "text-danger" : "text-muted-foreground"}`}>05 · Efeito Enxame</div>
          <h1 className="mt-1 font-display text-2xl font-bold">{armed ? "Escudo ativo" : "Segurança comunitária"}</h1>
          <p className="mt-1 text-xs text-muted-foreground">{armed ? "12 parceiros convergindo." : "Pressione e segure para ativar."}</p>
        </div>
        <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${armed ? "border-danger/40 bg-danger/15 text-danger border animate-pulse" : "border border-white/10 bg-surface/60 text-muted-foreground"}`}>
          {armed ? <Eye className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
          {armed ? "TRANSMITINDO" : "PROTEGIDO"}
        </div>
      </div>

      {/* SOS button */}
      <div className="my-6 grid place-items-center">
        <button
          onPointerDown={startHold}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          onClick={() => armed && setArmed(false)}
          className="relative h-52 w-52 rounded-full"
        >
          {/* rings */}
          {armed && (
            <>
              <span className="absolute inset-0 animate-pulse-ring rounded-full border-2 border-danger" />
              <span className="absolute inset-0 animate-pulse-ring-slow rounded-full border-2 border-danger/60" />
            </>
          )}
          {/* core */}
          <div
            className={`absolute inset-3 grid place-items-center rounded-full ${armed ? "animate-danger-pulse" : ""}`}
            style={{
              background: armed
                ? "var(--gradient-danger)"
                : "linear-gradient(135deg, oklch(0.22 0.025 262), oklch(0.14 0.018 260))",
              border: armed ? "2px solid oklch(0.74 0.28 22)" : "2px solid oklch(1 0 0 / 0.1)",
            }}
          >
            <div className="text-center">
              <ShieldAlert className={`mx-auto h-12 w-12 ${armed ? "text-white" : "text-danger"}`} />
              <div className={`mt-2 font-display text-2xl font-bold ${armed ? "text-white" : "text-foreground"}`}>{armed ? "SOS" : "SEGURAR"}</div>
              <div className={`text-[10px] uppercase tracking-widest ${armed ? "text-white/90" : "text-muted-foreground"}`}>{armed ? "toque para encerrar" : "1.5s para ativar"}</div>
            </div>
          </div>
          {/* progress ring */}
          {!armed && hold > 0 && (
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="48" fill="none" stroke="oklch(0.74 0.28 22)" strokeWidth="2"
                strokeDasharray={`${hold * 301.6} 301.6`} strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>

      {/* Swarm responders */}
      <div className="rounded-3xl border border-white/10 bg-surface/60 p-4">
        <div className="flex items-center justify-between">
          <div className="font-display text-sm font-bold">Rede ao seu redor</div>
          <span className="font-mono text-[11px] text-neon">12 ativos · 350m</span>
        </div>
        <div className="mt-3 space-y-2">
          {[
            { name: "Marina S.", role: "Fundadora", dist: "120 m", eta: armed ? "30s" : "—" },
            { name: "Bruno K.", role: "Motoboy", dist: "180 m", eta: armed ? "45s" : "—" },
            { name: "Carla R.", role: "Fundadora", dist: "260 m", eta: armed ? "1 min" : "—" },
          ].map((r, i) => (
            <motion.div
              key={r.name}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`flex items-center justify-between rounded-2xl border p-3 ${armed ? "border-danger/20 bg-danger/5" : "border-white/8 bg-surface-2/60"}`}
            >
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full" style={{ background: "var(--gradient-electric)" }}>
                  <span className="font-display text-xs font-bold text-white">{r.name.split(" ").map(n => n[0]).join("")}</span>
                </div>
                <div>
                  <div className="text-sm font-semibold">{r.name}</div>
                  <div className="text-[10px] text-muted-foreground">{r.role} · {r.dist}</div>
                </div>
              </div>
              {armed ? (
                <div className="rounded-full bg-danger/15 px-2 py-0.5 font-mono text-[10px] font-bold text-danger">{r.eta}</div>
              ) : (
                <ShieldCheck className="h-4 w-4 text-neon/70" />
              )}
            </motion.div>
          ))}
        </div>
      </div>

      <div className="mt-3 mb-2 grid grid-cols-2 gap-2">
        <button className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-surface/60 px-3 py-3 text-xs font-semibold">
          <Phone className="h-4 w-4 text-electric" /> 190 / 192
        </button>
        <button className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-surface/60 px-3 py-3 text-xs font-semibold">
          <Users className="h-4 w-4 text-neon" /> Contatos
        </button>
      </div>
    </div>
  );
}
