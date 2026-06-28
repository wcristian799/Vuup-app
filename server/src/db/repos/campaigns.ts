/**
 * Campaigns & Coupons repository.
 */

import { randomUUID } from "node:crypto";
import db from "../database.js";
import type { Coupon, Campaign } from "../../models/schemas.js";

// ─── Coupon mappers ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toCoupon(row: Record<string, any>): Coupon {
  return {
    id: row["id"],
    code: row["code"],
    campaignId: row["campaign_id"] ?? null,
    discountType: row["discount_type"],
    discountValue: row["discount_value"],
    maxUsages: row["max_usages"] ?? null,
    usagesCount: row["usages_count"],
    minFareCents: row["min_fare_cents"],
    validFrom: row["valid_from"],
    validUntil: row["valid_until"],
    isActive: Boolean(row["is_active"]),
  };
}

// ─── Coupon queries ───────────────────────────────────────────────────────────

export function findCouponByCode(code: string): Coupon | undefined {
  const row = db.prepare("SELECT * FROM coupons WHERE code = ?").get(code.toUpperCase()) as
    | Record<string, unknown>
    | undefined;
  return row ? toCoupon(row) : undefined;
}

export function findCouponById(id: string): Coupon | undefined {
  const row = db.prepare("SELECT * FROM coupons WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? toCoupon(row) : undefined;
}

export function listCoupons(campaignId?: string): Coupon[] {
  const rows = campaignId
    ? (db.prepare("SELECT * FROM coupons WHERE campaign_id = ?").all(campaignId) as Record<
        string,
        unknown
      >[])
    : (db.prepare("SELECT * FROM coupons ORDER BY valid_until DESC").all() as Record<
        string,
        unknown
      >[]);
  return rows.map(toCoupon);
}

export interface CreateCouponInput {
  code: string;
  campaignId?: string | null;
  discountType: "fixed" | "percent";
  discountValue: number;
  maxUsages?: number | null;
  minFareCents?: number;
  validFrom: string;
  validUntil: string;
}

export function createCoupon(input: CreateCouponInput): Coupon {
  const id = randomUUID();
  db.prepare(`
    INSERT INTO coupons (
      id, code, campaign_id, discount_type, discount_value,
      max_usages, usages_count, min_fare_cents,
      valid_from, valid_until, is_active
    ) VALUES (
      @id, @code, @campaign_id, @discount_type, @discount_value,
      @max_usages, 0, @min_fare_cents,
      @valid_from, @valid_until, 1
    )
  `).run({
    id,
    code: input.code.toUpperCase(),
    campaign_id: input.campaignId ?? null,
    discount_type: input.discountType,
    discount_value: input.discountValue,
    max_usages: input.maxUsages ?? null,
    min_fare_cents: input.minFareCents ?? 0,
    valid_from: input.validFrom,
    valid_until: input.validUntil,
  });
  return findCouponById(id)!;
}

/** Atomically increment usages_count if the coupon is still usable. Returns false if exhausted. */
export function redeemCoupon(code: string): boolean {
  const coupon = findCouponByCode(code);
  if (!coupon || !coupon.isActive) return false;
  const now = new Date().toISOString();
  if (now < coupon.validFrom || now > coupon.validUntil) return false;
  if (coupon.maxUsages !== null && coupon.usagesCount >= coupon.maxUsages) return false;

  db.prepare(
    "UPDATE coupons SET usages_count = usages_count + 1 WHERE code = ?",
  ).run(code.toUpperCase());
  return true;
}

// ─── Campaign mappers ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toCampaign(row: Record<string, any>): Campaign {
  return {
    id: row["id"],
    clientId: row["client_id"],
    name: row["name"],
    status: row["status"],
    targetAudience: JSON.parse(row["target_audience"] ?? "[]"),
    budgetCents: row["budget_cents"],
    spentCents: row["spent_cents"],
    impressions: row["impressions"],
    clicks: row["clicks"],
    couponIds: JSON.parse(row["coupon_ids"] ?? "[]"),
    startsAt: row["starts_at"],
    endsAt: row["ends_at"],
    createdAt: row["created_at"],
  };
}

// ─── Campaign queries ─────────────────────────────────────────────────────────

export function findCampaignById(id: string): Campaign | undefined {
  const row = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? toCampaign(row) : undefined;
}

export function listCampaignsByClient(clientId: string): Campaign[] {
  const rows = db
    .prepare("SELECT * FROM campaigns WHERE client_id = ? ORDER BY created_at DESC")
    .all(clientId) as Record<string, unknown>[];
  return rows.map(toCampaign);
}

export function listAllCampaigns(status?: string): Campaign[] {
  const rows = status
    ? (db
        .prepare("SELECT * FROM campaigns WHERE status = ? ORDER BY created_at DESC")
        .all(status) as Record<string, unknown>[])
    : (db
        .prepare("SELECT * FROM campaigns ORDER BY created_at DESC")
        .all() as Record<string, unknown>[]);
  return rows.map(toCampaign);
}

export interface CreateCampaignInput {
  clientId: string;
  name: string;
  targetAudience: string[];
  budgetCents: number;
  startsAt: string;
  endsAt: string;
}

export function createCampaign(input: CreateCampaignInput): Campaign {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO campaigns (
      id, client_id, name, status,
      target_audience, budget_cents, spent_cents, impressions, clicks,
      coupon_ids, starts_at, ends_at, created_at
    ) VALUES (
      @id, @client_id, @name, 'draft',
      @target_audience, @budget_cents, 0, 0, 0,
      '[]', @starts_at, @ends_at, @created_at
    )
  `).run({
    id,
    client_id: input.clientId,
    name: input.name,
    target_audience: JSON.stringify(input.targetAudience),
    budget_cents: input.budgetCents,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    created_at: now,
  });
  return findCampaignById(id)!;
}

export function updateCampaignStatus(
  id: string,
  status: "draft" | "active" | "paused" | "completed" | "cancelled",
): Campaign | undefined {
  db.prepare("UPDATE campaigns SET status = ? WHERE id = ?").run(status, id);
  return findCampaignById(id);
}

export function attachCouponToCampaign(campaignId: string, couponId: string): void {
  const campaign = findCampaignById(campaignId);
  if (!campaign) return;
  const ids: string[] = campaign.couponIds;
  if (!ids.includes(couponId)) {
    ids.push(couponId);
    db.prepare("UPDATE campaigns SET coupon_ids = ? WHERE id = ?").run(
      JSON.stringify(ids),
      campaignId,
    );
  }
}
