/**
 * VUUP API Server — Hono on Node.js
 *
 * Architecture:
 *   - All routes are protected by JWT auth EXCEPT /auth/* and /health
 *   - No secrets in source — AUTH_SECRET must be set via env var
 *   - CORS scoped to dev origin; tighten to production domain before launch
 *   - Runs on PORT (default 3001) to avoid conflict with Vite dev server (5173)
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { serve } from "@hono/node-server";

import { authRouter } from "./routes/auth.js";
import { usersRouter } from "./routes/users.js";
import { ridesRouter } from "./routes/rides.js";
import { walletRouter } from "./routes/wallet.js";
import { safetyRouter } from "./routes/safety.js";
import { carpoolRouter } from "./routes/carpool.js";
import { patronRouter } from "./routes/patron.js";
import { matchingRouter } from "./routes/matching.js";
import { sociedadeRouter } from "./routes/sociedade.js";

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
      "https://vuup.app", // production (update domain)
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
    version: "0.1.0",
    mode: "mock",
    timestamp: new Date().toISOString(),
  }),
);

// ─── Route registry ───────────────────────────────────────────────────────────

app.route("/auth", authRouter); // /auth/*    — public
app.route("/users", usersRouter); // /users/*   — protected
app.route("/rides", ridesRouter); // /rides/*   — protected
app.route("/wallet", walletRouter); // /wallet/*  — protected
app.route("/safety", safetyRouter); // /safety/*  — protected
app.route("/carpool", carpoolRouter); // /carpool/* — protected
app.route("/patron", patronRouter); // /patron/*  — protected
app.route("/matching", matchingRouter); // /matching/* — protected (Onda 3)
app.route("/sociedade", sociedadeRouter); // /sociedade/* — protected (Onda 5)

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

// ─── Start ────────────────────────────────────────────────────────────────────

// Guard: do not bind the HTTP server when imported by test runners.
// Vitest sets process.env.VITEST; the guard prevents EADDRINUSE in parallel test runs.
if (!process.env["VITEST"]) {
  const PORT = Number(process.env["PORT"] ?? 3001);

  serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(`VUUP API server running at http://localhost:${PORT}`);
    console.log("Mode: MOCK (in-memory data, no database)");
    console.log("Routes:");
    console.log("  GET  /health");
    console.log("  POST /auth/otp-request");
    console.log("  POST /auth/login");
    console.log("  POST /auth/refresh");
    console.log("  GET  /users/me");
    console.log("  POST /rides/fare-estimate");
    console.log("  POST /rides");
    console.log("  GET  /rides");
    console.log("  GET  /rides/:id");
    console.log("  PATCH /rides/:id/status");
    console.log("  PATCH /rides/:id/cancel");
    console.log("  GET  /rides/nearby-drivers");
    console.log("  GET  /patron");
    console.log("  POST /patron");
    console.log("  PATCH /patron/:id");
    console.log("  DELETE /patron/:id");
    console.log("  GET  /patron/passengers");
    console.log("  GET  /wallet");
    console.log("  GET  /wallet/transactions");
    console.log("  GET  /safety/events");
    console.log("  POST /safety/events");
    console.log("  POST /safety/events/:id/upvote");
    console.log("  POST /safety/sos");
    console.log("  GET  /carpool/routes");
    console.log("  GET  /carpool/routes/:id");
    console.log("  POST /carpool/routes");
    console.log("  POST /carpool/routes/:id/join");
    console.log("  [Onda 5] POST /wallet/transfer");
    console.log("  [Onda 5] GET  /wallet/transfers");
    console.log("  [Onda 5] POST /wallet/campaign-discount");
    console.log("  [Onda 5] POST /wallet/campaign-discount/apply");
    console.log("  [Onda 5] GET  /wallet/passive-income");
    console.log("  [Onda 5] POST /wallet/pay-ride");
    console.log("  [Onda 5] GET  /sociedade");
    console.log("  [Onda 5] GET  /sociedade/upgrade-options");
    console.log("  [Onda 5] POST /sociedade/upgrade");
    console.log("  [Onda 5] GET  /sociedade/passive-income/simulate");
  });
}

export default app;
