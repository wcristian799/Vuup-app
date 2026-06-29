import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, User, LogOut, Loader2, AlertCircle, Shield } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/api/client";
import { clearAuth, getPersistedUser } from "@/lib/auth";
import { PatronoCard } from "@/components/vuup/PatronoCard";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
  // No auth guard (VUU-82): freely navigable; content reflects session state.
});

function ProfilePage() {
  const navigate = useNavigate();
  const cachedUser = getPersistedUser();

  const meQuery = useQuery({
    queryKey: ["users", "me"],
    queryFn: () => apiClient.users.me(),
  });

  const sociedadeQuery = useQuery({
    queryKey: ["sociedade"],
    queryFn: () => apiClient.sociedade.get(),
  });

  const user = meQuery.data ?? cachedUser;
  const sociedade = sociedadeQuery.data;

  async function handleLogout() {
    try {
      await apiClient.auth.logout().catch(() => null); // best-effort server logout
    } finally {
      clearAuth();
      toast.info("Você saiu da sua conta");
      await navigate({ to: "/" });
    }
  }

  function getInitials(name: string | null | undefined): string {
    if (!name) return "U";
    return name
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
  }

  const nivelMap: Record<string, "prata" | "ouro" | "diamante"> = {
    silver: "prata",
    gold: "ouro",
    platinum: "diamante",
  };

  return (
    <main
      className="relative mx-auto h-[100dvh] w-full max-w-[480px] overflow-hidden flex flex-col"
      style={{ background: "var(--gradient-canvas)" }}
    >
      {/* Header */}
      <header className="flex items-center gap-3 px-4 pt-12 pb-4 shrink-0">
        <Link
          to="/"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-electric hover:border-electric transition-colors"
          aria-label="Voltar ao início"
        >
          <ArrowLeft size={16} />
        </Link>
        <h1 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
          <User size={20} className="text-electric" aria-hidden="true" />
          Perfil
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-4">
        {/* User card */}
        <div className="rounded-3xl border border-border bg-card p-6">
          {meQuery.isPending ? (
            <div className="flex justify-center py-4">
              <Loader2 size={24} className="animate-spin text-electric" aria-label="Carregando perfil" />
            </div>
          ) : meQuery.isError && !cachedUser ? (
            <div className="flex items-center gap-3">
              <AlertCircle size={18} className="text-destructive" aria-hidden="true" />
              <p className="text-sm text-destructive">Erro ao carregar perfil</p>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 rounded-2xl border border-electric/30">
                <AvatarFallback className="rounded-2xl bg-electric/10 text-electric font-display text-xl">
                  {getInitials(user?.fullName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-bold text-foreground truncate">
                  {user?.fullName ?? "Usuário"}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  {user?.role ?? "passageiro"}
                </p>
                {user?.rating != null && (
                  <p className="text-xs text-gold mt-0.5">★ {(user.rating as number).toFixed(1)}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sociedade / Patrono */}
        {sociedadeQuery.isPending ? (
          <div className="rounded-3xl border border-border bg-card p-4 flex justify-center">
            <Loader2 size={20} className="animate-spin text-electric" aria-label="Carregando Sociedade" />
          </div>
        ) : sociedade && sociedade.nivel !== "starter" ? (
          <PatronoCard
            tier={nivelMap[sociedade.nivel] ?? "prata"}
            monthlyEarnings={sociedade.totalReceivedPassiveIncomeCents}
            goalAmount={Math.ceil(sociedade.totalInvestedCents * 0.12)}
            progressPercent={Math.min(
              100,
              Math.round(
                (sociedade.totalReceivedPassiveIncomeCents /
                  Math.max(sociedade.totalInvestedCents * 0.12, 1)) *
                  100,
              ),
            )}
          />
        ) : (
          <div className="rounded-3xl border border-border/50 bg-card/50 p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
              <Shield size={18} className="text-gold" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Sociedade VUUP</p>
              <p className="text-xs text-muted-foreground">Torne-se patrono e ganhe renda passiva</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="rounded-3xl border border-border bg-card p-4 space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
            onClick={handleLogout}
            aria-label="Sair da conta"
          >
            <LogOut size={16} className="mr-2" aria-hidden="true" />
            Sair da conta
          </Button>
        </div>
      </div>
    </main>
  );
}
