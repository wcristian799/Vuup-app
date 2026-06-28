/**
 * JWT auth helpers using `jose` (Web Crypto compatible, no native bindings).
 *
 * Access tokens:  short-lived (15 min), HS256
 * Refresh tokens: long-lived (30 days), HS256
 *
 * In production: store secrets in environment variables, never in code.
 * The AUTH_SECRET env var must be set; a default is provided for local dev only.
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { createSecretKey } from "node:crypto";

// NEVER commit real secrets — this default is for local dev mock only.
const DEV_SECRET = "vuup-dev-secret-change-in-production-min32chars!";
const RAW_SECRET = process.env["AUTH_SECRET"] ?? DEV_SECRET;

// Fail fast in production if the secret is missing or still the dev default.
// This prevents shipping a build that signs tokens with a publicly known key.
if (
  process.env["NODE_ENV"] === "production" &&
  (RAW_SECRET === DEV_SECRET || RAW_SECRET.length < 32)
) {
  throw new Error(
    "AUTH_SECRET must be set to a random 32+ char value in production (cannot use the dev default).",
  );
}

function getSecretKey() {
  // Use Node.js createSecretKey which produces a proper KeyObject, avoiding
  // the TextEncoder/Uint8Array cross-realm issue in some test environments.
  return createSecretKey(Buffer.from(RAW_SECRET, "utf-8"));
}

export interface TokenPayload extends JWTPayload {
  sub: string; // userId
  role: string;
}

export async function signAccessToken(userId: string, role: string): Promise<string> {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(getSecretKey());
}

export async function signRefreshToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecretKey());
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, getSecretKey());
  return payload as TokenPayload;
}
