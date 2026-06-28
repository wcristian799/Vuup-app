import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Camera, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DeliveryConfirmationPanelProps {
  open: boolean;
  delivery: {
    id: string;
    dropoff: { address: string; contactName: string };
    packageDescription: string;
    fareActual: number; // BRL cents
  };
  onConfirm: (photoToken?: string) => void;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DeliveryConfirmationPanel({
  open,
  delivery,
  onConfirm,
  onClose,
}: DeliveryConfirmationPanelProps) {
  const [photoToken, setPhotoToken] = React.useState<string | null>(null);

  // Focus trap refs
  const firstFocusRef = React.useRef<HTMLButtonElement>(null);
  const lastFocusRef = React.useRef<HTMLButtonElement>(null);

  // Reset photo when panel opens for a new delivery
  React.useEffect(() => {
    if (open) {
      setPhotoToken(null);
      const id = setTimeout(() => firstFocusRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [open, delivery.id]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (e.key === "Tab") {
      if (e.shiftKey) {
        if (document.activeElement === firstFocusRef.current) {
          e.preventDefault();
          lastFocusRef.current?.focus();
        }
      } else {
        if (document.activeElement === lastFocusRef.current) {
          e.preventDefault();
          firstFocusRef.current?.focus();
        }
      }
    }
  };

  const handleTakePhoto = () => {
    // Mock: generate a fake photo token
    setPhotoToken(`mock-photo-${delivery.id}-${Date.now()}`);
  };

  const handleConfirm = async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {
      // native only
    }
    onConfirm(photoToken ?? undefined);
  };

  const truncatedDesc =
    delivery.packageDescription.length > 60
      ? delivery.packageDescription.slice(0, 60) + "…"
      : delivery.packageDescription;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="delivery-confirm-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm"
            aria-hidden="true"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="delivery-confirm-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delivery-confirm-title"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            onKeyDown={handleKeyDown}
            className={cn(
              "absolute bottom-0 inset-x-0 z-50 flex flex-col",
              "rounded-t-3xl border-t border-border bg-card",
              "pb-[env(safe-area-inset-bottom)]",
            )}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-8 rounded-full bg-border" aria-hidden="true" />
            </div>

            <div className="flex flex-col gap-5 px-5 pb-6 pt-2">
              {/* Title row */}
              <div className="flex items-center justify-between">
                <h2
                  id="delivery-confirm-title"
                  className="font-display font-bold text-base text-foreground"
                >
                  Confirmar Entrega
                </h2>
                <button
                  type="button"
                  ref={firstFocusRef}
                  onClick={onClose}
                  aria-label="Fechar painel de confirmação"
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground",
                    "hover:bg-surface-2 hover:text-foreground transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  )}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>

              {/* Delivery details */}
              <div className="rounded-2xl border border-border bg-surface-2 px-4 py-3 flex flex-col gap-2">
                {/* Address */}
                <div className="flex flex-col gap-0.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Endereço de entrega
                  </p>
                  <p className="text-sm font-medium text-foreground">{delivery.dropoff.address}</p>
                  <p className="text-xs text-muted-foreground">
                    Contato: {delivery.dropoff.contactName}
                  </p>
                </div>

                {/* Divider */}
                <div className="h-px bg-border" aria-hidden="true" />

                {/* Package */}
                <div className="flex flex-col gap-0.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Pacote
                  </p>
                  <p className="text-xs text-muted-foreground">{truncatedDesc}</p>
                </div>
              </div>

              {/* Fare */}
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Valor da entrega
                </span>
                <span
                  className={cn(
                    "font-display font-extrabold text-2xl text-neon tabular-nums",
                    "[text-shadow:0_0_16px_oklch(0.86_0.24_148/0.5)]",
                  )}
                  aria-label={`Valor: ${formatBRL(delivery.fareActual)}`}
                >
                  {formatBRL(delivery.fareActual)}
                </span>
              </div>

              {/* Photo confirmation */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Foto de confirmação (opcional)
                </p>
                <button
                  type="button"
                  onClick={handleTakePhoto}
                  aria-label="Adicionar foto de confirmação de entrega"
                  className={cn(
                    "relative mx-auto flex h-[120px] w-[120px] flex-col items-center justify-center gap-1.5",
                    "rounded-2xl border-2 border-dashed transition-colors",
                    photoToken
                      ? "border-neon/60 bg-neon/10"
                      : "border-electric/40 bg-surface-2 hover:border-electric/70 hover:bg-surface-3",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  )}
                >
                  {photoToken ? (
                    <>
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neon/20">
                        <Check size={18} className="text-neon" aria-hidden="true" />
                      </div>
                      <span className="text-xs font-medium text-neon text-center px-2">
                        Foto adicionada
                      </span>
                    </>
                  ) : (
                    <>
                      <Camera size={22} className="text-muted-foreground" aria-hidden="true" />
                      <span className="text-[10px] text-muted-foreground text-center leading-tight px-2">
                        Tirar foto (opcional)
                      </span>
                    </>
                  )}
                </button>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col gap-2">
                <Button
                  variant="neon"
                  size="xl"
                  className="w-full rounded-2xl"
                  aria-label={`Confirmar entrega em ${delivery.dropoff.address}`}
                  onClick={handleConfirm}
                >
                  Confirmar entrega
                </Button>
                <Button
                  ref={lastFocusRef}
                  variant="outline"
                  size="default"
                  className="w-full"
                  aria-label="Cancelar confirmação de entrega"
                  onClick={onClose}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
