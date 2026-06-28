/**
 * VUUP API Server — production entrypoint.
 * Imports app and starts the HTTP server.
 */

import { serve } from "@hono/node-server";
import app from "./index.js";

const PORT = Number(process.env["PORT"] ?? 3001);

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`VUUP API server running at http://localhost:${PORT}`);
  console.log("Mode: PERSISTENT (SQLite via better-sqlite3)");
  console.log("Routes:");
  console.log("  GET  /health");
  console.log("  POST /auth/otp-request  POST /auth/login  POST /auth/refresh  POST /auth/logout");
  console.log("  GET|PATCH /users/me");
  console.log("  POST /rides/fare-estimate  POST /rides  GET /rides  GET|PATCH /rides/:id/...");
  console.log("  GET /wallet  GET /wallet/transactions  POST /wallet/transfer");
  console.log("  GET|POST /safety/events  POST /safety/sos");
  console.log("  GET|POST /carpool/routes  POST /carpool/routes/:id/join");
  console.log("  GET|POST|PATCH|DELETE /patron  GET /patron/passengers");
  console.log("  POST|GET /deliveries  GET /deliveries/open  PATCH /deliveries/:id/status");
  console.log("  POST|GET /campaigns  PATCH /campaigns/:id/status");
  console.log("  POST /campaigns/:id/coupons  GET /campaigns/:id/coupons");
  console.log("  POST /coupons/validate");
});
