/**
 * Patron driver routes (all protected) — backed by SQLite.
 *
 * GET    /patron                  — list caller's patron links
 * POST   /patron                  — set patron driver for current passenger
 * PATCH  /patron/:id              — update label
 * DELETE /patron/:id              — deactivate patron link
 * GET    /patron/passengers       — (driver view) passengers who have caller as patron
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";

import { requireAuth } from "../middleware/auth.js";
import { PatronLinkCreateSchema } from "../models/schemas.js";
import {
  findPatronLinkByPassenger,
  findPatronLinksByDriver,
  findPatronLinkById,
  createPatronLink,
  updatePatronLink,
  deactivatePatronLink,
} from "../db/repos/rides.js";
import { findUserById } from "../db/repos/users.js";

export const patronRouter = new Hono();

patronRouter.use("/*", requireAuth);

// ─── GET /patron/passengers — driver-only view ────────────────────────────────
// Must be registered BEFORE /:id to avoid shadowing

patronRouter.get("/passengers", (c) => {
  const userId = c.get("userId");
  const userRole = c.get("userRole");

  if (userRole !== "driver" && userRole !== "motoboy" && userRole !== "admin") {
    throw new HTTPException(403, { message: "Only drivers can list their patron passengers" });
  }

  const links = findPatronLinksByDriver(userId);
  const enriched = links.map((l) => {
    const passenger = findUserById(l.passengerId);
    return {
      ...l,
      passenger: passenger
        ? { id: passenger.id, fullName: passenger.fullName, rating: passenger.rating }
        : null,
    };
  });

  return c.json({ data: enriched });
});

// ─── GET /patron ──────────────────────────────────────────────────────────────

patronRouter.get("/", (c) => {
  const userId = c.get("userId");
  const userRole = c.get("userRole");

  if (userRole === "driver" || userRole === "motoboy") {
    const links = findPatronLinksByDriver(userId);
    return c.json({ data: links });
  }

  const link = findPatronLinkByPassenger(userId);
  return c.json({ data: link ? [link] : [] });
});

// ─── POST /patron ─────────────────────────────────────────────────────────────

patronRouter.post("/", zValidator("json", PatronLinkCreateSchema), (c) => {
  const userId = c.get("userId");
  const userRole = c.get("userRole");
  const body = c.req.valid("json");

  if (userRole !== "passenger" && userRole !== "admin") {
    throw new HTTPException(403, { message: "Only passengers can set a patron driver" });
  }

  const driver = findUserById(body.driverId);
  if (!driver) {
    return c.json({ code: "NOT_FOUND", message: "Driver not found" }, 404);
  }
  if (driver.role !== "driver" && driver.role !== "motoboy") {
    return c.json({ code: "INVALID_ROLE", message: "The specified user is not a driver" }, 400);
  }
  if (driver.status !== "active") {
    return c.json({ code: "DRIVER_INACTIVE", message: "The driver account is not active" }, 400);
  }

  const link = createPatronLink(userId, body.driverId, body.label);
  return c.json(link, 201);
});

// ─── PATCH /patron/:id ────────────────────────────────────────────────────────

patronRouter.patch(
  "/:id",
  zValidator("json", z.object({ label: z.string().min(1).max(60) })),
  (c) => {
    const userId = c.get("userId");
    const linkId = c.req.param("id");
    const existing = findPatronLinkById(linkId);

    if (!existing) return c.json({ code: "NOT_FOUND", message: "Patron link not found" }, 404);

    if (existing.passengerId !== userId && c.get("userRole") !== "admin") {
      throw new HTTPException(403, { message: "You can only update your own patron link" });
    }

    const { label } = c.req.valid("json");
    const updated = updatePatronLink(linkId, label);
    return c.json(updated);
  },
);

// ─── DELETE /patron/:id ───────────────────────────────────────────────────────

patronRouter.delete("/:id", (c) => {
  const userId = c.get("userId");
  const linkId = c.req.param("id");
  const existing = findPatronLinkById(linkId);

  if (!existing) return c.json({ code: "NOT_FOUND", message: "Patron link not found" }, 404);

  if (existing.passengerId !== userId && c.get("userRole") !== "admin") {
    throw new HTTPException(403, { message: "You can only remove your own patron link" });
  }

  deactivatePatronLink(linkId);
  return c.json({ message: "Patron link removed", id: linkId });
});
