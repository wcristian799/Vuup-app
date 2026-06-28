/**
 * VUUP API client — typed fetch wrappers for TanStack Query.
 *
 * Usage:
 *   import { apiClient } from "@/api/client";
 *   const { data } = useQuery({ queryKey: ["wallet"], queryFn: () => apiClient.wallet.get() });
 */

import type {
  LoginRequest,
  LoginResponse,
  Ride,
  RideRequest,
  Wallet,
  Transaction,
  SafetyEvent,
  SafetyEventType,
  CarpoolRoute,
  PaginatedResponse,
  LatLng,
  WalletTransfer,
  WalletTransferRequest,
  CampaignDiscount,
  SociedadeParticipacao,
  SociedadeNivel,
  PaymentGatewayTransaction,
} from "./types.js";
import { API_BASE_URL } from "./types.js";

// ─── Auth token storage (in-memory; swap for secure storage in production) ───

let _accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  _accessToken = token;
}

export function getAccessToken(): string | null {
  return _accessToken;
}

// ─── Fetch wrapper ────────────────────────────────────────────────────────────

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (_accessToken) {
    headers["Authorization"] = `Bearer ${_accessToken}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ code: "NETWORK_ERROR", message: res.statusText }));
    throw Object.assign(new Error((err as { message?: string }).message ?? "Request failed"), {
      status: res.status,
      code: (err as { code?: string }).code,
    });
  }

  return res.json() as Promise<T>;
}

// ─── API namespaces ───────────────────────────────────────────────────────────

export const apiClient = {
  auth: {
    requestOtp: (phone: string) =>
      request<{ message: string; expiresIn: number }>("/auth/otp-request", {
        method: "POST",
        body: JSON.stringify({ phone }),
      }),

    login: (data: LoginRequest) =>
      request<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    refresh: (refreshToken: string) =>
      request<{ accessToken: string; expiresIn: number }>("/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      }),

    logout: () => request<{ message: string }>("/auth/logout", { method: "POST" }),
  },

  users: {
    me: () =>
      request<{ id: string; fullName: string; role: string; [k: string]: unknown }>("/users/me"),
    updateMe: (data: { fullName?: string; avatarUrl?: string | null }) =>
      request<{ id: string }>("/users/me", { method: "PATCH", body: JSON.stringify(data) }),
  },

  rides: {
    list: () => request<PaginatedResponse<Ride>>("/rides"),
    get: (id: string) => request<Ride>(`/rides/${id}`),
    create: (data: RideRequest) =>
      request<Ride>("/rides", { method: "POST", body: JSON.stringify(data) }),
    updateStatus: (id: string, status: Ride["status"]) =>
      request<Ride>(`/rides/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    nearbyDrivers: () =>
      request<{
        drivers: Array<{
          id: string;
          fullName: string;
          rating: number | null;
          location: LatLng;
          estimatedArrivalMin: number;
        }>;
      }>("/rides/nearby-drivers"),
  },

  wallet: {
    get: () => request<Wallet>("/wallet"),
    transactions: (params?: { page?: number; limit?: number; type?: string }) => {
      const qs = new URLSearchParams();
      if (params?.page) qs.set("page", String(params.page));
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.type) qs.set("type", params.type);
      const query = qs.toString() ? `?${qs.toString()}` : "";
      return request<PaginatedResponse<Transaction>>(`/wallet/transactions${query}`);
    },
    transfer: (data: WalletTransferRequest) =>
      request<{ transfer: WalletTransfer; message: string }>("/wallet/transfer", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    transfers: () => request<PaginatedResponse<WalletTransfer>>("/wallet/transfers"),
    getTransfer: (id: string) => request<WalletTransfer>(`/wallet/transfers/${id}`),
    activateCampaignDiscount: (data?: { dailyAmountCents?: number; totalDays?: number }) =>
      request<{ campaignDiscount: CampaignDiscount; message: string }>(
        "/wallet/campaign-discount",
        {
          method: "POST",
          body: JSON.stringify(data ?? {}),
        },
      ),
    applyCampaignDiscount: () =>
      request<{ campaignDiscount: CampaignDiscount; creditedCents: number; message: string }>(
        "/wallet/campaign-discount/apply",
        { method: "POST" },
      ),
    passiveIncome: () =>
      request<{
        passiveIncomeSharePercent: number;
        nivel: SociedadeNivel;
        totalReceivedPassiveIncomeCents: number;
        estimatedMonthlyPassiveIncomeCents?: number;
        recentTransactions?: Transaction[];
        snapshotAt: string;
      }>("/wallet/passive-income"),
    payRide: (data: { rideId: string; method: "wallet" | "pix" | "credit_card"; amountCents: number }) =>
      request<{ payment: PaymentGatewayTransaction; message: string }>("/wallet/pay-ride", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  sociedade: {
    get: () => request<SociedadeParticipacao>("/sociedade"),
    upgradeOptions: () =>
      request<{
        currentNivel: SociedadeNivel;
        options: Array<{
          nivel: SociedadeNivel;
          directUpgradeCostCents: number | null;
          totalCostFromCurrentNivelCents: number;
          passiveIncomeSharePercent: number;
          isDirectUpgrade: boolean;
        }>;
      }>("/sociedade/upgrade-options"),
    upgrade: (data: { targetNivel: SociedadeNivel; paymentMethod?: "wallet" | "pix" | "credit_card" }) =>
      request<{
        participacao: SociedadeParticipacao;
        costCents: number;
        paymentMethod: string;
        message: string;
      }>("/sociedade/upgrade", { method: "POST", body: JSON.stringify(data) }),
    simulatePassiveIncome: (nivel: SociedadeNivel) =>
      request<{
        nivel: SociedadeNivel;
        passiveIncomeSharePercent: number;
        estimatedMonthlyPassiveIncomeCents: number;
        estimatedYearlyPassiveIncomeCents: number;
        upgradeCost: number | null;
      }>(`/sociedade/passive-income/simulate?nivel=${nivel}`),
  },

  safety: {
    events: () => request<PaginatedResponse<SafetyEvent>>("/safety/events"),
    report: (data: {
      type: SafetyEventType;
      location: LatLng;
      description: string;
      rideId?: string;
    }) => request<SafetyEvent>("/safety/events", { method: "POST", body: JSON.stringify(data) }),
    upvote: (id: string) => request<SafetyEvent>(`/safety/events/${id}/upvote`, { method: "POST" }),
    sos: (data: { location: LatLng; rideId?: string }) =>
      request<{ event: SafetyEvent; message: string }>("/safety/sos", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  carpool: {
    routes: () => request<PaginatedResponse<CarpoolRoute>>("/carpool/routes"),
    getRoute: (id: string) => request<CarpoolRoute>(`/carpool/routes/${id}`),
    join: (id: string) => request<CarpoolRoute>(`/carpool/routes/${id}/join`, { method: "POST" }),
  },
};
