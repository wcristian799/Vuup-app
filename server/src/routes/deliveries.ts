/**
 * Deliveries routes (protected) — backed by SQLite.
 *
 * POST /deliveries              — create a new delivery (client/passenger)
 * GET  /deliveries              — list caller's deliveries
 * GET  /deliveries/open         — (motoboy) available pending deliveries
 * GET  /deliveries/:id          — delivery detail
 * PATCH /deliveries/:id/status  — motoboy advances delivery status
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";

import { requireAuth } from "../middleware/auth.js";
import { LatLngSchema } from "../models/schemas.js";
import { calculateFare } from "../lib/pricing.js";
import {
  createDelivery,
  findDeliveryById,
  listDeliveriesByClient,
  listDeliveriesByMotoboy,
  listOpenDeliveries,
  updateDeliveryStatus,
  type DeliveryStatus,
} from "../db/repos/deliveries.js";
import { findWalletByUserId, addTransaction } from "../db/repos/wallet.js";

const DELIVERY_TRANSITIONS: Record<string, string[]> = {
  pending: ["accepted", "failed"],
  accepted: ["picked_up", "failed"],
  picked_up: ["in_transit"],
  in_transit: ["delivered", "failed"],
  delivered: [],
  failed: [],
};

export const deliveriesRouter = new Hono();

deliveriesRouter.use("/*", requireAuth);

// POST /deliveries
deliveriesRouter.post(
  "/",
  zValidator(
    "json",
    z.object({
      pickup: LatLngSchema.extend({ address: z.string(), contactName: z.string() }),
      dropoff: LatLngSchema.extend({ address: z.string(), contactName: z.string() }),
      packageDescription: z.string().max(200),
    }),
  ),
  (c) => {
    const userId = c.get("userId");
    const body = c.req.valid("json");

    const fareBreakdown = calculateFare({
      modality: "motoboy",
      origin: body.pickup,
      destination: body.dropoff,
    });

    const delivery = createDelivery({
      clientId: userId,
      pickup: body.pickup,
      dropoff: body.dropoff,
      packageDescription: body.packageDescription,
      estimatedDistanceKm: fareBreakdown.distanceKm,
      fareEstimate: fareBreakdown.totalCents,
    });

    return c.json({ delivery, fareBreakdown }, 201);
  },
);

// GET /deliveries/open — available for motoboys
deliveriesRouter.get("/open", (c) => {
  const userRole = c.get("userRole");
  if (userRole !== "motoboy" && userRole !== "admin") {
    throw new HTTPException(403, { message: "Only motoboys can view open deliveries" });
  }
  const deliveries = listOpenDeliveries(50);
  return c.json({ data: deliveries });
});

// GET /deliveries
deliveriesRouter.get("/", (c) => {
  const userId = c.get("userId");
  const userRole = c.get("userRole");

  const deliveries =
    userRole === "motoboy"
      ? listDeliveriesByMotoboy(userId)
      : listDeliveriesByClient(userId);

  return c.json({
    data: deliveries,
    pagination: { page: 1, limit: 20, total: deliveries.length, hasNext: false },
  });
});

// GET /deliveries/:id
deliveriesRouter.get("/:id", (c) => {
  const delivery = findDeliveryById(c.req.param("id"));
  if (!delivery) return c.json({ code: "NOT_FOUND", message: "Delivery not found" }, 404);
  return c.json(delivery);
});

// PATCH /deliveries/:id/status
deliveriesRouter.patch(
  "/:id/status",
  zValidator(
    "json",
    z.object({
      status: z.enum(["accepted", "picked_up", "in_transit", "delivered", "failed"]),
    }),
  ),
  (c) => {
    const userId = c.get("userId");
    const userRole = c.get("userRole");
    const delivery = findDeliveryById(c.req.param("id"));

    if (!delivery) return c.json({ code: "NOT_FOUND", message: "Delivery not found" }, 404);

    if (userRole !== "motoboy" && userRole !== "admin") {
      throw new HTTPException(403, { message: "Only motoboys can update delivery status" });
    }

    const { status: nextStatus } = c.req.valid("json");
    const allowed = DELIVERY_TRANSITIONS[delivery.status] ?? [];
    if (!allowed.includes(nextStatus)) {
      return c.json(
        {
          code: "INVALID_TRANSITION",
          message: `Cannot transition from "${delivery.status}" to "${nextStatus}"`,
          allowedTransitions: allowed,
        },
        422,
      );
    }

    const fareActual = nextStatus === "delivered" ? delivery.fareEstimate : undefined;
    const updated = updateDeliveryStatus(
      delivery.id,
      nextStatus as DeliveryStatus,
      nextStatus === "accepted" ? userId : undefined,
      fareActual,
    );

    // Settle earnings on delivery
    if (nextStatus === "delivered" && updated) {
      const motoboyWallet = findWalletByUserId(userId);
      if (motoboyWallet) {
        const earnings = Math.round(delivery.fareEstimate * 0.88); // 88% to motoboy
        addTransaction({
          walletId: motoboyWallet.id,
          type: "delivery_earning",
          amountCents: earnings,
          referenceId: delivery.id,
          description: `Entrega #${delivery.id.slice(0, 8)}`,
          isEarning: true,
        });
      }
      const clientWallet = findWalletByUserId(delivery.clientId);
      if (clientWallet) {
        addTransaction({
          walletId: clientWallet.id,
          type: "delivery_payment",
          amountCents: -delivery.fareEstimate,
          referenceId: delivery.id,
          description: `Pagamento entrega #${delivery.id.slice(0, 8)}`,
        });
      }
    }

    return c.json(updated);
  },
);
