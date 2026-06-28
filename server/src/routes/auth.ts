/**
 * Auth routes — OTP-based phone login (mock: any 6-digit code accepted in dev).
 *
 * POST /auth/otp-request  — send OTP to phone (mock: logs to console)
 * POST /auth/login        — verify OTP + issue JWT pair
 * POST /auth/refresh      — exchange refresh token for new access token
 * POST /auth/logout       — (client should discard tokens; here we just 200)
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { LoginRequestSchema, LoginResponseSchema } from "../models/schemas.js";
import { signAccessToken, signRefreshToken, verifyToken } from "../lib/auth.js";
import { findUserByPhone, MOCK_USERS } from "../models/mock-data.js";

export const authRouter = new Hono();

// POST /auth/otp-request
authRouter.post("/otp-request", zValidator("json", z.object({ phone: z.string() })), (c) => {
  const { phone } = c.req.valid("json");
  // In prod: send SMS via Twilio/AWS SNS. Mock: log OTP.
  const mockOtp = "123456";
  console.log(`[mock] OTP for ${phone}: ${mockOtp}`);
  return c.json({ message: "OTP sent", expiresIn: 300 });
});

// POST /auth/login
authRouter.post("/login", zValidator("json", LoginRequestSchema), async (c) => {
  const { phone, otpCode } = c.req.valid("json");

  // Mock: accept any 6-digit OTP. In prod: verify against Redis/DB.
  if (otpCode.length !== 6) {
    return c.json({ code: "INVALID_OTP", message: "OTP must be 6 digits" }, 400);
  }

  let user = findUserByPhone(phone);
  if (!user) {
    // Auto-create passenger account in mock mode
    const now = new Date().toISOString();
    user = {
      id: crypto.randomUUID(),
      fullName: "Novo Usuário",
      email: `${phone.replace(/\D/g, "")}@vuup.app`,
      phone,
      role: "passenger",
      status: "active",
      avatarUrl: null,
      documentNumber: null,
      rating: null,
      totalRides: 0,
      createdAt: now,
      updatedAt: now,
    };
    MOCK_USERS.push(user);
  }

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(user.id, user.role),
    signRefreshToken(user.id),
  ]);

  const response = LoginResponseSchema.parse({
    accessToken,
    refreshToken,
    expiresIn: 900, // 15 min
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
    try {
      const payload = await verifyToken(refreshToken);
      const userId = payload.sub ?? "";
      const user = MOCK_USERS.find((u) => u.id === userId);
      if (!user) {
        return c.json({ code: "USER_NOT_FOUND", message: "User no longer exists" }, 401);
      }
      const accessToken = await signAccessToken(userId, user.role);
      return c.json({ accessToken, expiresIn: 900 });
    } catch {
      return c.json({ code: "INVALID_TOKEN", message: "Refresh token invalid or expired" }, 401);
    }
  },
);

// POST /auth/logout
authRouter.post("/logout", (c) => {
  // Client-side discard pattern — server is stateless for mock.
  return c.json({ message: "Logged out" });
});
