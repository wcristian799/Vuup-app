/**
 * Patron driver routes (all protected)
 *
 * GET    /patron                   — list the current user's patron links
 * POST   /patron                   — set a patron driver for current passenger
 * PATCH  /patron/:id               — update label
 * DELETE /patron/:id               — remove / deactivate a patron link
 *
 * GET    /patron/passengers        — (driver view) list passengers who have
 *                                    the authenticated driver as their patron
 *
 * Business rule:
 *   A passenger can only have ONE active patron driver at a time.
 *   Setting a new one implicitly deactivates the previous one.
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";

import { requireAuth } from "../middleware/auth.js";
import { PatronLinkCreateSchema } from "../models/schemas.js";
import {
  MOCK_PATRON_LINKS,
  findPatronLinkByPassenger,
  findPatronLinksByDriver,
} from "../models/mock-data.js";
import { findUserById } from "../models/mock-data.js";

export const patronRouter = new Hono();

patronRouter.use("/*", requireAuth);

// ─── GET /patron — list caller's patron links ─────────────────────────────────

patronRouter.get("/", (c) => {
  const userId = c.get("userId");
  const userRole = c.get("userRole");

  if (userRole === "driver" || userRole === "motoboy") {
    // Drivers see which passengers have them as patron.
    const links = findPatronLinksByDriver(userId);
    return c.json({ data: links });
  }

  // Passengers see their own patron link (at most one active).
  const link = findPatronLinkByPassenger(userId);
  return c.json({ data: link ? [link] : [] });
});

// ─── GET /patron/passengers — driver-only view ────────────────────────────────

patronRouter.get("/passengers", (c) => {
  const userId = c.get("userId");
  const userRole = c.get("userRole");

  if (userRole !== "driver" && userRole !== "motoboy" && userRole !== "admin") {
    throw new HTTPException(403, { message: "Only drivers can list their patron passengers" });
  }

  const links = findPatronLinksByDriver(userId);
  // Enrich with passenger public info.
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

// ─── POST /patron — set patron driver ─────────────────────────────────────────

patronRouter.post("/", zValidator("json", PatronLinkCreateSchema), (c) => {
  const userId = c.get("userId");
  const userRole = c.get("userRole");
  const body = c.req.valid("json");

  if (userRole !== "passenger" && userRole !== "admin") {
    throw new HTTPException(403, { message: "Only passengers can set a patron driver" });
  }

  // Validate that target user exists and is a driver.
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

  const now = new Date().toISOString();

  // Deactivate any existing patron link for this passenger.
  MOCK_PATRON_LINKS.forEach((l, i) => {
    if (l.passengerId === userId && l.isActive) {
      MOCK_PATRON_LINKS[i] = { ...l, isActive: false, updatedAt: now };
    }
  });

  const newLink = {
    id: crypto.randomUUID(),
    passengerId: userId,
    driverId: body.driverId,
    label: body.label,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  MOCK_PATRON_LINKS.push(newLink);

  return c.json(newLink, 201);
});

// ─── PATCH /patron/:id — update label ────────────────────────────────────────

patronRouter.patch(
  "/:id",
  zValidator("json", z.object({ label: z.string().min(1).max(60) })),
  (c) => {
    const userId = c.get("userId");
    const linkId = c.req.param("id");
    const idx = MOCK_PATRON_LINKS.findIndex((l) => l.id === linkId);

    if (idx === -1) {
      return c.json({ code: "NOT_FOUND", message: "Patron link not found" }, 404);
    }

    const link = MOCK_PATRON_LINKS[idx]!;
    if (link.passengerId !== userId && c.get("userRole") !== "admin") {
      throw new HTTPException(403, { message: "You can only update your own patron link" });
    }

    const { label } = c.req.valid("json");
    const updated = { ...link, label, updatedAt: new Date().toISOString() };
    MOCK_PATRON_LINKS[idx] = updated;

    return c.json(updated);
  },
);

// ─── DELETE /patron/:id — deactivate patron link ──────────────────────────────

patronRouter.delete("/:id", (c) => {
  const userId = c.get("userId");
  const linkId = c.req.param("id");
  const idx = MOCK_PATRON_LINKS.findIndex((l) => l.id === linkId);

  if (idx === -1) {
    return c.json({ code: "NOT_FOUND", message: "Patron link not found" }, 404);
  }

  const link = MOCK_PATRON_LINKS[idx]!;
  if (link.passengerId !== userId && c.get("userRole") !== "admin") {
    throw new HTTPException(403, { message: "You can only remove your own patron link" });
  }

  const updated = { ...link, isActive: false, updatedAt: new Date().toISOString() };
  MOCK_PATRON_LINKS[idx] = updated;

  return c.json({ message: "Patron link removed", id: linkId });
});
