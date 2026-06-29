/**
 * VUUP API contracts — types consumed by the frontend.
 *
 * These mirror the server schemas in server/src/models/schemas.ts.
 * Frontend uses these for TanStack Query typed fetchers and form validation.
 *
 * NOTE: This file uses Zod for runtime validation on the client side too.
 */

export type UserRole = "passenger" | "driver" | "motoboy" | "founder" | "admin";
export type UserStatus = "active" | "suspended" | "pending_verification";
export type RouteType = "livre" | "fixa" | "programada";
export type RideStatus =
  "searching" | "accepted" | "driver_en_route" | "in_progress" | "completed" | "cancelled";
export type TransactionType =
  | "ride_earning"
  | "ride_payment"
  | "delivery_earning"
  | "delivery_payment"
  | "passive_income"
  | "coupon_credit"
  | "campaign_bonus"
  | "campaign_discount"
  | "transfer_in"
  | "transfer_out"
  | "withdrawal"
  | "deposit"
  | "refund"
  | "platform_fee"
  | "sociedade_upgrade";
export type SafetyEventType =
  | "sos_triggered"
  | "route_deviation"
  | "speed_alert"
  | "community_report"
  | "police_checkpoint"
  | "road_hazard";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface UserPublic {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  rating: number | null;
  role: UserRole;
}

export interface User extends UserPublic {
  email: string;
  phone: string;
  status: UserStatus;
  documentNumber: string | null;
  totalRides: number;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterRequest {
  phone: string;
  fullName?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserPublic;
}

export interface Ride {
  id: string;
  passengerId: string;
  driverId: string | null;
  routeType: RouteType;
  status: RideStatus;
  origin: LatLng & { address: string };
  destination: LatLng & { address: string };
  estimatedDistanceKm: number;
  estimatedDurationMin: number;
  fareEstimate: number;
  fareActual: number | null;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RideRequest {
  routeType: RouteType;
  origin: LatLng & { address: string };
  destination: LatLng & { address: string };
  scheduledAt?: string;
}

export interface Wallet {
  id: string;
  userId: string;
  balanceCents: number;
  pendingCents: number;
  lifetimeEarningsCents: number;
  campaignDiscountRemainingDays: number;
  campaignDiscountDailyAmountCents: number;
  campaignDiscountStartedAt: string | null;
  updatedAt: string;
  // Enriched fields from GET /wallet
  passiveIncomeSharePercent?: number;
  sociedadeNivel?: SociedadeNivel;
  campaignDiscount?: {
    remainingDays: number;
    dailyAmountCents: number;
    totalRemainingCents: number;
  } | null;
}

// ─── Onda 5: Payment Gateway ──────────────────────────────────────────────────

export type PaymentMethod = "wallet" | "pix" | "credit_card";
export type PaymentStatus = "pending" | "processing" | "approved" | "failed" | "refunded";

export interface PaymentGatewayTransaction {
  id: string;
  walletTransactionId: string | null;
  userId: string;
  rideId: string | null;
  amountCents: number;
  method: PaymentMethod;
  status: PaymentStatus;
  gatewayRef: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Onda 5: Wallet Transfer ──────────────────────────────────────────────────

export type TransferStatus = "pending" | "completed" | "failed" | "cancelled";

export interface WalletTransfer {
  id: string;
  fromWalletId: string;
  toWalletId: string;
  amountCents: number;
  description: string;
  status: TransferStatus;
  scheduledAt: string | null;
  executedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WalletTransferRequest {
  toUserId: string;
  amountCents: number;
  description?: string;
  scheduledAt?: string;
}

// ─── Onda 5: Campaign Discount ────────────────────────────────────────────────

export interface CampaignDiscount {
  id: string;
  userId: string;
  totalDays: number;
  dailyAmountCents: number;
  daysRemaining: number;
  totalCreditedCents: number;
  activatedAt: string;
  lastAppliedAt: string | null;
  completedAt: string | null;
  isActive: boolean;
}

// ─── Onda 5: Sociedade ────────────────────────────────────────────────────────

export type SociedadeNivel = "starter" | "bronze" | "silver" | "gold" | "platinum";

export interface SociedadeParticipacao {
  id: string;
  userId: string;
  nivel: SociedadeNivel;
  participacaoPercent: number;
  passiveIncomeSharePercent: number;
  totalInvestedCents: number;
  totalReceivedPassiveIncomeCents: number;
  zoneId: string | null;
  upgradedAt: string | null;
  createdAt: string;
  updatedAt: string;
  nextUpgrade?: {
    targetNivel: SociedadeNivel;
    costCents: number | null;
    passiveIncomeSharePercent: number;
  } | null;
}

export interface Transaction {
  id: string;
  walletId: string;
  type: TransactionType;
  amountCents: number;
  balanceAfterCents: number;
  referenceId: string | null;
  description: string;
  createdAt: string;
}

export interface SafetyEvent {
  id: string;
  reporterId: string;
  rideId: string | null;
  type: SafetyEventType;
  location: LatLng;
  description: string;
  isResolved: boolean;
  upvotes: number;
  createdAt: string;
  resolvedAt: string | null;
}

export interface CarpoolRoute {
  id: string;
  driverId: string;
  name: string;
  routeType: RouteType;
  stops: Array<LatLng & { address: string; order: number }>;
  maxPassengers: number;
  currentPassengers: number;
  farePerSeat: number;
  departureTime: string | null;
  scheduledAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

// ─── API base URL ─────────────────────────────────────────────────────────────
// Reads from Vite env var VITE_API_URL; falls back to localhost for dev.
// Add VITE_API_URL to your .env or .env.local to override.
export const API_BASE_URL: string =
  (import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ??
  "http://localhost:3001";
