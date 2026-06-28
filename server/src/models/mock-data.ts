/**
 * Mock data store — in-memory fixtures used by mock endpoints.
 * Replace with real DB calls when persistence is wired.
 */

import type {
  User,
  Ride,
  Wallet,
  Transaction,
  CarpoolRoute,
  SafetyEvent,
  PatronLink,
  VipWindowState,
  Coupon,
} from "./schemas.js";

const NOW = new Date().toISOString();
const YESTERDAY = new Date(Date.now() - 86_400_000).toISOString();

export const MOCK_USERS: User[] = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    fullName: "Ana Costa",
    email: "ana@vuup.app",
    phone: "+5511999990001",
    role: "passenger",
    status: "active",
    avatarUrl: null,
    documentNumber: "12345678901",
    rating: 4.8,
    totalRides: 42,
    createdAt: YESTERDAY,
    updatedAt: NOW,
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    fullName: "Carlos Moto",
    email: "carlos@vuup.app",
    phone: "+5511999990002",
    role: "driver",
    status: "active",
    avatarUrl: null,
    documentNumber: "98765432100",
    rating: 4.9,
    totalRides: 327,
    createdAt: YESTERDAY,
    updatedAt: NOW,
  },
  {
    id: "00000000-0000-0000-0000-000000000003",
    fullName: "Roberto Fundador",
    email: "roberto@vuup.app",
    phone: "+5511999990003",
    role: "founder",
    status: "active",
    avatarUrl: null,
    documentNumber: "11122233344",
    rating: null,
    totalRides: 0,
    createdAt: YESTERDAY,
    updatedAt: NOW,
  },
];

export const MOCK_RIDES: Ride[] = [
  {
    id: "10000000-0000-0000-0000-000000000001",
    passengerId: "00000000-0000-0000-0000-000000000001",
    driverId: "00000000-0000-0000-0000-000000000002",
    routeType: "livre",
    status: "completed",
    origin: { lat: -23.5505, lng: -46.6333, address: "Av. Paulista, 1000 — SP" },
    destination: { lat: -23.5489, lng: -46.6388, address: "Rua Augusta, 500 — SP" },
    estimatedDistanceKm: 2.3,
    estimatedDurationMin: 8,
    fareEstimate: 1450,
    fareActual: 1450,
    scheduledAt: null,
    startedAt: YESTERDAY,
    completedAt: YESTERDAY,
    createdAt: YESTERDAY,
    updatedAt: NOW,
  },
  {
    id: "10000000-0000-0000-0000-000000000002",
    passengerId: "00000000-0000-0000-0000-000000000001",
    driverId: null,
    routeType: "livre",
    status: "searching",
    origin: { lat: -23.5612, lng: -46.6565, address: "Pinheiros, SP" },
    destination: { lat: -23.5489, lng: -46.6388, address: "Consolação, SP" },
    estimatedDistanceKm: 3.1,
    estimatedDurationMin: 12,
    fareEstimate: 1890,
    fareActual: null,
    scheduledAt: null,
    startedAt: null,
    completedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
  },
];

export const MOCK_WALLETS: Wallet[] = [
  {
    id: "20000000-0000-0000-0000-000000000001",
    userId: "00000000-0000-0000-0000-000000000001",
    balanceCents: 8750,
    pendingCents: 0,
    lifetimeEarningsCents: 0,
    updatedAt: NOW,
  },
  {
    id: "20000000-0000-0000-0000-000000000002",
    userId: "00000000-0000-0000-0000-000000000002",
    balanceCents: 124300,
    pendingCents: 2900,
    lifetimeEarningsCents: 528000,
    updatedAt: NOW,
  },
  {
    id: "20000000-0000-0000-0000-000000000003",
    userId: "00000000-0000-0000-0000-000000000003",
    balanceCents: 312000,
    pendingCents: 0,
    lifetimeEarningsCents: 1_200_000,
    updatedAt: NOW,
  },
];

export const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: "30000000-0000-0000-0000-000000000001",
    walletId: "20000000-0000-0000-0000-000000000002",
    type: "ride_earning",
    amountCents: 1305, // 90% of fare after platform fee
    balanceAfterCents: 124300,
    referenceId: "10000000-0000-0000-0000-000000000001",
    description: "Corrida #10000000-01 — tarifa R$14,50",
    createdAt: YESTERDAY,
  },
  {
    id: "30000000-0000-0000-0000-000000000002",
    walletId: "20000000-0000-0000-0000-000000000003",
    type: "passive_income",
    amountCents: 8400,
    balanceAfterCents: 312000,
    referenceId: null,
    description: "Dividendo fundador — Zona Pinheiros Junho/2026",
    createdAt: NOW,
  },
];

export const MOCK_CARPOOL_ROUTES: CarpoolRoute[] = [
  {
    id: "40000000-0000-0000-0000-000000000001",
    driverId: "00000000-0000-0000-0000-000000000002",
    name: "Paulista → Consolação → Santa Cecília",
    routeType: "fixa",
    stops: [
      { lat: -23.5642, lng: -46.6522, address: "Paulista MASP", order: 0 },
      { lat: -23.5535, lng: -46.6621, address: "Consolação", order: 1 },
      { lat: -23.538, lng: -46.6523, address: "Santa Cecília", order: 2 },
    ],
    maxPassengers: 3,
    currentPassengers: 1,
    farePerSeat: 700,
    departureTime: "07:30",
    scheduledAt: null,
    isActive: true,
    createdAt: YESTERDAY,
  },
];

export const MOCK_SAFETY_EVENTS: SafetyEvent[] = [
  {
    id: "50000000-0000-0000-0000-000000000001",
    reporterId: "00000000-0000-0000-0000-000000000002",
    rideId: null,
    type: "police_checkpoint",
    location: { lat: -23.549, lng: -46.6388 },
    description: "Blitz policial na Rua Augusta com Paulista",
    isResolved: false,
    upvotes: 7,
    createdAt: NOW,
    resolvedAt: null,
  },
  {
    id: "50000000-0000-0000-0000-000000000002",
    reporterId: "00000000-0000-0000-0000-000000000001",
    rideId: null,
    type: "road_hazard",
    location: { lat: -23.5612, lng: -46.6565 },
    description: "Buraco grande na pista sentido centro",
    isResolved: true,
    upvotes: 12,
    createdAt: YESTERDAY,
    resolvedAt: NOW,
  },
];

// ─── Simple in-memory lookup helpers ─────────────────────────────────────────

export function findUserById(id: string): User | undefined {
  return MOCK_USERS.find((u) => u.id === id);
}

export function findUserByPhone(phone: string): User | undefined {
  return MOCK_USERS.find((u) => u.phone === phone);
}

export function findWalletByUserId(userId: string): Wallet | undefined {
  return MOCK_WALLETS.find((w) => w.userId === userId);
}

export function findTransactionsByWalletId(walletId: string): Transaction[] {
  return MOCK_TRANSACTIONS.filter((t) => t.walletId === walletId);
}

// ─── Patron links (Motorista Patrono) ────────────────────────────────────────

/** Ana (passenger 001) has Carlos (driver 002) as her patron driver */
export const MOCK_PATRON_LINKS: PatronLink[] = [
  {
    id: "60000000-0000-0000-0000-000000000001",
    passengerId: "00000000-0000-0000-0000-000000000001",
    driverId: "00000000-0000-0000-0000-000000000002",
    label: "Carlos — Motorista Fixo",
    isActive: true,
    createdAt: YESTERDAY,
    updatedAt: NOW,
  },
];

export function findPatronLinkByPassenger(
  passengerId: string,
): PatronLink | undefined {
  return MOCK_PATRON_LINKS.find((l) => l.passengerId === passengerId && l.isActive);
}

export function findPatronLinksByDriver(driverId: string): PatronLink[] {
  return MOCK_PATRON_LINKS.filter((l) => l.driverId === driverId && l.isActive);
}

// ─── VIP windows (active 15-second patron windows) ────────────────────────────

export const MOCK_VIP_WINDOWS: VipWindowState[] = [];

export function findVipWindowByRide(rideId: string): VipWindowState | undefined {
  return MOCK_VIP_WINDOWS.find((w) => w.rideId === rideId);
}

export function createVipWindow(rideId: string, patronDriverId: string): VipWindowState {
  const now = new Date();
  const expires = new Date(now.getTime() + 15_000); // 15 seconds
  const window: VipWindowState = {
    rideId,
    patronDriverId,
    windowOpensAt: now.toISOString(),
    windowExpiresAt: expires.toISOString(),
    outcome: "pending",
  };
  MOCK_VIP_WINDOWS.push(window);
  return window;
}

// ─── Coupons (sample data) ────────────────────────────────────────────────────

export const MOCK_COUPONS: Coupon[] = [
  {
    id: "70000000-0000-0000-0000-000000000001",
    code: "VUUP10",
    campaignId: null,
    discountType: "percent",
    discountValue: 10,
    maxUsages: 1000,
    usagesCount: 0,
    minFareCents: 500,
    validFrom: YESTERDAY,
    validUntil: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    isActive: true,
  },
  {
    id: "70000000-0000-0000-0000-000000000002",
    code: "PRIMEIRAVIAGEM",
    campaignId: null,
    discountType: "fixed",
    discountValue: 500, // R$5 off
    maxUsages: null,
    usagesCount: 0,
    minFareCents: 800,
    validFrom: YESTERDAY,
    validUntil: new Date(Date.now() + 90 * 86_400_000).toISOString(),
    isActive: true,
  },
];

export function findCouponByCode(code: string): Coupon | undefined {
  return MOCK_COUPONS.find((c) => c.code === code.toUpperCase());
}
