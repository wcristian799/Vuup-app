/**
 * VUUP API Server — app definition (no side-effect `serve` call).
 *
 * This module exports the Hono `app` instance for:
 *   - Unit/integration tests (app.request — no TCP port needed)
 *   - Production entrypoint (server.ts) which calls serve()
 *
 * Architecture:
 *   - All routes are protected by JWT auth EXCEPT /auth/* and /health
 *   - No secrets in source — AUTH_SECRET must be set via env var
 *   - CORS scoped to dev origin; tighten to production domain before launch
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";

import "./db/database.js"; // ensure schema + migrations run at import time

import { authRouter } from "./routes/auth.js";
import { usersRouter } from "./routes/users.js";
import { ridesRouter } from "./routes/rides.js";
import { walletRouter } from "./routes/wallet.js";
import { safetyRouter } from "./routes/safety.js";
import { carpoolRouter } from "./routes/carpool.js";
import { patronRouter } from "./routes/patron.js";
import { deliveriesRouter } from "./routes/deliveries.js";
import { campaignsRouter, couponsRouter } from "./routes/campaigns.js";

const app = new Hono();

// ─── Global middleware ────────────────────────────────────────────────────────

app.use("*", logger());
app.use("*", prettyJSON());
app.use(
  "*",
  cors({
    origin: [
      "http://localhost:5173", // Vite dev server
      "http://localhost:4173", // Vite preview
      "https://vuup.app",      // production
    ],
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  }),
);

// ─── Health (unauthenticated) ─────────────────────────────────────────────────

app.get("/health", (c) =>
  c.json({
    status: "ok",
    version: "0.2.0",
    mode: "persistent",
    timestamp: new Date().toISOString(),
  }),
);

// ─── Route registry ───────────────────────────────────────────────────────────

app.route("/auth",        authRouter);        // /auth/*        — public
app.route("/users",       usersRouter);       // /users/*       — protected
app.route("/rides",       ridesRouter);       // /rides/*       — protected
app.route("/wallet",      walletRouter);      // /wallet/*      — protected
app.route("/safety",      safetyRouter);      // /safety/*      — protected
app.route("/carpool",     carpoolRouter);     // /carpool/*     — protected
app.route("/patron",      patronRouter);      // /patron/*      — protected
app.route("/deliveries",  deliveriesRouter);  // /deliveries/*  — protected
app.route("/campaigns",   campaignsRouter);   // /campaigns/*   — protected
app.route("/coupons",     couponsRouter);     // /coupons/*     — protected

// ─── 404 catch-all ───────────────────────────────────────────────────────────

app.notFound((c) =>
  c.json({ code: "NOT_FOUND", message: `Route ${c.req.method} ${c.req.path} not found` }, 404),
);

// ─── Error handler ────────────────────────────────────────────────────────────

app.onError((err, c) => {
  console.error("[ERROR]", err);
  const status = "status" in err && typeof err.status === "number" ? err.status : 500;
  const message = err.message ?? "Internal server error";
  return c.json({ code: "SERVER_ERROR", message }, status as 500);
});

export default app;
