/**
 * Wallet routes (protected)
 *
 * GET /wallet              — current user wallet balance
 * GET /wallet/transactions — paginated transaction history
 */

import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { findWalletByUserId, findTransactionsByWalletId } from "../models/mock-data.js";

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
  const wallet = findWalletByUserId(userId);
  if (!wallet) {
    return c.json({ code: "NOT_FOUND", message: "Wallet not found" }, 404);
  }
  const transactions = findTransactionsByWalletId(wallet.id);
  return c.json({
    data: transactions,
    pagination: {
      page: 1,
      limit: 20,
      total: transactions.length,
      hasNext: false,
    },
  });
});
