/**
 * Auth repository — refresh token storage. OTP storage removed (VUU-82).
 */

import db from "../database.js";

// ─── Refresh tokens ───────────────────────────────────────────────────────────

export function storeRefreshToken(token: string, userId: string, ttlDays = 30): void {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlDays * 86_400_000).toISOString();
  db.prepare(
    `
    INSERT OR IGNORE INTO refresh_tokens (token, user_id, expires_at, revoked, created_at)
    VALUES (?, ?, ?, 0, ?)
  `,
  ).run(token, userId, expiresAt, now.toISOString());
}

export function validateRefreshToken(token: string): { userId: string } | undefined {
  const now = new Date().toISOString();
  const row = db
    .prepare(
      `
    SELECT user_id FROM refresh_tokens
    WHERE token = ? AND revoked = 0 AND expires_at > ?
  `,
    )
    .get(token, now) as { user_id: string } | undefined;

  return row ? { userId: row.user_id } : undefined;
}

export function revokeRefreshToken(token: string): void {
  db.prepare("UPDATE refresh_tokens SET revoked = 1 WHERE token = ?").run(token);
}

export function revokeAllUserTokens(userId: string): void {
  db.prepare("UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?").run(userId);
}
