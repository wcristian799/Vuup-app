import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Phone, Shield, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/api/client";
import { persistAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

type Step = "phone" | "otp";

function LoginPage() {
  const navigate = useNavigate();
  const [step, setStep] = React.useState<Step>("phone");
  const [phone, setPhone] = React.useState("");
  const [otp, setOtp] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  // Format phone input: accepts digits only, formats as (XX) XXXXX-XXXX
  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
    let formatted = digits;
    if (digits.length > 2) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length > 7) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    setPhone(formatted);
  }

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      toast.error("Informe um número de telefone válido");
      return;
    }
    setLoading(true);
    try {
      await apiClient.auth.requestOtp(digits);
      toast.success("Código enviado via SMS!");
      setStep("otp");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao enviar código";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const digits = phone.replace(/\D/g, "");
    const otpClean = otp.replace(/\D/g, "");
    if (otpClean.length < 4) {
      toast.error("Informe o código completo");
      return;
    }
    setLoading(true);
    try {
      const result = await apiClient.auth.login({ phone: digits, otpCode: otpClean });
      persistAuth(result.accessToken, result.refreshToken, result.user);
      toast.success(`Bem-vindo, ${result.user.fullName}!`);
      await navigate({ to: "/" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Código inválido";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="relative mx-auto h-[100dvh] w-full max-w-[480px] flex flex-col items-center justify-center px-6"
      style={{ background: "var(--gradient-canvas)" }}
    >
      {/* Logo */}
      <div className="mb-10 text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-electric/10 border border-electric/30 mb-4">
          <Shield size={32} className="text-electric" aria-hidden="true" />
        </div>
        <h1 className="font-display text-3xl font-bold text-foreground">VUUP</h1>
        <p className="text-sm text-muted-foreground mt-1">Mobilidade urbana viva</p>
      </div>

      {/* Card */}
      <div className="w-full rounded-3xl border border-border bg-card p-6 shadow-lg">
        {step === "phone" ? (
          <form onSubmit={handleRequestOtp} noValidate aria-label="Formulário de login">
            <h2 className="text-lg font-semibold text-foreground mb-1">Entrar</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Informe seu celular para receber o código
            </p>

            <label htmlFor="phone" className="block text-xs font-medium text-muted-foreground mb-2">
              Número de celular
            </label>
            <div className="relative mb-6">
              <Phone
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="(11) 99999-9999"
                value={phone}
                onChange={handlePhoneChange}
                disabled={loading}
                className={cn(
                  "w-full rounded-xl border border-border bg-background/60 px-4 py-3 pl-9",
                  "text-sm text-foreground placeholder:text-muted-foreground",
                  "focus:outline-none focus:ring-2 focus:ring-electric/50 focus:border-electric",
                  "disabled:opacity-50",
                )}
                aria-label="Número de celular"
              />
            </div>

            <Button
              type="submit"
              variant="electric"
              className="w-full"
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin mr-2" aria-hidden="true" />
              ) : (
                <ArrowRight size={16} className="mr-2" aria-hidden="true" />
              )}
              {loading ? "Enviando..." : "Receber código"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleLogin} noValidate aria-label="Formulário de verificação OTP">
            <h2 className="text-lg font-semibold text-foreground mb-1">Verificar código</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Código enviado para <span className="text-foreground font-medium">{phone}</span>
            </p>

            <label htmlFor="otp" className="block text-xs font-medium text-muted-foreground mb-2">
              Código SMS
            </label>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              disabled={loading}
              className={cn(
                "w-full rounded-xl border border-border bg-background/60 px-4 py-3 mb-6",
                "text-2xl tracking-[0.5em] text-center text-foreground placeholder:text-muted-foreground placeholder:tracking-normal",
                "focus:outline-none focus:ring-2 focus:ring-electric/50 focus:border-electric",
                "disabled:opacity-50",
              )}
              aria-label="Código de verificação"
            />

            <Button
              type="submit"
              variant="electric"
              className="w-full mb-3"
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin mr-2" aria-hidden="true" />
              ) : null}
              {loading ? "Verificando..." : "Entrar"}
            </Button>

            <button
              type="button"
              className="w-full text-sm text-muted-foreground hover:text-electric transition-colors py-1"
              onClick={() => {
                setStep("phone");
                setOtp("");
              }}
              disabled={loading}
            >
              Trocar número
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
