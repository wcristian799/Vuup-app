/**
 * Wallet repository — balance, transactions, and transfers.
 */

import { randomUUID } from "node:crypto";
import db from "../database.js";
import type { Wallet, Transaction } from "../../models/schemas.js";

// ─── Row mappers ──────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toWallet(row: Record<string, any>): Wallet {
  return {
    id: row["id"],
    userId: row["user_id"],
    balanceCents: row["balance_cents"],
    pendingCents: row["pending_cents"],
    lifetimeEarningsCents: row["lifetime_earnings_cents"],
    updatedAt: row["updated_at"],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toTransaction(row: Record<string, any>): Transaction {
  return {
    id: row["id"],
    walletId: row["wallet_id"],
    type: row["type"],
    amountCents: row["amount_cents"],
    balanceAfterCents: row["balance_after_cents"],
    referenceId: row["reference_id"] ?? null,
    description: row["description"],
    createdAt: row["created_at"],
  };
}

// ─── Wallet queries ───────────────────────────────────────────────────────────

export function findWalletByUserId(userId: string): Wallet | undefined {
  const row = db.prepare("SELECT * FROM wallets WHERE user_id = ?").get(userId) as
    | Record<string, unknown>
    | undefined;
  return row ? toWallet(row) : undefined;
}

export function findWalletById(id: string): Wallet | undefined {
  const row = db.prepare("SELECT * FROM wallets WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? toWallet(row) : undefined;
}

export function createWallet(userId: string, initialBalanceCents = 0): Wallet {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO wallets (id, user_id, balance_cents, pending_cents, lifetime_earnings_cents, updated_at)
    VALUES (?, ?, ?, 0, 0, ?)
  `).run(id, userId, initialBalanceCents, now);
  return findWalletByUserId(userId)!;
}

// ─── Transaction queries ──────────────────────────────────────────────────────

export function findTransactionsByWalletId(
  walletId: string,
  limit = 50,
  offset = 0,
): Transaction[] {
  const rows = db
    .prepare(
      "SELECT * FROM transactions WHERE wallet_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
    )
    .all(walletId, limit, offset) as Record<string, unknown>[];
  return rows.map(toTransaction);
}

export function countTransactionsByWalletId(walletId: string): number {
  const row = db
    .prepare("SELECT COUNT(*) as cnt FROM transactions WHERE wallet_id = ?")
    .get(walletId) as { cnt: number };
  return row.cnt;
}

// ─── Debit / Credit (atomic) ──────────────────────────────────────────────────

export interface TransactionInput {
  walletId: string;
  type: string;
  amountCents: number; // positive = credit, negative = debit
  referenceId?: string | null;
  description: string;
  isEarning?: boolean; // if true, increments lifetime_earnings_cents
}

const recordTransaction = db.transaction((input: TransactionInput): Transaction => {
  const now = new Date().toISOString();
  const id = randomUUID();

  db.prepare(`
    UPDATE wallets
    SET balance_cents = balance_cents + @delta,
        lifetime_earnings_cents = lifetime_earnings_cents + @lifetime_delta,
        updated_at = @updated_at
    WHERE id = @wallet_id
  `).run({
    delta: input.amountCents,
    lifetime_delta: input.isEarning && input.amountCents > 0 ? input.amountCents : 0,
    updated_at: now,
    wallet_id: input.walletId,
  });

  db.prepare(`
    INSERT INTO transactions (id, wallet_id, type, amount_cents, balance_after_cents, reference_id, description, created_at)
    SELECT ?, wallet_id, ?, ?, balance_cents, ?, ?, ?
    FROM wallets WHERE id = ?
  `).run(
    id,
    input.type,
    input.amountCents,
    input.referenceId ?? null,
    input.description,
    now,
    input.walletId,
  );

  const row = db.prepare("SELECT * FROM transactions WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return toTransaction(row!);
});

export function addTransaction(input: TransactionInput): Transaction {
  return recordTransaction(input);
}

// ─── Transfer (atomic wallet-to-wallet) ──────────────────────────────────────

const transfer = db.transaction(
  (fromWalletId: string, toWalletId: string, cents: number, description: string) => {
    addTransaction({
      walletId: fromWalletId,
      type: "withdrawal",
      amountCents: -cents,
      description,
    });
    addTransaction({
      walletId: toWalletId,
      type: "deposit",
      amountCents: cents,
      description,
      isEarning: true,
    });
  },
);

export function transferBetweenWallets(
  fromWalletId: string,
  toWalletId: string,
  cents: number,
  description: string,
): void {
  transfer(fromWalletId, toWalletId, cents, description);
}
