/**
 * Auth repository — OTP codes and refresh token storage.
 */

import { randomUUID } from "node:crypto";
import db from "../database.js";

// ─── OTP codes ────────────────────────────────────────────────────────────────

export function createOtp(phone: string, code: string, ttlSeconds = 300): string {
  const id = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
  db.prepare(`
    INSERT INTO otp_codes (id, phone, code, expires_at, used, created_at)
    VALUES (?, ?, ?, ?, 0, ?)
  `).run(id, phone, code, expiresAt, now.toISOString());
  return id;
}

export function verifyAndConsumeOtp(phone: string, code: string): boolean {
  const now = new Date().toISOString();
  const row = db.prepare(`
    SELECT id FROM otp_codes
    WHERE phone = ? AND code = ? AND used = 0 AND expires_at > ?
    ORDER BY created_at DESC LIMIT 1
  `).get(phone, code, now) as { id: string } | undefined;

  if (!row) return false;

  // In production: strict OTP check. In dev (ENV=development), accept any 6-digit code.
  if (process.env["NODE_ENV"] !== "production") {
    db.prepare("UPDATE otp_codes SET used = 1 WHERE id = ?").run(row.id);
    return true;
  }

  db.prepare("UPDATE otp_codes SET used = 1 WHERE id = ?").run(row.id);
  return true;
}

/**
 * Dev-mode: always accepts any 6-digit code (mirrors mock behavior).
 * In production: use verifyAndConsumeOtp with real SMS delivery.
 */
export function verifyOtpDev(phone: string, code: string): boolean {
  if (code.length !== 6 || !/^\d{6}$/.test(code)) return false;
  // Create a consumed OTP record for audit trail
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO otp_codes (id, phone, code, expires_at, used, created_at)
    VALUES (?, ?, ?, ?, 1, ?)
  `).run(id, phone, code, now, now);
  return true;
}

// ─── Refresh tokens ───────────────────────────────────────────────────────────

export function storeRefreshToken(token: string, userId: string, ttlDays = 30): void {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlDays * 86_400_000).toISOString();
  db.prepare(`
    INSERT OR IGNORE INTO refresh_tokens (token, user_id, expires_at, revoked, created_at)
    VALUES (?, ?, ?, 0, ?)
  `).run(token, userId, expiresAt, now.toISOString());
}

export function validateRefreshToken(token: string): { userId: string } | undefined {
  const now = new Date().toISOString();
  const row = db.prepare(`
    SELECT user_id FROM refresh_tokens
    WHERE token = ? AND revoked = 0 AND expires_at > ?
  `).get(token, now) as { user_id: string } | undefined;

  return row ? { userId: row.user_id } : undefined;
}

export function revokeRefreshToken(token: string): void {
  db.prepare("UPDATE refresh_tokens SET revoked = 1 WHERE token = ?").run(token);
}

export function revokeAllUserTokens(userId: string): void {
  db.prepare("UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?").run(userId);
}
