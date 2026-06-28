/**
 * Sociedade routes (protected) — Onda 5: Upgrade de Sociedade
 *
 * GET  /sociedade              — get current user's participação
 * GET  /sociedade/upgrade-options — list available upgrade tiers with costs
 * POST /sociedade/upgrade      — upgrade to next nivel (debits wallet)
 * GET  /sociedade/passive-income/simulate — simulate passive income for a given nivel
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

import { requireAuth } from "../middleware/auth.js";
import {
  SociedadeUpgradeRequestSchema,
  SOCIEDADE_PASSIVE_INCOME_PERCENT,
  SOCIEDADE_UPGRADE_COST_CENTS,
} from "../models/schemas.js";
import type { SociedadeNivel } from "../models/schemas.js";
import {
  MOCK_SOCIEDADE,
  findWalletByUserId,
  findSociedadeByUserId,
  createTransaction,
} from "../models/mock-data.js";

export const sociedadeRouter = new Hono();

sociedadeRouter.use("/*", requireAuth);

// ─── Nivel ordering ───────────────────────────────────────────────────────────

const NIVEL_ORDER: SociedadeNivel[] = ["starter", "bronze", "silver", "gold", "platinum"];

function nivelIndex(nivel: SociedadeNivel): number {
  return NIVEL_ORDER.indexOf(nivel);
}

// ─── GET /sociedade ───────────────────────────────────────────────────────────

sociedadeRouter.get("/", (c) => {
  const userId = c.get("userId");

  const participacao = findSociedadeByUserId(userId);

  if (!participacao) {
    // Return default starter level for users without a participação record
    return c.json({
      nivel: "starter" as SociedadeNivel,
      participacaoPercent: 0,
      passiveIncomeSharePercent: 0,
      totalInvestedCents: 0,
      totalReceivedPassiveIncomeCents: 0,
      zoneId: null,
      upgradedAt: null,
      message: "Você está no nível Starter. Faça um upgrade para participar dos dividendos.",
      nextUpgrade: {
        targetNivel: "bronze",
        costCents: SOCIEDADE_UPGRADE_COST_CENTS["starter->bronze"] ?? 50000,
        passiveIncomeSharePercent: SOCIEDADE_PASSIVE_INCOME_PERCENT["bronze"],
      },
    });
  }

  const currentIdx = nivelIndex(participacao.nivel);
  const nextNivel = NIVEL_ORDER[currentIdx + 1] as SociedadeNivel | undefined;
  const upgradeCostKey = nextNivel ? `${participacao.nivel}->${nextNivel}` : null;

  return c.json({
    ...participacao,
    nextUpgrade: nextNivel
      ? {
          targetNivel: nextNivel,
          costCents: upgradeCostKey ? (SOCIEDADE_UPGRADE_COST_CENTS[upgradeCostKey] ?? null) : null,
          passiveIncomeSharePercent: SOCIEDADE_PASSIVE_INCOME_PERCENT[nextNivel],
        }
      : null,
  });
});

// ─── GET /sociedade/upgrade-options ──────────────────────────────────────────

sociedadeRouter.get("/upgrade-options", (c) => {
  const userId = c.get("userId");
  const participacao = findSociedadeByUserId(userId);
  const currentNivel: SociedadeNivel = participacao?.nivel ?? "starter";
  const currentIdx = nivelIndex(currentNivel);

  const options = NIVEL_ORDER.filter((_, i) => i > currentIdx).map((nivel) => {
    const prevNivel = NIVEL_ORDER[NIVEL_ORDER.indexOf(nivel) - 1] as SociedadeNivel;
    const costKey = `${prevNivel}->${nivel}`;
    const costCents = SOCIEDADE_UPGRADE_COST_CENTS[costKey] ?? null;

    // Total cost from current nivel to this nivel (sum of all steps)
    let totalCostFromCurrent = 0;
    for (let i = currentIdx; i < NIVEL_ORDER.indexOf(nivel); i++) {
      const stepKey = `${NIVEL_ORDER[i]}->${NIVEL_ORDER[i + 1]}`;
      totalCostFromCurrent += SOCIEDADE_UPGRADE_COST_CENTS[stepKey] ?? 0;
    }

    return {
      nivel,
      directUpgradeCostCents: costCents,
      totalCostFromCurrentNivelCents: totalCostFromCurrent,
      passiveIncomeSharePercent: SOCIEDADE_PASSIVE_INCOME_PERCENT[nivel],
      isDirectUpgrade: NIVEL_ORDER.indexOf(nivel) === currentIdx + 1,
    };
  });

  return c.json({ currentNivel, options });
});

// ─── POST /sociedade/upgrade ──────────────────────────────────────────────────

sociedadeRouter.post("/upgrade", zValidator("json", SociedadeUpgradeRequestSchema), (c) => {
  const userId = c.get("userId");
  const body = c.req.valid("json");

  const participacao = findSociedadeByUserId(userId);
  const currentNivel: SociedadeNivel = participacao?.nivel ?? "starter";
  const currentIdx = nivelIndex(currentNivel);
  const targetIdx = nivelIndex(body.targetNivel);

  // Must upgrade at least one level
  if (targetIdx <= currentIdx) {
    return c.json(
      {
        code: "INVALID_UPGRADE",
        message: `Nível alvo "${body.targetNivel}" não é superior ao nível atual "${currentNivel}"`,
      },
      422,
    );
  }

  // Calculate total cost: sum of all steps from current to target
  let totalCostCents = 0;
  for (let i = currentIdx; i < targetIdx; i++) {
    const stepKey = `${NIVEL_ORDER[i]}->${NIVEL_ORDER[i + 1]}`;
    const stepCost = SOCIEDADE_UPGRADE_COST_CENTS[stepKey];
    if (stepCost === undefined) {
      return c.json(
        {
          code: "INVALID_UPGRADE",
          message: `Upgrade de ${NIVEL_ORDER[i]} para ${NIVEL_ORDER[i + 1]} não está disponível`,
        },
        422,
      );
    }
    totalCostCents += stepCost;
  }

  if (body.paymentMethod === "wallet") {
    const wallet = findWalletByUserId(userId);
    if (!wallet) {
      return c.json({ code: "NOT_FOUND", message: "Wallet not found" }, 404);
    }

    if (wallet.balanceCents < totalCostCents) {
      return c.json(
        {
          code: "INSUFFICIENT_BALANCE",
          message: `Saldo insuficiente. Necessário: R$${(totalCostCents / 100).toFixed(2)}, disponível: R$${(wallet.balanceCents / 100).toFixed(2)}`,
        },
        422,
      );
    }

    // Debit wallet
    createTransaction({
      walletId: wallet.id,
      type: "sociedade_upgrade",
      amountCents: -totalCostCents,
      description: `Upgrade de Sociedade: ${currentNivel} → ${body.targetNivel} (R$${(totalCostCents / 100).toFixed(2)})`,
    });
  }
  // For non-wallet methods: gateway stub (always approved in mock)

  const now = new Date().toISOString();
  const newPassiveIncomePercent = SOCIEDADE_PASSIVE_INCOME_PERCENT[body.targetNivel];

  if (participacao) {
    // Update existing record
    participacao.nivel = body.targetNivel;
    participacao.participacaoPercent = newPassiveIncomePercent;
    participacao.passiveIncomeSharePercent = newPassiveIncomePercent;
    participacao.totalInvestedCents += totalCostCents;
    participacao.upgradedAt = now;
    participacao.updatedAt = now;
  } else {
    // Create new participação record
    const newParticipacao: import("../models/schemas.js").SociedadeParticipacao = {
      id: crypto.randomUUID(),
      userId,
      nivel: body.targetNivel,
      participacaoPercent: newPassiveIncomePercent,
      passiveIncomeSharePercent: newPassiveIncomePercent,
      totalInvestedCents: totalCostCents,
      totalReceivedPassiveIncomeCents: 0,
      zoneId: null, // assigned by admin post-upgrade
      upgradedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    MOCK_SOCIEDADE.push(newParticipacao);
  }

  const updatedParticipacao = findSociedadeByUserId(userId);

  return c.json(
    {
      participacao: updatedParticipacao,
      costCents: totalCostCents,
      paymentMethod: body.paymentMethod,
      message: `Parabéns! Você fez upgrade para o nível ${body.targetNivel}. Sua participação nos dividendos é agora de ${newPassiveIncomePercent}%.`,
    },
    201,
  );
});

// ─── GET /sociedade/passive-income/simulate ───────────────────────────────────

sociedadeRouter.get("/passive-income/simulate", (c) => {
  const nivelParam = c.req.query("nivel") as SociedadeNivel | undefined;
  const nivel: SociedadeNivel = nivelParam ?? "bronze";

  if (!NIVEL_ORDER.includes(nivel)) {
    return c.json({ code: "INVALID_NIVEL", message: `Nível inválido: ${nivel}` }, 400);
  }

  // Mock zone revenue data
  const mockZoneRevenueCents = 5_000_000; // R$50.000/month
  const sharePercent = SOCIEDADE_PASSIVE_INCOME_PERCENT[nivel];
  const monthlyEstimateCents = Math.round((mockZoneRevenueCents * sharePercent) / 100);

  return c.json({
    nivel,
    passiveIncomeSharePercent: sharePercent,
    estimatedMonthlyZoneRevenueCents: mockZoneRevenueCents,
    estimatedMonthlyPassiveIncomeCents: monthlyEstimateCents,
    estimatedYearlyPassiveIncomeCents: monthlyEstimateCents * 12,
    upgradeCost: (() => {
      // Get upgrade cost from current nivel if applicable
      const userId = c.get("userId");
      const participacao = findSociedadeByUserId(userId);
      const currentNivel: SociedadeNivel = participacao?.nivel ?? "starter";
      const currentIdx = nivelIndex(currentNivel);
      const targetIdx = nivelIndex(nivel);
      if (targetIdx <= currentIdx) return null;
      let total = 0;
      for (let i = currentIdx; i < targetIdx; i++) {
        const key = `${NIVEL_ORDER[i]}->${NIVEL_ORDER[i + 1]}`;
        total += SOCIEDADE_UPGRADE_COST_CENTS[key] ?? 0;
      }
      return total;
    })(),
  });
});
