/**
 * VUU-82 — register-flow security tests (supersedes VUU-78 OTP bypass guard).
 *
 * OTP was removed by founder decision (2026-06-29). Auth is now phone-first
 * registration at ride time. Without phone-ownership verification we accept the
 * documented residual risk that knowing a phone grants a session, BUT we must
 * NOT let re-registration overwrite/take over an existing account's profile,
 * and a duplicate phone must resolve to the SAME account (login), never a
 * second shadow account. These tests lock that behavior in.
 */

import { describe, it, expect } from "vitest";
import app from "../index.js";

async function register(body: Record<string, unknown>): Promise<Response> {
  return app.request("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /auth/register — account integrity (VUU-82)", () => {
  it("issues a session for a new phone (phone-only quick register)", async () => {
    const res = await register({ phone: "+5511970000123" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { accessToken?: string; refreshToken?: string };
    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
  });

  it("rejects a request without a phone", async () => {
    const res = await register({ fullName: "Sem Telefone" });
    expect(res.status).toBe(400);
  });

  it("resolves a duplicate phone to the SAME account (no shadow account)", async () => {
    const phone = "+5511970000456";
    const a = (await (await register({ phone, fullName: "Primeiro" })).json()) as {
      user: { id: string };
    };
    const b = (await (await register({ phone })).json()) as { user: { id: string } };
    expect(b.user.id).toBe(a.user.id);
  });

  it("does NOT overwrite an existing account's name on re-registration (no profile takeover)", async () => {
    const phone = "+5511970000789";
    const owner = (await (await register({ phone, fullName: "Dono Original" })).json()) as {
      user: { id: string; fullName: string };
    };
    const attacker = (await (
      await register({ phone, fullName: "Atacante Renomeando" })
    ).json()) as { user: { id: string; fullName: string } };

    expect(attacker.user.id).toBe(owner.user.id);
    expect(attacker.user.fullName).toBe("Dono Original");
  });

  it("no longer exposes the removed OTP endpoints", async () => {
    const otpReq = await app.request("/auth/otp-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "+5511960000999" }),
    });
    expect(otpReq.status).toBe(404);

    const login = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "+5511960000999", otpCode: "999999" }),
    });
    expect(login.status).toBe(404);
  });
});
