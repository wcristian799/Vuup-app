/**
 * VUUP Pricing Engine
 *
 * Calculates fare breakdown for each ride modality:
 *   - livre     : on-demand, standard tariff
 *   - fixa      : fixed-route, 10% discount on distance component
 *   - programada: scheduled, base + scheduling fee surcharge
 *   - motoboy   : delivery/motorbike, cheaper per-km rate
 *
 * All monetary values are in BRL cents (integer).
 *
 * Distance/duration are mocked here (straight-line × correction factor).
 * In production, replace estimateDistanceKm / estimateDurationMin with a
 * routing API call (Google Maps, OSRM, etc.).
 */

import type { FareBreakdown, Modality } from "../models/schemas.js";
import type { Coupon } from "../models/schemas.js";

// ─── Tariff table ─────────────────────────────────────────────────────────────

interface Tariff {
  baseCents: number;
  perKmCents: number;
  perMinCents: number;
  schedulingFeeCents: number; // flat fee for pre-scheduled rides
  platformFeePercent: number; // % taken by platform (0-100)
}

const TARIFFS: Record<Modality, Tariff> = {
  livre: {
    baseCents: 500, // R$5.00 base
    perKmCents: 190, // R$1.90/km
    perMinCents: 30, // R$0.30/min
    schedulingFeeCents: 0,
    platformFeePercent: 10,
  },
  fixa: {
    baseCents: 400, // R$4.00 base (discount for fixed route)
    perKmCents: 170, // R$1.70/km (10% cheaper)
    perMinCents: 25,
    schedulingFeeCents: 0,
    platformFeePercent: 10,
  },
  programada: {
    baseCents: 500,
    perKmCents: 190,
    perMinCents: 30,
    schedulingFeeCents: 150, // R$1.50 scheduling surcharge
    platformFeePercent: 10,
  },
  motoboy: {
    baseCents: 350, // R$3.50 base (lighter vehicle, cheaper)
    perKmCents: 150, // R$1.50/km
    perMinCents: 20,
    schedulingFeeCents: 0,
    platformFeePercent: 12, // slightly higher platform fee for deliveries
  },
};

// ─── Geo helpers ─────────────────────────────────────────────────────────────

interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Haversine formula — straight-line distance in km.
 * Multiplied by 1.35 as a realistic road-distance correction factor.
 */
export function estimateDistanceKm(origin: LatLng, destination: LatLng): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(destination.lat - origin.lat);
  const dLng = toRad(destination.lng - origin.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(origin.lat)) * Math.cos(toRad(destination.lat)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightLine = R * c;
  return Math.round(straightLine * 1.35 * 100) / 100; // 2 decimal places
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Naive duration estimate: assume 25 km/h average urban speed.
 * In production this comes from the routing API.
 */
export function estimateDurationMin(distanceKm: number): number {
  return Math.max(3, Math.round((distanceKm / 25) * 60));
}

// ─── Surge multiplier ─────────────────────────────────────────────────────────

/**
 * Simple time-based surge: rush hours (07–09, 17–19) get 1.3×.
 * In production: replace with demand/supply ratio from the matching engine.
 */
export function computeSurgeMultiplier(at: Date = new Date()): number {
  const hour = at.getUTCHours(); // Use UTC to avoid server timezone issues
  if ((hour >= 10 && hour < 12) || (hour >= 20 && hour < 22)) return 1.3;
  return 1.0;
}

// ─── Coupon application ───────────────────────────────────────────────────────

/**
 * Returns the discount amount in cents for the given coupon, or 0 if the
 * coupon is not applicable (inactive, expired, min fare not met, etc.).
 */
export function applyCoupon(coupon: Coupon | undefined, subtotalCents: number): number {
  if (!coupon || !coupon.isActive) return 0;

  const now = new Date();
  if (new Date(coupon.validFrom) > now || new Date(coupon.validUntil) < now) return 0;
  if (subtotalCents < coupon.minFareCents) return 0;
  if (coupon.maxUsages !== null && coupon.usagesCount >= coupon.maxUsages) return 0;

  if (coupon.discountType === "fixed") {
    return Math.min(coupon.discountValue, subtotalCents);
  }
  // percent
  return Math.min(Math.round((subtotalCents * coupon.discountValue) / 100), subtotalCents);
}

// ─── Main pricing function ────────────────────────────────────────────────────

export interface PriceInput {
  modality: Modality;
  origin: LatLng;
  destination: LatLng;
  at?: Date; // request time (for surge); defaults to now
  coupon?: Coupon;
}

export function calculateFare(input: PriceInput): FareBreakdown {
  const { modality, origin, destination } = input;
  const tariff = TARIFFS[modality];

  const distanceKm = estimateDistanceKm(origin, destination);
  const durationMin = estimateDurationMin(distanceKm);
  const surgeMultiplier = computeSurgeMultiplier(input.at);

  const distanceCents = Math.round(distanceKm * tariff.perKmCents);
  const timeCents = Math.round(durationMin * tariff.perMinCents);
  const schedulingFeeCents = tariff.schedulingFeeCents;

  const subtotal = Math.round(
    (tariff.baseCents + distanceCents + timeCents + schedulingFeeCents) * surgeMultiplier,
  );

  const couponDiscountCents = applyCoupon(input.coupon, subtotal);
  const totalCents = Math.max(0, subtotal - couponDiscountCents);

  const platformFeeCents = Math.round((totalCents * tariff.platformFeePercent) / 100);
  const driverEarningsCents = totalCents - platformFeeCents;

  return {
    modality,
    distanceKm,
    durationMin,
    baseCents: tariff.baseCents,
    distanceCents,
    timeCents,
    schedulingFeeCents,
    surgeMultiplier,
    couponDiscountCents,
    totalCents,
    platformFeePercent: tariff.platformFeePercent,
    driverEarningsCents,
  };
}
