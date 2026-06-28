/**
 * Auth store — persists JWT to localStorage so page refreshes survive.
 * Also wires setAccessToken in apiClient so every fetch picks it up.
 */
import { setAccessToken } from "@/api/client";
import type { UserPublic } from "@/api/types";

const TOKEN_KEY = "vuup_access_token";
const REFRESH_KEY = "vuup_refresh_token";
const USER_KEY = "vuup_user";

export function loadPersistedAuth() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) setAccessToken(token);
}

export function persistAuth(accessToken: string, refreshToken: string, user: UserPublic) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  setAccessToken(accessToken);
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
  setAccessToken(null);
}

export function getPersistedUser(): UserPublic | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as UserPublic) : null;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return Boolean(localStorage.getItem(TOKEN_KEY));
}
