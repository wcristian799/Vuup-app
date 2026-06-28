/**
 * User routes (protected) — backed by SQLite.
 *
 * GET   /users/me  — current user profile
 * PATCH /users/me  — update name/avatar
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { UserSchema } from "../models/schemas.js";
import { findUserById, updateUser } from "../db/repos/users.js";

export const usersRouter = new Hono();

usersRouter.use("/*", requireAuth);

// GET /users/me
usersRouter.get("/me", (c) => {
  const userId = c.get("userId");
  const user = findUserById(userId);
  if (!user) {
    return c.json({ code: "NOT_FOUND", message: "User not found" }, 404);
  }
  return c.json(UserSchema.parse(user));
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
    const updates = c.req.valid("json");
    const updated = updateUser(userId, updates);
    if (!updated) {
      return c.json({ code: "NOT_FOUND", message: "User not found" }, 404);
    }
    return c.json(UserSchema.parse(updated));
  },
);
