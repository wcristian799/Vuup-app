/**
 * Delivery routes (protected) — VUU-26: Entregas e Comércio
 *
 * POST /deliveries              — client creates a new delivery order
 * GET  /deliveries              — list deliveries for the current user (sender or motoboy)
 * GET  /deliveries/:id          — single delivery detail
 * PATCH /deliveries/:id/accept  — motoboy accepts a pending delivery
 * PATCH /deliveries/:id/status  — motoboy updates delivery status (picked_up → in_transit → delivered | failed)
 * GET  /deliveries/available    — list pending deliveries near a location (for motoboys)
 * POST /deliveries/:id/rate     — client rates the delivery
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";

import { requireAuth } from "../middleware/auth.js";
import { DeliverySchema, LatLngSchema } from "../models/schemas.js";
import type { Delivery } from "../models/schemas.js";
import { findWalletByUserId, createTransaction } from "../models/mock-data.js";

export const deliveryRouter = new Hono();

deliveryRouter.use("/*", requireAuth);

// ─── In-memory delivery store ──────────────────────────────────────────────────

export const MOCK_DELIVERIES: Delivery[] = [];

function findDeliveryById(id: string): Delivery | undefined {
  return MOCK_DELIVERIES.find((d) => d.id === id);
}

// ─── Pricing helper ───────────────────────────────────────────────────────────

const DELIVERY_BASE_CENTS = 600; // R$6.00 base
const DELIVERY_PER_KM_CENTS = 200; // R$2.00/km
const DELIVERY_PLATFORM_FEE_PERCENT = 15;

function estimateDeliveryFare(distanceKm: number): number {
  return Math.round(DELIVERY_BASE_CENTS + distanceKm * DELIVERY_PER_KM_CENTS);
}

function estimateDistance(
  pickup: { lat: number; lng: number },
  dropoff: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((dropoff.lat - pickup.lat) * Math.PI) / 180;
  const dLng = ((dropoff.lng - pickup.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((pickup.lat * Math.PI) / 180) *
      Math.cos((dropoff.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── POST /deliveries — create delivery order ─────────────────────────────────

const CreateDeliverySchema = z.object({
  pickup: LatLngSchema.extend({ address: z.string(), contactName: z.string() }),
  dropoff: LatLngSchema.extend({ address: z.string(), contactName: z.string() }),
  packageDescription: z.string().max(200),
});

deliveryRouter.post("/", zValidator("json", CreateDeliverySchema), (c) => {
  const userId = c.get("userId");
  const body = c.req.valid("json");
  const now = new Date().toISOString();

  const distKm = estimateDistance(body.pickup, body.dropoff);
  const fareEstimate = estimateDeliveryFare(distKm);

  const delivery = DeliverySchema.parse({
    id: crypto.randomUUID(),
    clientId: userId,
    motoboyId: null,
    status: "pending",
    pickup: body.pickup,
    dropoff: body.dropoff,
    packageDescription: body.packageDescription,
    estimatedDistanceKm: Math.round(distKm * 10) / 10,
    fareEstimate,
    fareActual: null,
    createdAt: now,
    updatedAt: now,
  });

  MOCK_DELIVERIES.push(delivery);
  return c.json({ delivery, message: "Pedido de entrega criado com sucesso" }, 201);
});

// ─── GET /deliveries — list user's deliveries ─────────────────────────────────

deliveryRouter.get("/", (c) => {
  const userId = c.get("userId");
  const role = c.req.query("role") ?? "client"; // "client" | "motoboy"

  let deliveries: Delivery[];
  if (role === "motoboy") {
    deliveries = MOCK_DELIVERIES.filter((d) => d.motoboyId === userId);
  } else {
    deliveries = MOCK_DELIVERIES.filter((d) => d.clientId === userId);
  }

  deliveries = deliveries.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const page = Number(c.req.query("page") ?? 1);
  const limit = Math.min(Number(c.req.query("limit") ?? 20), 100);
  const total = deliveries.length;
  const data = deliveries.slice((page - 1) * limit, (page - 1) * limit + limit);

  return c.json({
    data,
    pagination: { page, limit, total, hasNext: (page - 1) * limit + limit < total },
  });
});

// ─── GET /deliveries/available — pending deliveries for motoboys ──────────────

deliveryRouter.get("/available", (c) => {
  const pending = MOCK_DELIVERIES.filter((d) => d.status === "pending" && d.motoboyId === null);
  return c.json({ data: pending, total: pending.length });
});

// ─── GET /deliveries/:id ──────────────────────────────────────────────────────

deliveryRouter.get("/:id", (c) => {
  const delivery = findDeliveryById(c.req.param("id"));
  if (!delivery) {
    return c.json({ code: "NOT_FOUND", message: "Entrega não encontrada" }, 404);
  }
  return c.json(delivery);
});

// ─── PATCH /deliveries/:id/accept — motoboy accepts ──────────────────────────

deliveryRouter.patch("/:id/accept", (c) => {
  const userId = c.get("userId");
  const delivery = findDeliveryById(c.req.param("id"));

  if (!delivery) {
    return c.json({ code: "NOT_FOUND", message: "Entrega não encontrada" }, 404);
  }
  // Check assignment first (409 Conflict) — takes priority over status check
  if (delivery.motoboyId !== null) {
    return c.json(
      { code: "ALREADY_ASSIGNED", message: "Entrega já foi aceita por outro motoboy" },
      409,
    );
  }
  if (delivery.status !== "pending") {
    return c.json(
      { code: "INVALID_STATUS", message: `Entrega não está pendente (status: ${delivery.status})` },
      422,
    );
  }

  const idx = MOCK_DELIVERIES.indexOf(delivery);
  MOCK_DELIVERIES[idx] = {
    ...delivery,
    motoboyId: userId,
    status: "accepted",
    updatedAt: new Date().toISOString(),
  };

  return c.json(MOCK_DELIVERIES[idx]);
});

// ─── PATCH /deliveries/:id/status — motoboy updates progress ─────────────────

const ValidTransitions: Record<string, string[]> = {
  accepted: ["picked_up"],
  picked_up: ["in_transit"],
  in_transit: ["delivered", "failed"],
};

const UpdateDeliveryStatusSchema = z.object({
  status: z.enum(["picked_up", "in_transit", "delivered", "failed"]),
});

deliveryRouter.patch("/:id/status", zValidator("json", UpdateDeliveryStatusSchema), (c) => {
  const userId = c.get("userId");
  const body = c.req.valid("json");
  const delivery = findDeliveryById(c.req.param("id"));

  if (!delivery) {
    return c.json({ code: "NOT_FOUND", message: "Entrega não encontrada" }, 404);
  }
  if (delivery.motoboyId !== userId) {
    throw new HTTPException(403, {
      message: "Apenas o motoboy responsável pode atualizar o status",
    });
  }

  const allowed = ValidTransitions[delivery.status] ?? [];
  if (!allowed.includes(body.status)) {
    return c.json(
      {
        code: "INVALID_TRANSITION",
        message: `Transição inválida: ${delivery.status} → ${body.status}. Permitidas: ${allowed.join(", ")}`,
      },
      422,
    );
  }

  const now = new Date().toISOString();
  const idx = MOCK_DELIVERIES.indexOf(delivery);

  let fareActual = delivery.fareActual;
  if (body.status === "delivered") {
    fareActual = delivery.fareEstimate; // use estimate as actual in mock

    // Settle payment: debit client wallet, credit motoboy wallet
    const clientWallet = findWalletByUserId(delivery.clientId);
    const motoboyWallet = findWalletByUserId(userId);

    if (clientWallet && motoboyWallet) {
      const platformFeeCents = Math.round((fareActual * DELIVERY_PLATFORM_FEE_PERCENT) / 100);
      const motoboyEarning = fareActual - platformFeeCents;

      createTransaction({
        walletId: clientWallet.id,
        type: "delivery_payment",
        amountCents: -fareActual,
        referenceId: delivery.id,
        description: `Entrega #${delivery.id.slice(-8)} — R$${(fareActual / 100).toFixed(2)}`,
      });

      createTransaction({
        walletId: motoboyWallet.id,
        type: "delivery_earning",
        amountCents: motoboyEarning,
        referenceId: delivery.id,
        description: `Entrega #${delivery.id.slice(-8)} — ganho R$${(motoboyEarning / 100).toFixed(2)} (taxa ${DELIVERY_PLATFORM_FEE_PERCENT}%)`,
      });
    }
  }

  MOCK_DELIVERIES[idx] = {
    ...delivery,
    status: body.status,
    fareActual,
    updatedAt: now,
  };

  return c.json(MOCK_DELIVERIES[idx]);
});
