import * as React from "react";
import { Phone, User as UserIcon, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/api/client";
import { persistAuth } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface QuickRegisterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful register/session is persisted. */
  onRegistered: () => void;
}

/**
 * Quick-register modal (VUU-82). OTP was removed by founder decision: the user
 * navigates freely and only registers here, at the moment of requesting a ride.
 * Fields: name + phone (name optional). On submit we create/resolve the account
 * and persist the session, then hand control back to the ride flow.
 */
export function QuickRegisterDialog({ open, onOpenChange, onRegistered }: QuickRegisterDialogProps) {
  const [fullName, setFullName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
    let formatted = digits;
    if (digits.length > 2) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length > 7)
      formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    setPhone(formatted);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      toast.error("Informe um número de telefone válido");
      return;
    }
    setLoading(true);
    try {
      const result = await apiClient.auth.register({
        phone: digits,
        fullName: fullName.trim() || undefined,
      });
      persistAuth(result.accessToken, result.refreshToken, result.user);
      toast.success(`Tudo pronto, ${result.user.fullName}!`);
      onOpenChange(false);
      onRegistered();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Não foi possível concluir o cadastro";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Falta pouco para a sua corrida</DialogTitle>
          <DialogDescription>
            Só precisamos do seu nome e telefone para confirmar.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate aria-label="Cadastro rápido">
          <label htmlFor="qr-name" className="block text-xs font-medium text-muted-foreground mb-2">
            Nome
          </label>
          <div className="relative mb-4">
            <UserIcon
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              id="qr-name"
              type="text"
              autoComplete="name"
              placeholder="Seu nome"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={loading}
              className={cn(
                "w-full rounded-xl border border-border bg-background/60 px-4 py-3 pl-9",
                "text-sm text-foreground placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-2 focus:ring-electric/50 focus:border-electric",
                "disabled:opacity-50",
              )}
              aria-label="Nome"
            />
          </div>

          <label
            htmlFor="qr-phone"
            className="block text-xs font-medium text-muted-foreground mb-2"
          >
            Número de celular
          </label>
          <div className="relative mb-6">
            <Phone
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              id="qr-phone"
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
              required
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
            {loading ? "Confirmando..." : "Confirmar e continuar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
