/**
 * User routes (protected)
 *
 * GET  /users/me             — current user profile
 * PATCH /users/me            — update name/avatar
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { UserSchema } from "../models/schemas.js";
import { findUserById, MOCK_USERS } from "../models/mock-data.js";

export const usersRouter = new Hono();

usersRouter.use("/*", requireAuth);

// GET /users/me
usersRouter.get("/me", (c) => {
  const userId = c.get("userId");
  const user = findUserById(userId);
  if (!user) {
    return c.json({ code: "NOT_FOUND", message: "User not found" }, 404);
  }
  return c.json(user);
});

// PATCH /users/me
usersRouter.patch(
  "/me",
  zValidator(
    "json",
    z.object({
      fullName: z.string().min(2).max(120).optional(),
      avatarUrl: z.string().url().nullable().optional(),
    }),
  ),
  (c) => {
    const userId = c.get("userId");
    const idx = MOCK_USERS.findIndex((u) => u.id === userId);
    if (idx === -1) {
      return c.json({ code: "NOT_FOUND", message: "User not found" }, 404);
    }
    const updates = c.req.valid("json");
    MOCK_USERS[idx] = {
      ...MOCK_USERS[idx]!,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    return c.json(UserSchema.parse(MOCK_USERS[idx]));
  },
);
