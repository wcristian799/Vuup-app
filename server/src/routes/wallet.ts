/**
 * Wallet routes (protected) — Onda 5: Pagamentos, Carteira Vuup
 *
 * GET  /wallet                        — current user wallet balance (real-time)
 * GET  /wallet/transactions           — paginated transaction history
 * POST /wallet/transfer               — immediate or scheduled transfer
 * GET  /wallet/transfers              — list transfers for current wallet
 * GET  /wallet/transfers/:id          — single transfer detail
 * POST /wallet/campaign-discount      — activate daily campaign discount
 * POST /wallet/campaign-discount/apply — manually apply today's discount (admin/cron)
 * GET  /wallet/passive-income         — real-time passive income balance (founders)
 * POST /wallet/pay-ride               — pay for a ride via payment gateway stub
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";

import { requireAuth } from "../middleware/auth.js";
import {
  WalletTransferRequestSchema,
  ActivateCampaignDiscountRequestSchema,
  SOCIEDADE_PASSIVE_INCOME_PERCENT,
} from "../models/schemas.js";
import {
  MOCK_WALLET_TRANSFERS,
  MOCK_CAMPAIGN_DISCOUNTS,
  MOCK_PAYMENT_GATEWAY_TRANSACTIONS,
  findWalletByUserId,
  findTransactionsByWalletId,
  findTransfersByWalletId,
  findTransferById,
  findActiveCampaignDiscount,
  findSociedadeByUserId,
  createTransaction,
} from "../models/mock-data.js";

export const walletRouter = new Hono();

walletRouter.use("/*", requireAuth);

// ─── GET /wallet ──────────────────────────────────────────────────────────────

walletRouter.get("/", (c) => {
  const userId = c.get("userId");
  const wallet = findWalletByUserId(userId);
  if (!wallet) {
    return c.json({ code: "NOT_FOUND", message: "Wallet not found" }, 404);
  }

  // Real-time passive income: calculate current balance including passive income
  const sociedade = findSociedadeByUserId(userId);
  const passiveIncomeSharePercent = sociedade
    ? SOCIEDADE_PASSIVE_INCOME_PERCENT[sociedade.nivel]
    : 0;

  return c.json({
    ...wallet,
    passiveIncomeSharePercent,
    sociedadeNivel: sociedade?.nivel ?? "starter",
    // Include campaign discount summary
    campaignDiscount: wallet.campaignDiscountRemainingDays > 0
      ? {
          remainingDays: wallet.campaignDiscountRemainingDays,
          dailyAmountCents: wallet.campaignDiscountDailyAmountCents,
          totalRemainingCents:
            wallet.campaignDiscountRemainingDays * wallet.campaignDiscountDailyAmountCents,
        }
      : null,
  });
});

// ─── GET /wallet/transactions ─────────────────────────────────────────────────

walletRouter.get("/transactions", (c) => {
  const userId = c.get("userId");
  const wallet = findWalletByUserId(userId);
  if (!wallet) {
    return c.json({ code: "NOT_FOUND", message: "Wallet not found" }, 404);
  }

  const page = Number(c.req.query("page") ?? 1);
  const limit = Math.min(Number(c.req.query("limit") ?? 20), 100);
  const typeFilter = c.req.query("type");

  let transactions = findTransactionsByWalletId(wallet.id);
  // Sort newest first
  transactions = transactions.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  if (typeFilter) {
    transactions = transactions.filter((t) => t.type === typeFilter);
  }

  const total = transactions.length;
  const start = (page - 1) * limit;
  const data = transactions.slice(start, start + limit);

  return c.json({
    data,
    pagination: {
      page,
      limit,
      total,
      hasNext: start + limit < total,
    },
  });
});

// ─── POST /wallet/transfer ────────────────────────────────────────────────────

walletRouter.post("/transfer", zValidator("json", WalletTransferRequestSchema), (c) => {
  const userId = c.get("userId");
  const body = c.req.valid("json");

  const fromWallet = findWalletByUserId(userId);
  if (!fromWallet) {
    return c.json({ code: "NOT_FOUND", message: "Sender wallet not found" }, 404);
  }

  // Cannot transfer to yourself
  if (body.toUserId === userId) {
    return c.json({ code: "INVALID_TRANSFER", message: "Cannot transfer to yourself" }, 422);
  }

  const toWallet = findWalletByUserId(body.toUserId);
  if (!toWallet) {
    return c.json({ code: "NOT_FOUND", message: "Recipient wallet not found" }, 404);
  }

  const now = new Date().toISOString();
  const isScheduled = !!body.scheduledAt;

  // For immediate transfers, check sufficient balance
  if (!isScheduled && fromWallet.balanceCents < body.amountCents) {
    return c.json(
      {
        code: "INSUFFICIENT_BALANCE",
        message: `Saldo insuficiente. Saldo atual: R$${(fromWallet.balanceCents / 100).toFixed(2)}, valor solicitado: R$${(body.amountCents / 100).toFixed(2)}`,
      },
      422,
    );
  }

  const transfer: import("../models/schemas.js").WalletTransfer = {
    id: crypto.randomUUID(),
    fromWalletId: fromWallet.id,
    toWalletId: toWallet.id,
    amountCents: body.amountCents,
    description: body.description,
    status: isScheduled ? "pending" : "completed",
    scheduledAt: body.scheduledAt ?? null,
    executedAt: isScheduled ? null : now,
    createdAt: now,
    updatedAt: now,
  };

  MOCK_WALLET_TRANSFERS.push(transfer);

  if (!isScheduled) {
    // Execute immediately: debit sender, credit receiver
    createTransaction({
      walletId: fromWallet.id,
      type: "transfer_out",
      amountCents: -body.amountCents,
      referenceId: transfer.id,
      description: `Transferência para ${body.toUserId.slice(-8)}: ${body.description}`,
    });

    createTransaction({
      walletId: toWallet.id,
      type: "transfer_in",
      amountCents: body.amountCents,
      referenceId: transfer.id,
      description: `Transferência recebida de ${userId.slice(-8)}: ${body.description}`,
    });
  } else {
    // For scheduled: lock the funds in pending
    fromWallet.pendingCents += body.amountCents;
    fromWallet.updatedAt = now;
  }

  return c.json({ transfer, message: isScheduled ? "Transferência agendada com sucesso" : "Transferência realizada com sucesso" }, 201);
});

// ─── GET /wallet/transfers ────────────────────────────────────────────────────

walletRouter.get("/transfers", (c) => {
  const userId = c.get("userId");
  const wallet = findWalletByUserId(userId);
  if (!wallet) {
    return c.json({ code: "NOT_FOUND", message: "Wallet not found" }, 404);
  }

  const transfers = findTransfersByWalletId(wallet.id).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return c.json({
    data: transfers,
    pagination: { page: 1, limit: 20, total: transfers.length, hasNext: false },
  });
});

// ─── GET /wallet/transfers/:id ────────────────────────────────────────────────

walletRouter.get("/transfers/:id", (c) => {
  const userId = c.get("userId");
  const transfer = findTransferById(c.req.param("id"));

  if (!transfer) {
    return c.json({ code: "NOT_FOUND", message: "Transfer not found" }, 404);
  }

  const wallet = findWalletByUserId(userId);
  if (!wallet || (transfer.fromWalletId !== wallet.id && transfer.toWalletId !== wallet.id)) {
    throw new HTTPException(403, { message: "Not authorized to view this transfer" });
  }

  return c.json(transfer);
});

// ─── POST /wallet/campaign-discount ──────────────────────────────────────────

walletRouter.post(
  "/campaign-discount",
  zValidator("json", ActivateCampaignDiscountRequestSchema),
  (c) => {
    const userId = c.get("userId");
    const userRole = c.get("userRole");
    const body = c.req.valid("json");

    // Check for existing active discount
    const existing = findActiveCampaignDiscount(userId);
    if (existing) {
      return c.json(
        {
          code: "ALREADY_ACTIVE",
          message: "Você já tem um desconto de campanha ativo",
          campaignDiscount: existing,
        },
        409,
      );
    }

    const wallet = findWalletByUserId(userId);
    if (!wallet) {
      return c.json({ code: "NOT_FOUND", message: "Wallet not found" }, 404);
    }

    // Admin can override daily amount and total days
    const dailyAmountCents =
      userRole === "admin" && body.dailyAmountCents ? body.dailyAmountCents : 5000; // R$50
    const totalDays = userRole === "admin" && body.totalDays ? body.totalDays : 60;

    const now = new Date().toISOString();
    const campaignDiscount: import("../models/schemas.js").CampaignDiscount = {
      id: crypto.randomUUID(),
      userId,
      totalDays,
      dailyAmountCents,
      daysRemaining: totalDays,
      totalCreditedCents: 0,
      activatedAt: now,
      lastAppliedAt: null,
      completedAt: null,
      isActive: true,
    };

    MOCK_CAMPAIGN_DISCOUNTS.push(campaignDiscount);

    // Update wallet discount tracking fields
    wallet.campaignDiscountRemainingDays = totalDays;
    wallet.campaignDiscountDailyAmountCents = dailyAmountCents;
    wallet.campaignDiscountStartedAt = now;
    wallet.updatedAt = now;

    // Apply the first day's discount immediately
    createTransaction({
      walletId: wallet.id,
      type: "campaign_discount",
      amountCents: dailyAmountCents,
      referenceId: campaignDiscount.id,
      description: `Desconto campanha — Dia 1/${totalDays} (R$${(dailyAmountCents / 100).toFixed(2)}/dia)`,
    });

    campaignDiscount.daysRemaining -= 1;
    campaignDiscount.totalCreditedCents += dailyAmountCents;
    campaignDiscount.lastAppliedAt = now;
    wallet.campaignDiscountRemainingDays -= 1;

    return c.json(
      {
        campaignDiscount,
        message: `Desconto de campanha ativado! R$${(dailyAmountCents / 100).toFixed(2)}/dia por ${totalDays} dias (primeiro desconto já aplicado).`,
      },
      201,
    );
  },
);

// ─── POST /wallet/campaign-discount/apply ─────────────────────────────────────
// Intended to be called by a cron job daily. Also available manually for testing.

walletRouter.post("/campaign-discount/apply", (c) => {
  const userId = c.get("userId");

  const campaignDiscount = findActiveCampaignDiscount(userId);
  if (!campaignDiscount) {
    return c.json(
      { code: "NOT_FOUND", message: "Nenhum desconto de campanha ativo encontrado" },
      404,
    );
  }

  if (campaignDiscount.daysRemaining <= 0) {
    campaignDiscount.isActive = false;
    campaignDiscount.completedAt = new Date().toISOString();
    return c.json(
      { code: "CAMPAIGN_COMPLETED", message: "Campanha já concluída" },
      422,
    );
  }

  const wallet = findWalletByUserId(userId);
  if (!wallet) {
    return c.json({ code: "NOT_FOUND", message: "Wallet not found" }, 404);
  }

  const now = new Date().toISOString();
  const dayNumber = campaignDiscount.totalDays - campaignDiscount.daysRemaining + 1;

  createTransaction({
    walletId: wallet.id,
    type: "campaign_discount",
    amountCents: campaignDiscount.dailyAmountCents,
    referenceId: campaignDiscount.id,
    description: `Desconto campanha — Dia ${dayNumber}/${campaignDiscount.totalDays} (R$${(campaignDiscount.dailyAmountCents / 100).toFixed(2)}/dia)`,
  });

  campaignDiscount.daysRemaining -= 1;
  campaignDiscount.totalCreditedCents += campaignDiscount.dailyAmountCents;
  campaignDiscount.lastAppliedAt = now;
  wallet.campaignDiscountRemainingDays = campaignDiscount.daysRemaining;

  if (campaignDiscount.daysRemaining === 0) {
    campaignDiscount.isActive = false;
    campaignDiscount.completedAt = now;
    wallet.campaignDiscountRemainingDays = 0;
  }

  return c.json({
    campaignDiscount,
    creditedCents: campaignDiscount.dailyAmountCents,
    message: campaignDiscount.daysRemaining === 0
      ? `Última aplicação! Campanha concluída. Total creditado: R$${(campaignDiscount.totalCreditedCents / 100).toFixed(2)}`
      : `Desconto aplicado: R$${(campaignDiscount.dailyAmountCents / 100).toFixed(2)}. Dias restantes: ${campaignDiscount.daysRemaining}`,
  });
});

// ─── GET /wallet/passive-income ───────────────────────────────────────────────

walletRouter.get("/passive-income", (c) => {
  const userId = c.get("userId");

  const wallet = findWalletByUserId(userId);
  if (!wallet) {
    return c.json({ code: "NOT_FOUND", message: "Wallet not found" }, 404);
  }

  const sociedade = findSociedadeByUserId(userId);

  if (!sociedade || sociedade.nivel === "starter") {
    return c.json({
      passiveIncomeSharePercent: 0,
      nivel: "starter",
      totalReceivedPassiveIncomeCents: 0,
      message: "Faça o Upgrade de Sociedade para começar a receber renda passiva",
      upgradeRequired: true,
    });
  }

  // Get passive income transactions
  const passiveIncomeTxs = findTransactionsByWalletId(wallet.id).filter(
    (t) => t.type === "passive_income",
  );

  const totalReceivedPassiveIncomeCents = passiveIncomeTxs.reduce(
    (sum, t) => sum + t.amountCents,
    0,
  );

  // Calculate estimated monthly passive income based on current zone revenue
  // In production: this would query real zone revenue data
  const estimatedMonthlyZoneRevenueCents = 5_000_000; // R$50.000/month zone revenue (mock)
  const estimatedMonthlyPassiveIncomeCents = Math.round(
    (estimatedMonthlyZoneRevenueCents * sociedade.passiveIncomeSharePercent) / 100,
  );

  return c.json({
    passiveIncomeSharePercent: sociedade.passiveIncomeSharePercent,
    nivel: sociedade.nivel,
    participacaoPercent: sociedade.participacaoPercent,
    zoneId: sociedade.zoneId,
    totalReceivedPassiveIncomeCents,
    estimatedMonthlyPassiveIncomeCents,
    totalInvestedCents: sociedade.totalInvestedCents,
    recentTransactions: passiveIncomeTxs.slice(0, 5),
    // Real-time snapshot
    snapshotAt: new Date().toISOString(),
  });
});

// ─── POST /wallet/pay-ride ────────────────────────────────────────────────────
// Payment gateway stub: process ride payment through external method

walletRouter.post(
  "/pay-ride",
  zValidator(
    "json",
    z.object({
      rideId: z.string().uuid(),
      method: z.enum(["wallet", "pix", "credit_card"]),
      amountCents: z.number().int().positive(),
    }),
  ),
  (c) => {
    const userId = c.get("userId");
    const { rideId, method, amountCents } = c.req.valid("json");

    const wallet = findWalletByUserId(userId);
    if (!wallet) {
      return c.json({ code: "NOT_FOUND", message: "Wallet not found" }, 404);
    }

    const now = new Date().toISOString();

    if (method === "wallet") {
      if (wallet.balanceCents < amountCents) {
        return c.json(
          {
            code: "INSUFFICIENT_BALANCE",
            message: `Saldo insuficiente. Saldo: R$${(wallet.balanceCents / 100).toFixed(2)}`,
          },
          422,
        );
      }
    }

    // Gateway stub: always approves (except wallet balance check above)
    const gatewayTx: import("../models/schemas.js").PaymentGatewayTransaction = {
      id: crypto.randomUUID(),
      walletTransactionId: null,
      userId,
      rideId,
      amountCents,
      method,
      status: "approved",
      gatewayRef: method !== "wallet" ? `GTW-${Date.now()}` : null,
      failureReason: null,
      createdAt: now,
      updatedAt: now,
    };

    MOCK_PAYMENT_GATEWAY_TRANSACTIONS.push(gatewayTx);

    // For wallet payments: create the debit transaction
    if (method === "wallet") {
      const tx = createTransaction({
        walletId: wallet.id,
        type: "ride_payment",
        amountCents: -amountCents,
        referenceId: rideId,
        description: `Pagamento corrida via carteira — R$${(amountCents / 100).toFixed(2)}`,
      });
      gatewayTx.walletTransactionId = tx.id;
    }

    return c.json(
      {
        payment: gatewayTx,
        message: method === "wallet"
          ? "Pagamento debitado da Carteira Vuup"
          : `Pagamento aprovado via ${method === "pix" ? "Pix" : "cartão de crédito"} (gateway stub)`,
      },
      201,
    );
  },
);
