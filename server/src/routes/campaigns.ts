/**
 * Campaigns & Coupons routes (protected) — backed by SQLite.
 *
 * Campaigns (founder/admin only to create):
 *   POST /campaigns              — create campaign
 *   GET  /campaigns              — list campaigns (own or all for admin)
 *   GET  /campaigns/:id          — campaign detail
 *   PATCH /campaigns/:id/status  — update status
 *
 * Coupons:
 *   POST /campaigns/:id/coupons  — issue coupon for a campaign
 *   POST /coupons/validate       — validate a coupon code (public for fare estimate)
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";

import { requireAuth } from "../middleware/auth.js";
import {
  createCampaign,
  findCampaignById,
  listCampaignsByClient,
  listAllCampaigns,
  updateCampaignStatus,
  createCoupon,
  findCouponByCode,
  attachCouponToCampaign,
  listCoupons,
} from "../db/repos/campaigns.js";

export const campaignsRouter = new Hono();

campaignsRouter.use("/*", requireAuth);

// POST /campaigns
campaignsRouter.post(
  "/",
  zValidator(
    "json",
    z.object({
      name: z.string().min(2).max(100),
      targetAudience: z.array(z.enum(["passenger", "driver", "motoboy", "founder", "admin"])),
      budgetCents: z.number().int().positive(),
      startsAt: z.string().datetime(),
      endsAt: z.string().datetime(),
    }),
  ),
  (c) => {
    const userId = c.get("userId");
    const userRole = c.get("userRole");

    if (userRole !== "founder" && userRole !== "admin") {
      throw new HTTPException(403, { message: "Only founders/admins can create campaigns" });
    }

    const body = c.req.valid("json");
    const campaign = createCampaign({ clientId: userId, ...body });
    return c.json(campaign, 201);
  },
);

// GET /campaigns
campaignsRouter.get("/", (c) => {
  const userId = c.get("userId");
  const userRole = c.get("userRole");
  const status = c.req.query("status");

  const campaigns = userRole === "admin" ? listAllCampaigns(status) : listCampaignsByClient(userId);

  return c.json({ data: campaigns });
});

// GET /campaigns/:id
campaignsRouter.get("/:id", (c) => {
  const userId = c.get("userId");
  const userRole = c.get("userRole");
  const campaign = findCampaignById(c.req.param("id"));

  if (!campaign) return c.json({ code: "NOT_FOUND", message: "Campaign not found" }, 404);

  if (campaign.clientId !== userId && userRole !== "admin") {
    throw new HTTPException(403, { message: "Access denied" });
  }

  return c.json(campaign);
});

// PATCH /campaigns/:id/status
campaignsRouter.patch(
  "/:id/status",
  zValidator(
    "json",
    z.object({
      status: z.enum(["draft", "active", "paused", "completed", "cancelled"]),
    }),
  ),
  (c) => {
    const userId = c.get("userId");
    const userRole = c.get("userRole");
    const campaign = findCampaignById(c.req.param("id"));

    if (!campaign) return c.json({ code: "NOT_FOUND", message: "Campaign not found" }, 404);
    if (campaign.clientId !== userId && userRole !== "admin") {
      throw new HTTPException(403, { message: "Access denied" });
    }

    const { status } = c.req.valid("json");
    const updated = updateCampaignStatus(campaign.id, status);
    return c.json(updated);
  },
);

// POST /campaigns/:id/coupons — issue a coupon for a campaign
campaignsRouter.post(
  "/:id/coupons",
  zValidator(
    "json",
    z.object({
      code: z.string().min(4).max(20),
      discountType: z.enum(["fixed", "percent"]),
      discountValue: z.number().positive(),
      maxUsages: z.number().int().positive().optional(),
      minFareCents: z.number().int().nonnegative().optional(),
      validFrom: z.string().datetime(),
      validUntil: z.string().datetime(),
    }),
  ),
  (c) => {
    const userId = c.get("userId");
    const userRole = c.get("userRole");
    const campaign = findCampaignById(c.req.param("id"));

    if (!campaign) return c.json({ code: "NOT_FOUND", message: "Campaign not found" }, 404);
    if (campaign.clientId !== userId && userRole !== "admin") {
      throw new HTTPException(403, { message: "Access denied" });
    }

    const body = c.req.valid("json");
    const coupon = createCoupon({ ...body, campaignId: campaign.id });
    attachCouponToCampaign(campaign.id, coupon.id);

    return c.json(coupon, 201);
  },
);

// GET /campaigns/:id/coupons
campaignsRouter.get("/:id/coupons", (c) => {
  const userId = c.get("userId");
  const userRole = c.get("userRole");
  const campaign = findCampaignById(c.req.param("id"));

  if (!campaign) return c.json({ code: "NOT_FOUND", message: "Campaign not found" }, 404);
  if (campaign.clientId !== userId && userRole !== "admin") {
    throw new HTTPException(403, { message: "Access denied" });
  }

  const coupons = listCoupons(campaign.id);
  return c.json({ data: coupons });
});

// POST /coupons/validate (mounted at /coupons/validate from index)
export const couponsRouter = new Hono();
couponsRouter.use("/*", requireAuth);

couponsRouter.post("/validate", zValidator("json", z.object({ code: z.string() })), (c) => {
  const { code } = c.req.valid("json");
  const coupon = findCouponByCode(code);
  if (!coupon) {
    return c.json({ valid: false, reason: "Coupon not found" });
  }
  const now = new Date().toISOString();
  if (!coupon.isActive) return c.json({ valid: false, reason: "Coupon inactive" });
  if (now < coupon.validFrom || now > coupon.validUntil)
    return c.json({ valid: false, reason: "Coupon expired or not yet valid" });
  if (coupon.maxUsages !== null && coupon.usagesCount >= coupon.maxUsages)
    return c.json({ valid: false, reason: "Coupon usage limit reached" });

  return c.json({
    valid: true,
    coupon: {
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minFareCents: coupon.minFareCents,
    },
  });
});
