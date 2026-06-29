/**
 * Auth routes — OTP removed (founder decision 2026-06-29). The passenger
 * navigates the app freely and only registers at the moment of requesting a
 * ride. Registration is phone-first; if the phone already exists we treat it as
 * the same account and issue a fresh session (see SECURITY note below).
 *
 * POST /auth/register — create account (or re-auth existing phone) + issue JWT pair
 * POST /auth/refresh  — exchange refresh token for new access token
 * POST /auth/logout   — revoke refresh token
 *
 * SECURITY (VUU-82, inherits VUU-78 intent without OTP):
 * Without phone-ownership verification (no SMS/OTP), a duplicate phone is
 * treated as a LOGIN to the existing account rather than creating a second
 * account. This is the documented product decision. It means anyone who knows
 * a phone number can obtain a session for that account — an accepted residual
 * risk for the current launch since the founder removed OTP. Sensitive actions
 * (payments, payouts) should add their own step-up verification later. We do
 * NOT let a new registration overwrite/rename an existing account's profile.
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { RegisterRequestSchema, AuthResponseSchema } from "../models/schemas.js";
import { signAccessToken, signRefreshToken, verifyToken } from "../lib/auth.js";
import { storeRefreshToken, validateRefreshToken, revokeRefreshToken } from "../db/repos/auth.js";
import { findUserByPhone, createUser, findUserById } from "../db/repos/users.js";
import { createWallet, findWalletByUserId } from "../db/repos/wallet.js";

export const authRouter = new Hono();

// POST /auth/register — register at ride time (no OTP). Idempotent per phone.
authRouter.post("/register", zValidator("json", RegisterRequestSchema), async (c) => {
  const { phone, fullName } = c.req.valid("json");
  const normalizedPhone = phone.trim();

  let user = findUserByPhone(normalizedPhone);
  if (!user) {
    // New phone → create the account. fullName is optional (quick register).
    user = createUser({
      fullName: fullName?.trim() || "Novo Usuário",
      email: `${normalizedPhone.replace(/\D/g, "")}@vuup.app`,
      phone: normalizedPhone,
      role: "passenger",
      status: "active",
    });
    if (!findWalletByUserId(user.id)) {
      createWallet(user.id, 0);
    }
  }
  // Existing phone → treat as login to that account. We intentionally do NOT
  // apply the incoming fullName to an existing account to avoid trivial
  // profile-takeover via re-registration.

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(user.id, user.role),
    signRefreshToken(user.id),
  ]);

  storeRefreshToken(refreshToken, user.id);

  const response = AuthResponseSchema.parse({
    accessToken,
    refreshToken,
    expiresIn: 900,
    user: {
      id: user.id,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      rating: user.rating,
      role: user.role,
    },
  });

  return c.json(response, 200);
});

// POST /auth/refresh
authRouter.post(
  "/refresh",
  zValidator("json", z.object({ refreshToken: z.string() })),
  async (c) => {
    const { refreshToken } = c.req.valid("json");

    // First verify JWT signature/expiry
    let userId: string;
    try {
      const payload = await verifyToken(refreshToken);
      userId = payload.sub ?? "";
    } catch {
      return c.json({ code: "INVALID_TOKEN", message: "Refresh token invalid or expired" }, 401);
    }

    // Then check DB revocation
    const record = validateRefreshToken(refreshToken);
    if (!record) {
      return c.json({ code: "TOKEN_REVOKED", message: "Refresh token has been revoked" }, 401);
    }

    const user = findUserById(userId);
    if (!user) {
      return c.json({ code: "USER_NOT_FOUND", message: "User no longer exists" }, 401);
    }

    const accessToken = await signAccessToken(userId, user.role);
    return c.json({ accessToken, expiresIn: 900 });
  },
);

// POST /auth/logout
authRouter.post(
  "/logout",
  zValidator("json", z.object({ refreshToken: z.string().optional() })),
  (c) => {
    const { refreshToken } = c.req.valid("json");
    if (refreshToken) {
      revokeRefreshToken(refreshToken);
    }
    return c.json({ message: "Logged out" });
  },
);
