/**
 * Auth routes — OTP-based phone login backed by SQLite.
 *
 * POST /auth/otp-request  — request OTP (dev: logs to console, prod: SMS)
 * POST /auth/login        — verify OTP + issue JWT pair, create user if new
 * POST /auth/refresh      — exchange refresh token for new access token
 * POST /auth/logout       — revoke refresh token
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { LoginRequestSchema, LoginResponseSchema } from "../models/schemas.js";
import { signAccessToken, signRefreshToken, verifyToken } from "../lib/auth.js";
import {
  createOtp,
  verifyOtpDev,
  storeRefreshToken,
  validateRefreshToken,
  revokeRefreshToken,
} from "../db/repos/auth.js";
import { findUserByPhone, createUser, findUserById } from "../db/repos/users.js";
import { createWallet, findWalletByUserId } from "../db/repos/wallet.js";

export const authRouter = new Hono();

// POST /auth/otp-request
authRouter.post("/otp-request", zValidator("json", z.object({ phone: z.string() })), (c) => {
  const { phone } = c.req.valid("json");
  const mockOtp = "123456";
  createOtp(phone, mockOtp);
  // In prod: send via SMS servico (Twilio/AWS SNS). Dev: log only.
  console.log(`[auth] OTP for ${phone}: ${mockOtp}`);
  return c.json({ message: "OTP sent", expiresIn: 300 });
});

// POST /auth/login
authRouter.post("/login", zValidator("json", LoginRequestSchema), async (c) => {
  const { phone, otpCode } = c.req.valid("json");

  // Dev mode: accept any 6-digit code. Production: verifyAndConsumeOtp(phone, otpCode).
  const otpValid = verifyOtpDev(phone, otpCode);
  if (!otpValid) {
    return c.json({ code: "INVALID_OTP", message: "OTP must be exactly 6 digits" }, 400);
  }

  let user = findUserByPhone(phone);
  if (!user) {
    // Auto-register as passenger on first login
    user = createUser({
      fullName: "Novo Usuário",
      email: `${phone.replace(/\D/g, "")}@vuup.app`,
      phone,
      role: "passenger",
      status: "active",
    });
    // Create associated wallet
    if (!findWalletByUserId(user.id)) {
      createWallet(user.id, 0);
    }
  }

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(user.id, user.role),
    signRefreshToken(user.id),
  ]);

  // Persist refresh token
  storeRefreshToken(refreshToken, user.id);

  const response = LoginResponseSchema.parse({
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
