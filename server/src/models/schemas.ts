/**
 * VUUP Data Model — canonical Zod schemas + TypeScript types
 * These are the contract-first types shared across API request/response validation.
 *
 * Domain entities:
 *  - User (passenger | driver | motoboy | founder | admin)
 *  - Ride  (livre/fixa/programada)
 *  - CarpoolRoute (livre | fixa | programada)
 *  - Delivery (motoboy job)
 *  - Wallet + Transaction
 *  - Campaign + Client (B2B advertisers)
 *  - Coupon
 *  - MarketplaceListing (with LTV valuation)
 *  - SafetyEvent (community shield)
 */

import { z } from "zod";

// ─── Shared primitives ───────────────────────────────────────────────────────

export const IdSchema = z.string().uuid();
export const TimestampSchema = z.string().datetime();
export const LatLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

// ─── User ────────────────────────────────────────────────────────────────────

export const UserRoleSchema = z.enum([
  "passenger",
  "driver",
  "motoboy",
  "founder", // passive-income franchise holder
  "admin",
]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserStatusSchema = z.enum(["active", "suspended", "pending_verification"]);

export const UserSchema = z.object({
  id: IdSchema,
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().regex(/^\+?[1-9]\d{6,14}$/),
  role: UserRoleSchema,
  status: UserStatusSchema,
  avatarUrl: z.string().url().nullable(),
  documentNumber: z.string().nullable(), // CPF/CNPJ
  rating: z.number().min(0).max(5).nullable(),
  totalRides: z.number().int().nonnegative(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type User = z.infer<typeof UserSchema>;

export const UserPublicSchema = UserSchema.pick({
  id: true,
  fullName: true,
  avatarUrl: true,
  rating: true,
  role: true,
});
export type UserPublic = z.infer<typeof UserPublicSchema>;

// ─── Auth ─────────────────────────────────────────────────────────────────────

// Registration / session — OTP removed (founder decision 2026-06-29). The user
// registers (or re-authenticates an existing phone) at the moment of requesting
// a ride. Name is optional so the quick-register modal can submit phone-only.
export const RegisterRequestSchema = z.object({
  phone: z.string().min(8).max(20),
  fullName: z.string().min(1).max(120).optional(),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(), // seconds
  user: UserPublicSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const RefreshRequestSchema = z.object({
  refreshToken: z.string(),
});

// ─── Ride ─────────────────────────────────────────────────────────────────────

export const RouteTypeSchema = z.enum([
  "livre", // on-demand, no fixed route
  "fixa", // recurring fixed route
  "programada", // scheduled departure time
]);
export type RouteType = z.infer<typeof RouteTypeSchema>;

export const RideStatusSchema = z.enum([
  "searching",
  "accepted",
  "driver_en_route",
  "in_progress",
  "completed",
  "cancelled",
]);
export type RideStatus = z.infer<typeof RideStatusSchema>;

export const RideSchema = z.object({
  id: IdSchema,
  passengerId: IdSchema,
  driverId: IdSchema.nullable(),
  routeType: RouteTypeSchema,
  status: RideStatusSchema,
  origin: LatLngSchema.extend({ address: z.string() }),
  destination: LatLngSchema.extend({ address: z.string() }),
  estimatedDistanceKm: z.number().positive(),
  estimatedDurationMin: z.number().int().positive(),
  fareEstimate: z.number().nonnegative(), // BRL cents
  fareActual: z.number().nonnegative().nullable(),
  scheduledAt: TimestampSchema.nullable(), // for "programada"
  startedAt: TimestampSchema.nullable(),
  completedAt: TimestampSchema.nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type Ride = z.infer<typeof RideSchema>;

export const RideRequestSchema = z.object({
  routeType: RouteTypeSchema,
  origin: LatLngSchema.extend({ address: z.string() }),
  destination: LatLngSchema.extend({ address: z.string() }),
  scheduledAt: TimestampSchema.optional(),
});
export type RideRequest = z.infer<typeof RideRequestSchema>;

// ─── Carpool Route ────────────────────────────────────────────────────────────

export const CarpoolRouteSchema = z.object({
  id: IdSchema,
  driverId: IdSchema,
  name: z.string(),
  routeType: RouteTypeSchema,
  stops: z.array(LatLngSchema.extend({ address: z.string(), order: z.number().int() })),
  maxPassengers: z.number().int().min(1).max(8),
  currentPassengers: z.number().int().nonnegative(),
  farePerSeat: z.number().nonnegative(), // BRL cents
  departureTime: z.string().nullable(), // HH:MM for fixa
  scheduledAt: TimestampSchema.nullable(), // for programada
  isActive: z.boolean(),
  createdAt: TimestampSchema,
});
export type CarpoolRoute = z.infer<typeof CarpoolRouteSchema>;

// ─── Delivery ─────────────────────────────────────────────────────────────────

export const DeliveryStatusSchema = z.enum([
  "pending",
  "accepted",
  "picked_up",
  "in_transit",
  "delivered",
  "failed",
]);

export const DeliverySchema = z.object({
  id: IdSchema,
  clientId: IdSchema, // B2B client or passenger acting as sender
  motoboyId: IdSchema.nullable(),
  status: DeliveryStatusSchema,
  pickup: LatLngSchema.extend({ address: z.string(), contactName: z.string() }),
  dropoff: LatLngSchema.extend({ address: z.string(), contactName: z.string() }),
  packageDescription: z.string().max(200),
  estimatedDistanceKm: z.number().positive(),
  fareEstimate: z.number().nonnegative(),
  fareActual: z.number().nonnegative().nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type Delivery = z.infer<typeof DeliverySchema>;

// ─── Wallet & Transaction ─────────────────────────────────────────────────────

export const WalletSchema = z.object({
  id: IdSchema,
  userId: IdSchema,
  balanceCents: z.number().int(), // can be negative for debt
  pendingCents: z.number().int().nonnegative(), // locked / in-transit
  lifetimeEarningsCents: z.number().int().nonnegative(),
  // Campaign discount tracking (R$50/day for 60 days)
  campaignDiscountRemainingDays: z.number().int().nonnegative(),
  campaignDiscountDailyAmountCents: z.number().int().nonnegative(),
  campaignDiscountStartedAt: TimestampSchema.nullable(),
  updatedAt: TimestampSchema,
});
export type Wallet = z.infer<typeof WalletSchema>;

export const TransactionTypeSchema = z.enum([
  "ride_earning",
  "ride_payment",
  "delivery_earning",
  "delivery_payment",
  "passive_income", // founder dividend
  "coupon_credit",
  "campaign_bonus",
  "campaign_discount", // daily R$50 campaign discount
  "transfer_in", // received transfer from another wallet
  "transfer_out", // sent transfer to another wallet
  "withdrawal",
  "deposit",
  "refund",
  "platform_fee",
  "sociedade_upgrade", // sociedade upgrade payment
]);

export const TransactionSchema = z.object({
  id: IdSchema,
  walletId: IdSchema,
  type: TransactionTypeSchema,
  amountCents: z.number().int(), // positive = credit, negative = debit
  balanceAfterCents: z.number().int(),
  referenceId: z.string().nullable(), // ride/delivery/campaign id
  description: z.string(),
  createdAt: TimestampSchema,
});
export type Transaction = z.infer<typeof TransactionSchema>;

// ─── Campaign & Client ────────────────────────────────────────────────────────

export const CampaignStatusSchema = z.enum(["draft", "active", "paused", "completed", "cancelled"]);

export const ClientSchema = z.object({
  id: IdSchema,
  companyName: z.string(),
  cnpj: z.string().regex(/^\d{14}$/),
  contactEmail: z.string().email(),
  contactPhone: z.string(),
  logoUrl: z.string().url().nullable(),
  createdAt: TimestampSchema,
});
export type Client = z.infer<typeof ClientSchema>;

export const CampaignSchema = z.object({
  id: IdSchema,
  clientId: IdSchema,
  name: z.string(),
  status: CampaignStatusSchema,
  targetAudience: z.array(UserRoleSchema),
  budgetCents: z.number().int().positive(),
  spentCents: z.number().int().nonnegative(),
  impressions: z.number().int().nonnegative(),
  clicks: z.number().int().nonnegative(),
  couponIds: z.array(IdSchema),
  startsAt: TimestampSchema,
  endsAt: TimestampSchema,
  createdAt: TimestampSchema,
});
export type Campaign = z.infer<typeof CampaignSchema>;

// ─── Coupon ───────────────────────────────────────────────────────────────────

export const CouponDiscountTypeSchema = z.enum(["fixed", "percent"]);

export const CouponSchema = z.object({
  id: IdSchema,
  code: z.string().toUpperCase().min(4).max(20),
  campaignId: IdSchema.nullable(),
  discountType: CouponDiscountTypeSchema,
  discountValue: z.number().positive(), // cents or percent 0-100
  maxUsages: z.number().int().positive().nullable(),
  usagesCount: z.number().int().nonnegative(),
  minFareCents: z.number().int().nonnegative(),
  validFrom: TimestampSchema,
  validUntil: TimestampSchema,
  isActive: z.boolean(),
});
export type Coupon = z.infer<typeof CouponSchema>;

// ─── Marketplace Listing (with LTV valuation) ─────────────────────────────────

export const ListingCategorySchema = z.enum([
  "franchise_zone", // founder purchasing exclusive zone
  "vehicle_lease",
  "equipment",
  "route_package",
]);

export const MarketplaceListingSchema = z.object({
  id: IdSchema,
  sellerId: IdSchema,
  category: ListingCategorySchema,
  title: z.string(),
  description: z.string(),
  priceCents: z.number().int().positive(),
  // LTV valuation fields
  monthlyRevenueCents: z.number().int().nonnegative(), // projected monthly
  paybackMonths: z.number().int().positive().nullable(),
  estimatedLtvCents: z.number().int().nonnegative().nullable(), // 12-mo projection
  location: LatLngSchema.nullable(),
  isActive: z.boolean(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type MarketplaceListing = z.infer<typeof MarketplaceListingSchema>;

// ─── Safety Event ─────────────────────────────────────────────────────────────

export const SafetyEventTypeSchema = z.enum([
  "sos_triggered",
  "route_deviation",
  "speed_alert",
  "community_report",
  "police_checkpoint",
  "road_hazard",
]);

export const SafetyEventSchema = z.object({
  id: IdSchema,
  reporterId: IdSchema,
  rideId: IdSchema.nullable(),
  type: SafetyEventTypeSchema,
  location: LatLngSchema,
  description: z.string().max(500),
  isResolved: z.boolean(),
  upvotes: z.number().int().nonnegative(), // community confirmation
  createdAt: TimestampSchema,
  resolvedAt: TimestampSchema.nullable(),
});
export type SafetyEvent = z.infer<typeof SafetyEventSchema>;

// ─── Generic API response wrappers ───────────────────────────────────────────

export const PaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().min(1).max(100).default(20),
  total: z.number().int().nonnegative(),
  hasNext: z.boolean(),
});
export type Pagination = z.infer<typeof PaginationSchema>;

export function paginatedResponse<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    pagination: PaginationSchema,
  });
}

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

// ─── Pricing ──────────────────────────────────────────────────────────────────

/**
 * Modalities and their pricing parameters.
 *
 * Pricing formula (BRL cents):
 *   fare = baseCents + (distanceKm * perKmCents) + (durationMin * perMinCents)
 *
 * "motoboy" modality is for deliveries (faster, cheaper).
 * "livre"   on-demand ride — standard pricing.
 * "fixa"    fixed route ride — slight discount (shared-route benefit).
 * "programada" scheduled ride — scheduling fee applied.
 */
export const ModalitySchema = z.enum(["livre", "fixa", "programada", "motoboy"]);
export type Modality = z.infer<typeof ModalitySchema>;

export const FareEstimateRequestSchema = z.object({
  modality: ModalitySchema,
  origin: LatLngSchema,
  destination: LatLngSchema,
  scheduledAt: TimestampSchema.optional(), // required when modality = "programada"
  couponCode: z.string().optional(),
});
export type FareEstimateRequest = z.infer<typeof FareEstimateRequestSchema>;

export const FareBreakdownSchema = z.object({
  modality: ModalitySchema,
  distanceKm: z.number().nonnegative(),
  durationMin: z.number().int().nonnegative(),
  baseCents: z.number().int().nonnegative(),
  distanceCents: z.number().int().nonnegative(),
  timeCents: z.number().int().nonnegative(),
  schedulingFeeCents: z.number().int().nonnegative(),
  surgeMultiplier: z.number().min(1),
  couponDiscountCents: z.number().int().nonnegative(),
  totalCents: z.number().int().nonnegative(),
  platformFeePercent: z.number().min(0).max(100),
  driverEarningsCents: z.number().int().nonnegative(),
});
export type FareBreakdown = z.infer<typeof FareBreakdownSchema>;

// ─── Patron Driver / VIP Window ───────────────────────────────────────────────

/**
 * PatronLink: a named driver that a passenger has designated as their
 * "Motorista Patrono". When this passenger requests a ride, the patron driver
 * gets a 15-second exclusive VIP window before the ride is broadcast to all.
 */
export const PatronLinkSchema = z.object({
  id: IdSchema,
  passengerId: IdSchema,
  driverId: IdSchema,
  /** Friendly alias the passenger gave the driver (e.g. "Meu Motorista") */
  label: z.string().min(1).max(60),
  isActive: z.boolean(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type PatronLink = z.infer<typeof PatronLinkSchema>;

export const PatronLinkCreateSchema = z.object({
  driverId: IdSchema,
  label: z.string().min(1).max(60).default("Meu Motorista"),
});
export type PatronLinkCreate = z.infer<typeof PatronLinkCreateSchema>;

/**
 * VipWindowState: tracks the active VIP window for a ride.
 * Created when a ride enters "searching" and a patron driver exists.
 */
export const VipWindowStateSchema = z.object({
  rideId: IdSchema,
  patronDriverId: IdSchema,
  /** ISO timestamp when the 15-second window opens */
  windowOpensAt: TimestampSchema,
  /** ISO timestamp when the window expires (windowOpensAt + 15s) */
  windowExpiresAt: TimestampSchema,
  /** Whether the patron driver accepted within the window */
  outcome: z.enum(["pending", "accepted", "expired"]),
});
export type VipWindowState = z.infer<typeof VipWindowStateSchema>;

// ─── Extended RideRequest (adds modality + coupon) ───────────────────────────

export const RideRequestV2Schema = RideRequestSchema.extend({
  /** Modality defaults to routeType-mapped value; explicit override allowed */
  modality: ModalitySchema.optional(),
  couponCode: z.string().optional(),
}).refine(
  (v) => {
    // scheduledAt is required for "programada" routeType
    if (v.routeType === "programada" && !v.scheduledAt) return false;
    return true;
  },
  { message: "scheduledAt is required for programada rides", path: ["scheduledAt"] },
);

// ─── Onda 5: Payment Gateway (stub) ──────────────────────────────────────────

export const PaymentMethodSchema = z.enum([
  "wallet", // pay from Carteira Vuup balance
  "pix", // Pix (gateway stub)
  "credit_card", // credit card (gateway stub)
]);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const PaymentStatusSchema = z.enum([
  "pending",
  "processing",
  "approved",
  "failed",
  "refunded",
]);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

/**
 * PaymentGatewayTransaction: records an outgoing payment intent through the
 * gateway (stub). In production, this would be replaced with a real servico
 * (e.g., Asaas, Stripe, PagSeguro).
 */
export const PaymentGatewayTransactionSchema = z.object({
  id: IdSchema,
  walletTransactionId: IdSchema.nullable(), // linked wallet transaction after settlement
  userId: IdSchema,
  rideId: IdSchema.nullable(),
  amountCents: z.number().int().positive(),
  method: PaymentMethodSchema,
  status: PaymentStatusSchema,
  gatewayRef: z.string().nullable(), // external gateway reference
  failureReason: z.string().nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type PaymentGatewayTransaction = z.infer<typeof PaymentGatewayTransactionSchema>;

// ─── Onda 5: Wallet Transfer ──────────────────────────────────────────────────

export const TransferStatusSchema = z.enum(["pending", "completed", "failed", "cancelled"]);
export type TransferStatus = z.infer<typeof TransferStatusSchema>;

/**
 * WalletTransfer: tracks a value transfer between two Carteira Vuup wallets.
 * Supports immediate (daily) and scheduled transfers.
 */
export const WalletTransferSchema = z.object({
  id: IdSchema,
  fromWalletId: IdSchema,
  toWalletId: IdSchema,
  amountCents: z.number().int().positive(),
  description: z.string().max(200),
  status: TransferStatusSchema,
  /** When set, the transfer fires at this time (agendada); null = immediate */
  scheduledAt: TimestampSchema.nullable(),
  executedAt: TimestampSchema.nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type WalletTransfer = z.infer<typeof WalletTransferSchema>;

export const WalletTransferRequestSchema = z.object({
  toUserId: IdSchema,
  amountCents: z.number().int().min(100, "Minimum transfer is R$1,00"),
  description: z.string().max(200).default("Transferência Vuup"),
  /** ISO timestamp for scheduled transfer; omit for immediate */
  scheduledAt: TimestampSchema.optional(),
});
export type WalletTransferRequest = z.infer<typeof WalletTransferRequestSchema>;

// ─── Onda 5: Campaign Discount ────────────────────────────────────────────────

/**
 * CampaignDiscount: tracks the daily R$50 discount campaign for a user.
 * For 60 days starting from activation, R$50 is credited to the wallet daily.
 */
export const CampaignDiscountSchema = z.object({
  id: IdSchema,
  userId: IdSchema,
  totalDays: z.number().int().positive().default(60),
  dailyAmountCents: z.number().int().positive().default(5000), // R$50
  daysRemaining: z.number().int().nonnegative(),
  totalCreditedCents: z.number().int().nonnegative(),
  activatedAt: TimestampSchema,
  lastAppliedAt: TimestampSchema.nullable(),
  completedAt: TimestampSchema.nullable(),
  isActive: z.boolean(),
});
export type CampaignDiscount = z.infer<typeof CampaignDiscountSchema>;

export const ActivateCampaignDiscountRequestSchema = z.object({
  /** Optional override for daily amount (admin only); defaults to R$50 */
  dailyAmountCents: z.number().int().positive().optional(),
  /** Optional override for total days (admin only); defaults to 60 */
  totalDays: z.number().int().positive().optional(),
});

// ─── Onda 5: Upgrade de Sociedade ────────────────────────────────────────────

export const SociedadeNivelSchema = z.enum([
  "starter", // base level — no passive income share
  "bronze", // 1% passive income share
  "silver", // 3% passive income share
  "gold", // 7% passive income share
  "platinum", // 15% passive income share (founder level)
]);
export type SociedadeNivel = z.infer<typeof SociedadeNivelSchema>;

/** Monthly passive income % by nivel */
export const SOCIEDADE_PASSIVE_INCOME_PERCENT: Record<SociedadeNivel, number> = {
  starter: 0,
  bronze: 1,
  silver: 3,
  gold: 7,
  platinum: 15,
};

/** Upgrade cost in BRL cents per nivel transition */
export const SOCIEDADE_UPGRADE_COST_CENTS: Partial<Record<string, number>> = {
  "starter->bronze": 50000, // R$500
  "bronze->silver": 150000, // R$1.500
  "silver->gold": 500000, // R$5.000
  "gold->platinum": 2000000, // R$20.000
};

export const SociedadeParticipacaoSchema = z.object({
  id: IdSchema,
  userId: IdSchema,
  nivel: SociedadeNivelSchema,
  /** Percentage stake in the zone's revenue pool (0-100) */
  participacaoPercent: z.number().min(0).max(100),
  passiveIncomeSharePercent: z.number().min(0).max(100),
  totalInvestedCents: z.number().int().nonnegative(),
  totalReceivedPassiveIncomeCents: z.number().int().nonnegative(),
  zoneId: z.string().nullable(), // geographic zone assignment
  upgradedAt: TimestampSchema.nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type SociedadeParticipacao = z.infer<typeof SociedadeParticipacaoSchema>;

export const SociedadeUpgradeRequestSchema = z.object({
  targetNivel: SociedadeNivelSchema,
  /** Pay from wallet (default) or external payment */
  paymentMethod: PaymentMethodSchema.default("wallet"),
});
export type SociedadeUpgradeRequest = z.infer<typeof SociedadeUpgradeRequestSchema>;
