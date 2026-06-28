/**
 * Wallet routes (protected) — backed by SQLite.
 *
 * GET  /wallet              — current user wallet balance
 * GET  /wallet/transactions — paginated transaction history
 * POST /wallet/transfer     — transfer between wallets (founder/admin only for now)
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import {
  findWalletByUserId,
  findTransactionsByWalletId,
  countTransactionsByWalletId,
  transferBetweenWallets,
} from "../db/repos/wallet.js";
import { findUserById } from "../db/repos/users.js";

export const walletRouter = new Hono();

walletRouter.use("/*", requireAuth);

// GET /wallet
walletRouter.get("/", (c) => {
  const userId = c.get("userId");
  const wallet = findWalletByUserId(userId);
  if (!wallet) {
    return c.json({ code: "NOT_FOUND", message: "Wallet not found" }, 404);
  }
  return c.json(wallet);
});

// GET /wallet/transactions
walletRouter.get("/transactions", (c) => {
  const userId = c.get("userId");
  const page = Math.max(1, Number(c.req.query("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? 20)));
  const offset = (page - 1) * limit;

  const wallet = findWalletByUserId(userId);
  if (!wallet) {
    return c.json({ code: "NOT_FOUND", message: "Wallet not found" }, 404);
  }

  const transactions = findTransactionsByWalletId(wallet.id, limit, offset);
  const total = countTransactionsByWalletId(wallet.id);

  return c.json({
    data: transactions,
    pagination: { page, limit, total, hasNext: offset + limit < total },
  });
});

// POST /wallet/transfer — send money from caller's wallet to another user's wallet
walletRouter.post(
  "/transfer",
  zValidator(
    "json",
    z.object({
      toUserId: z.string().uuid(),
      amountCents: z.number().int().positive(),
      description: z.string().max(200).optional(),
    }),
  ),
  (c) => {
    const userId = c.get("userId");
    const { toUserId, amountCents, description } = c.req.valid("json");

    if (userId === toUserId) {
      return c.json({ code: "INVALID_TRANSFER", message: "Cannot transfer to yourself" }, 400);
    }

    const fromWallet = findWalletByUserId(userId);
    if (!fromWallet) {
      return c.json({ code: "NOT_FOUND", message: "Your wallet not found" }, 404);
    }
    if (fromWallet.balanceCents < amountCents) {
      return c.json({ code: "INSUFFICIENT_FUNDS", message: "Insufficient wallet balance" }, 422);
    }

    const toUser = findUserById(toUserId);
    if (!toUser) {
      return c.json({ code: "NOT_FOUND", message: "Recipient user not found" }, 404);
    }
    const toWallet = findWalletByUserId(toUserId);
    if (!toWallet) {
      return c.json({ code: "NOT_FOUND", message: "Recipient wallet not found" }, 404);
    }

    const desc = description ?? `Transferência para ${toUser.fullName}`;
    transferBetweenWallets(fromWallet.id, toWallet.id, amountCents, desc);

    const updatedWallet = findWalletByUserId(userId)!;
    return c.json({
      message: "Transfer completed",
      balance: updatedWallet.balanceCents,
      amountCents,
    });
  },
);
