import * as React from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import { MapPin, Navigation, Search, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

// ─── Fix Leaflet default icon paths broken by bundlers ────────────────────────

// @ts-expect-error — Leaflet private property needed to override default icon URLs
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconUrl: new URL("leaflet/dist/images/marker-icon.png", import.meta.url).href,
  iconRetinaUrl: new URL("leaflet/dist/images/marker-icon-2x.png", import.meta.url).href,
  shadowUrl: new URL("leaflet/dist/images/marker-shadow.png", import.meta.url).href,
});

// ─── Custom driver icon ────────────────────────────────────────────────────────

const DRIVER_ICON_HTML = `
  <div style="
    width:40px;height:40px;border-radius:50%;
    display:flex;align-items:center;justify-content:center;
    background:oklch(0.10 0.015 260);
    border:2px solid oklch(0.72 0.22 246);
    box-shadow:0 0 10px oklch(0.72 0.22 246 / 0.5);
  ">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="oklch(0.72 0.22 246)" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-2"/>
      <circle cx="7" cy="17" r="2"/>
      <circle cx="15" cy="17" r="2"/>
    </svg>
  </div>
`;

const driverIcon = L.divIcon({
  html: DRIVER_ICON_HTML,
  className: "",
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20],
});

// ─── User location icon ────────────────────────────────────────────────────────

const USER_ICON_HTML = `
  <div style="
    width:24px;height:24px;border-radius:50%;
    display:flex;align-items:center;justify-content:center;
    background:oklch(0.72 0.22 246);
    box-shadow:0 0 12px oklch(0.72 0.22 246 / 0.7);
  ">
    <div style="width:8px;height:8px;border-radius:50%;background:white;"></div>
  </div>
`;

const userIcon = L.divIcon({
  html: USER_ICON_HTML,
  className: "",
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// ─── Default coordinates (São Paulo downtown) ─────────────────────────────────

const DEFAULT_POSITION: [number, number] = [-23.5505, -46.6333];

// ─── Sub-component: re-center map when coords change ─────────────────────────

function MapRecenter({ position }: { position: [number, number] }) {
  const map = useMap();
  React.useEffect(() => {
    map.flyTo(position, map.getZoom(), { duration: 1.5 });
  }, [map, position]);
  return null;
}

// ─── Floating cost bubbles (kept from original design) ────────────────────────

interface RideCostBubble {
  id: string;
  label: string;
  price: string;
  x: number;
  y: number;
  color: "electric" | "neon" | "gold";
}

const RIDE_BUBBLES: RideCostBubble[] = [
  { id: "b1", label: "Exclusiva", price: "R$ 24", x: 18, y: 28, color: "electric" },
  { id: "b2", label: "Rota Livre", price: "R$ 12", x: 68, y: 22, color: "neon" },
  { id: "b3", label: "Rota Fixa", price: "R$ 8", x: 78, y: 55, color: "neon" },
  { id: "b4", label: "Programada", price: "R$ 18", x: 20, y: 62, color: "gold" },
];

const BUBBLE_COLORS = {
  electric:
    "border-electric/60 bg-surface-2 text-electric [box-shadow:0_0_8px_oklch(0.72_0.22_246/0.3)]",
  neon: "border-neon/60 bg-surface-2 text-neon [box-shadow:0_0_8px_oklch(0.86_0.24_148/0.3)]",
  gold: "border-gold/60 bg-surface-2 text-gold [box-shadow:0_0_8px_oklch(0.84_0.16_88/0.3)]",
};

function CostBubble({ bubble }: { bubble: RideCostBubble }) {
  return (
    <div
      className={cn(
        "absolute rounded-full border px-2.5 py-1 text-center",
        "transition-transform duration-200 hover:scale-105 cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        BUBBLE_COLORS[bubble.color],
      )}
      style={{ left: `${bubble.x}%`, top: `${bubble.y}%`, transform: "translate(-50%, -50%)" }}
      role="button"
      tabIndex={0}
      aria-label={`${bubble.label}: ${bubble.price}`}
    >
      <p className="text-[9px] font-semibold opacity-70 leading-none">{bubble.label}</p>
      <p className="text-sm font-bold leading-tight">{bubble.price}</p>
    </div>
  );
}

// ─── Bottom search/action panel ───────────────────────────────────────────────

interface BottomPanelProps {
  onSelectRide: () => void;
}

function BottomPanel({ onSelectRide }: BottomPanelProps) {
  const [address, setAddress] = React.useState("");

  return (
    <div
      className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-border bg-card/90 backdrop-blur-md px-4 pt-3 pb-5 z-[1000]"
      style={{ boxShadow: "0 -8px 32px oklch(0 0 0 / 0.5)" }}
    >
      {/* Drag handle */}
      <div className="mx-auto mb-3 h-1 w-8 rounded-full bg-border" aria-hidden="true" />

      {/* Address search */}
      <p className="text-xs text-muted-foreground mb-2 font-medium">Para onde vamos?</p>
      <div className="relative mb-3">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Buscar destino..."
          aria-label="Buscar destino"
          className={cn(
            "w-full rounded-xl border border-border bg-surface-2",
            "pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-card",
          )}
        />
      </div>

      {/* Quick address suggestions */}
      <div className="flex gap-2 mb-3 overflow-x-auto scrollbar-none">
        {["Casa", "Trabalho", "Aeroporto", "Shopping"].map((place) => (
          <button
            key={place}
            onClick={() => setAddress(place)}
            className={cn(
              "flex-shrink-0 flex items-center gap-1.5 rounded-full border border-border bg-surface-3",
              "px-3 py-1.5 text-xs text-foreground hover:border-electric hover:text-electric transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
            aria-label={`Ir para ${place}`}
          >
            <MapPin size={10} aria-hidden="true" />
            {place}
          </button>
        ))}
      </div>

      {/* CTA */}
      <Button
        variant="electric"
        size="xl"
        className="w-full rounded-2xl"
        onClick={onSelectRide}
        aria-label="Escolher tipo de corrida"
      >
        <Navigation size={18} aria-hidden="true" />
        Escolher corrida
        <ChevronUp size={16} aria-hidden="true" />
      </Button>
    </div>
  );
}

// ─── FAB: re-center on user location ─────────────────────────────────────────

interface MapFABsProps {
  onRecenter: () => void;
}

function MapFABs({ onRecenter }: MapFABsProps) {
  return (
    <div
      className="absolute right-3 top-1/4 flex flex-col gap-2 z-[1000]"
      aria-label="Controles do mapa"
    >
      <button
        onClick={onRecenter}
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full",
          "border border-border bg-surface-2 text-electric",
          "[box-shadow:0_4px_12px_oklch(0_0_0/0.5)]",
          "hover:bg-surface-3 active:scale-95 transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        )}
        aria-label="Re-centrar mapa na minha localização"
      >
        <Navigation size={20} aria-hidden="true" />
      </button>
    </div>
  );
}

// ─── MapaVivo screen ──────────────────────────────────────────────────────────

interface MapaVivoProps {
  onSelectRide: () => void;
}

export function MapaVivo({ onSelectRide }: MapaVivoProps) {
  const [userPosition, setUserPosition] = React.useState<[number, number] | null>(null);
  const [mapCenter, setMapCenter] = React.useState<[number, number]>(DEFAULT_POSITION);
  const [recenterTrigger, setRecenterTrigger] = React.useState(0);

  // Geolocation: request once on mount, fallback to default if denied/unavailable
  React.useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserPosition(coords);
        setMapCenter(coords);
      },
      () => {
        // Permission denied or unavailable — use default (São Paulo)
        setMapCenter(DEFAULT_POSITION);
      },
      { timeout: 8000, maximumAge: 60_000 },
    );
  }, []);

  // Fetch nearby drivers from API (auto-refreshes every 30s)
  const { data: driversData } = useQuery({
    queryKey: ["nearby-drivers"],
    queryFn: () => apiClient.rides.nearbyDrivers(),
    refetchInterval: 30_000,
    retry: 1,
  });

  const drivers = driversData?.drivers ?? [];

  function handleRecenter() {
    if (userPosition) {
      setMapCenter(userPosition);
      setRecenterTrigger((t) => t + 1);
    }
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Leaflet map — full bleed */}
      <MapContainer
        center={mapCenter}
        zoom={15}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
        attributionControl={false}
        aria-label="Mapa da região atual com motoristas disponíveis"
      >
        {/* CARTO dark tile layer — no API key required */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains="abcd"
          maxZoom={20}
        />

        {/* Re-center animation when recenter is triggered */}
        <MapRecenter
          key={recenterTrigger}
          position={recenterTrigger > 0 ? (userPosition ?? mapCenter) : mapCenter}
        />

        {/* User location marker */}
        {userPosition && (
          <Marker
            position={userPosition}
            icon={userIcon}
            alt="Sua localização atual"
          />
        )}

        {/* Nearby drivers from API */}
        {drivers.map((driver) => (
          <Marker
            key={driver.id}
            position={[driver.location.lat, driver.location.lng]}
            icon={driverIcon}
            alt={`Motorista ${driver.fullName}`}
            title={`${driver.fullName} — ~${driver.estimatedArrivalMin} min`}
          />
        ))}
      </MapContainer>

      {/* Floating ride cost bubbles (overlay on top of map) */}
      <div className="absolute inset-0 pointer-events-none z-[999]" aria-hidden="true">
        <div className="pointer-events-auto">
          {RIDE_BUBBLES.map((bubble) => (
            <CostBubble key={bubble.id} bubble={bubble} />
          ))}
        </div>
      </div>

      {/* Map FABs */}
      <MapFABs onRecenter={handleRecenter} />

      {/* Bottom action panel */}
      <BottomPanel onSelectRide={onSelectRide} />
    </div>
  );
}
