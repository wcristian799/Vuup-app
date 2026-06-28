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

export const LoginRequestSchema = z.object({
  phone: z.string(),
  otpCode: z.string().length(6),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const LoginResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(), // seconds
  user: UserPublicSchema,
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

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
  "withdrawal",
  "deposit",
  "refund",
  "platform_fee",
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
