/**
 * Hono JWT auth middleware.
 * Attaches the decoded token payload to the Hono context for downstream handlers.
 * Every protected route MUST be wrapped with requireAuth().
 */

import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { verifyToken, type TokenPayload } from "../lib/auth.js";

// Extend Hono's Variables interface for typed context
declare module "hono" {
  interface ContextVariableMap {
    jwtPayload: TokenPayload;
    userId: string;
    userRole: string;
  }
}

export async function requireAuth(c: Context, next: Next): Promise<Response | void> {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new HTTPException(401, { message: "Missing or malformed Authorization header" });
  }

  const token = authHeader.slice(7);
  try {
    const payload = await verifyToken(token);
    c.set("jwtPayload", payload);
    c.set("userId", payload.sub ?? "");
    c.set("userRole", payload.role ?? "");
    await next();
  } catch {
    throw new HTTPException(401, { message: "Invalid or expired token" });
  }
}
