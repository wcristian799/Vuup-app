import * as React from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { isAuthenticated } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Wallet as WalletIcon, TrendingUp, ArrowDownLeft, ArrowUpRight, Loader2, AlertCircle } from "lucide-react";
import { apiClient } from "@/api/client";
import { PatronoCard } from "@/components/vuup/PatronoCard";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/api/types";

export const Route = createFileRoute("/wallet")({
  component: WalletPage,
  beforeLoad: () => {
    if (!isAuthenticated()) throw redirect({ to: "/login" });
  },
});

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

const TX_ICON: Record<string, React.ElementType> = {};

function TxRow({ tx }: { tx: Transaction }) {
  const isCredit = tx.amountCents > 0;
  return (
    <li className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0">
      <div
        className={cn(
          "h-9 w-9 rounded-full flex items-center justify-center shrink-0",
          isCredit ? "bg-neon/10" : "bg-electric/10",
        )}
        aria-hidden="true"
      >
        {isCredit ? (
          <ArrowDownLeft size={16} className="text-neon" />
        ) : (
          <ArrowUpRight size={16} className="text-electric" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{tx.description}</p>
        <p className="text-xs text-muted-foreground">{formatDate(tx.createdAt)}</p>
      </div>
      <span
        className={cn(
          "text-sm font-semibold tabular-nums",
          isCredit ? "text-neon" : "text-foreground",
        )}
        aria-label={`${isCredit ? "Crédito" : "Débito"} ${formatBRL(Math.abs(tx.amountCents))}`}
      >
        {isCredit ? "+" : "-"}
        {formatBRL(Math.abs(tx.amountCents))}
      </span>
    </li>
  );
}

function WalletPage() {
  const walletQuery = useQuery({
    queryKey: ["wallet"],
    queryFn: () => apiClient.wallet.get(),
  });

  const txQuery = useQuery({
    queryKey: ["wallet", "transactions"],
    queryFn: () => apiClient.wallet.transactions({ limit: 20 }),
  });

  const wallet = walletQuery.data;
  const transactions = txQuery.data?.data ?? [];

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
          <WalletIcon size={20} className="text-electric" aria-hidden="true" />
          Carteira
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-4">
        {/* Balance card */}
        {walletQuery.isPending ? (
          <div className="rounded-3xl border border-border bg-card p-6 flex items-center justify-center min-h-[120px]">
            <Loader2 size={24} className="animate-spin text-electric" aria-label="Carregando saldo" />
          </div>
        ) : walletQuery.isError ? (
          <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-6 flex items-center gap-3">
            <AlertCircle size={20} className="text-destructive shrink-0" aria-hidden="true" />
            <p className="text-sm text-destructive">Erro ao carregar carteira</p>
          </div>
        ) : wallet ? (
          <div className="rounded-3xl border border-electric/30 bg-card p-6">
            <p className="text-xs text-muted-foreground mb-1">Saldo disponível</p>
            <p className="font-display text-4xl font-bold text-foreground" aria-label={`Saldo ${formatBRL(wallet.balanceCents)}`}>
              {formatBRL(wallet.balanceCents)}
            </p>
            {wallet.pendingCents > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                + {formatBRL(wallet.pendingCents)} pendente
              </p>
            )}

            {/* Stats row */}
            <div className="mt-4 pt-4 border-t border-border/50 flex gap-4">
              <div>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <TrendingUp size={10} aria-hidden="true" /> Ganhos totais
                </p>
                <p className="text-sm font-semibold text-neon">
                  {formatBRL(wallet.lifetimeEarningsCents)}
                </p>
              </div>
              {wallet.sociedadeNivel && (
                <div>
                  <p className="text-[10px] text-muted-foreground">Nível Sociedade</p>
                  <p className="text-sm font-semibold text-gold capitalize">{wallet.sociedadeNivel}</p>
                </div>
              )}
              {wallet.passiveIncomeSharePercent != null && (
                <div>
                  <p className="text-[10px] text-muted-foreground">Renda Passiva</p>
                  <p className="text-sm font-semibold text-electric">
                    {wallet.passiveIncomeSharePercent}%
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Patrono card if sociedadeNivel is set */}
        {wallet?.sociedadeNivel && wallet.sociedadeNivel !== "starter" && (
          <PatronoCard
            tier={
              wallet.sociedadeNivel === "gold"
                ? "ouro"
                : wallet.sociedadeNivel === "platinum"
                  ? "diamante"
                  : "prata"
            }
            monthlyEarnings={wallet.lifetimeEarningsCents}
            goalAmount={Math.ceil(wallet.lifetimeEarningsCents * 1.3)}
            progressPercent={Math.min(
              100,
              Math.round((wallet.balanceCents / Math.max(wallet.lifetimeEarningsCents, 1)) * 100),
            )}
          />
        )}

        {/* Transactions */}
        <div className="rounded-3xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Transações recentes</h2>
          {txQuery.isPending ? (
            <div className="flex justify-center py-8">
              <Loader2 size={20} className="animate-spin text-electric" aria-label="Carregando transações" />
            </div>
          ) : txQuery.isError ? (
            <p className="text-sm text-destructive py-4 text-center">Erro ao carregar transações</p>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhuma transação ainda
            </p>
          ) : (
            <ul aria-label="Lista de transações">
              {transactions.map((tx) => (
                <TxRow key={tx.id} tx={tx} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
