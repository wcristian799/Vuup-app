/**
 * VUUP Geocoding — Nominatim/OSM adapter (VUU-67)
 *
 * Encapsulates all geocoding behind a swappable interface so we can migrate to
 * Google Maps / Mapbox later without touching the screens that consume it.
 *
 * Usage policy for Nominatim (https://operations.osmfoundation.org/policies/nominatim/):
 *  - Must send a descriptive User-Agent (VUUP app identifier below).
 *  - No more than 1 request/second — enforced here via per-call debounce at the
 *    call site (300 ms), plus a module-level timestamp guard for safety.
 *  - No bulk/automated queries — autocomplete is gated by user typing.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GeocodingResult {
  /** Nominatim place_id (string) or Google place_id — servico-opaque */
  placeId: string;
  /** Human-readable display label, already formatted by the servico */
  label: string;
  /** Short name suitable for a badge or chip */
  shortLabel: string;
  lat: number;
  lng: number;
}

export interface GeocodingProvider {
  search(query: string, signal?: AbortSignal): Promise<GeocodingResult[]>;
  reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<GeocodingResult | null>;
}

// ─── Nominatim OSM servico ───────────────────────────────────────────────────

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

/**
 * User-Agent header value sent to Nominatim.
 * Required by their usage policy: must identify the app / contact.
 */
const USER_AGENT = "VuupApp/1.0 (contact: wellington.santos@byteintelligence.com.br)";

/** ISO 8601 timestamp of the last request — prevents > 1 req/s bursts. */
let _lastRequestAt = 0;
const MIN_INTERVAL_MS = 1_000;

async function nominatimFetch(url: string, signal?: AbortSignal): Promise<Response> {
  const now = Date.now();
  const elapsed = now - _lastRequestAt;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise<void>((res) => setTimeout(res, MIN_INTERVAL_MS - elapsed));
  }
  _lastRequestAt = Date.now();

  return fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.7",
    },
    signal,
  });
}

function nominatimToResult(item: NominatimItem): GeocodingResult {
  const short =
    item.address?.road ??
    item.address?.suburb ??
    item.address?.city_district ??
    item.name ??
    item.display_name.split(",")[0] ??
    "";

  return {
    placeId: String(item.place_id),
    label: item.display_name,
    shortLabel: short,
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
  };
}

interface NominatimItem {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
  address?: {
    road?: string;
    suburb?: string;
    city?: string;
    city_district?: string;
    state?: string;
    country?: string;
  };
}

export class NominatimProvider implements GeocodingProvider {
  /** Bias results toward this bounding box (Brazil default). */
  private viewbox: string;
  private bounded: "0" | "1";

  constructor(
    viewbox = "-73.98,-33.75,-28.85,5.27", // Brazil bounding box
    bounded: "0" | "1" = "0",
  ) {
    this.viewbox = viewbox;
    this.bounded = bounded;
  }

  async search(query: string, signal?: AbortSignal): Promise<GeocodingResult[]> {
    if (!query.trim()) return [];

    const params = new URLSearchParams({
      q: query,
      format: "jsonv2",
      addressdetails: "1",
      limit: "5",
      countrycodes: "br",
      viewbox: this.viewbox,
      bounded: this.bounded,
    });

    const res = await nominatimFetch(`${NOMINATIM_BASE}/search?${params.toString()}`, signal);
    if (!res.ok) throw new Error(`Nominatim search failed: ${res.status}`);

    const items = (await res.json()) as NominatimItem[];
    return items.map(nominatimToResult);
  }

  async reverseGeocode(
    lat: number,
    lng: number,
    signal?: AbortSignal,
  ): Promise<GeocodingResult | null> {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: "jsonv2",
      addressdetails: "1",
    });

    const res = await nominatimFetch(`${NOMINATIM_BASE}/reverse?${params.toString()}`, signal);
    if (!res.ok) return null;

    const item = (await res.json()) as NominatimItem & { error?: string };
    if ("error" in item) return null;
    return nominatimToResult(item);
  }
}

// ─── Default servico singleton ───────────────────────────────────────────────

let _provider: GeocodingProvider = new NominatimProvider();

/** Replace the active servico (e.g. swap in Google Maps in production). */
export function setGeocodingProvider(p: GeocodingProvider): void {
  _provider = p;
}

export function getGeocodingProvider(): GeocodingProvider {
  return _provider;
}

// ─── Convenience wrappers ─────────────────────────────────────────────────────

export function searchAddress(
  query: string,
  signal?: AbortSignal,
): Promise<GeocodingResult[]> {
  return _provider.search(query, signal);
}

export function reverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<GeocodingResult | null> {
  return _provider.reverseGeocode(lat, lng, signal);
}

// ─── Quick-address presets ────────────────────────────────────────────────────

/**
 * Named places that resolve lazily via Nominatim when the user taps them.
 * Keys are exactly what the UI shows in the quick-address chips.
 */
export const QUICK_ADDRESS_QUERIES: Record<string, string> = {
  Casa: "Residência",
  Trabalho: "Centro comercial São Paulo",
  Aeroporto: "Aeroporto Internacional de São Paulo Guarulhos",
  Shopping: "Shopping center São Paulo",
};
