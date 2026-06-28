import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { X, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DisputeCounterOfferPanelProps {
  open: boolean;
  rideId: string;
  /** Fare offered by passenger in BRL cents */
  passengerOffer: number;
  /** Current best counter from driver pool in BRL cents */
  currentBid: number;
  /** Count of drivers currently in the dispute */
  driversInDispute: number;
  /** Milliseconds remaining in dispute window */
  windowRemainingMs: number;
  onSubmitOffer: (amountCents: number) => void;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** Format milliseconds as MM:SS */
function formatCountdown(ms: number): string {
  const totalSecs = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DisputeCounterOfferPanel({
  open,
  rideId: _rideId,
  passengerOffer,
  currentBid,
  driversInDispute,
  windowRemainingMs,
  onSubmitOffer,
  onClose,
}: DisputeCounterOfferPanelProps) {
  // Counter-offer input state — pre-fill from currentBid converted to BRL decimal string
  const [inputValue, setInputValue] = React.useState<string>(
    (currentBid / 100).toFixed(2).replace(".", ","),
  );

  // Live countdown
  const [remainingMs, setRemainingMs] = React.useState(windowRemainingMs);

  React.useEffect(() => {
    setRemainingMs(windowRemainingMs);
  }, [windowRemainingMs]);

  React.useEffect(() => {
    if (!open || remainingMs <= 0) return;
    const id = setInterval(() => {
      setRemainingMs((prev) => Math.max(0, prev - 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [open, remainingMs]);

  // Sync pre-fill when currentBid changes
  React.useEffect(() => {
    setInputValue((currentBid / 100).toFixed(2).replace(".", ","));
  }, [currentBid]);

  // Focus trap: capture first/last focusable refs
  const firstFocusRef = React.useRef<HTMLButtonElement>(null);
  const lastFocusRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (open) {
      // Defer to let the panel animate in
      const id = setTimeout(() => firstFocusRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    // Trap Tab
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

  /** Parse the BRL-formatted input string back to cents */
  const parsedCents = React.useMemo(() => {
    // Accept both comma and dot as decimal separator; strip currency symbols
    const cleaned = inputValue
      .replace(/[R$\s]/g, "")
      .replace(/\./g, "")
      .replace(",", ".");
    const num = parseFloat(cleaned);
    if (isNaN(num) || num <= 0) return 0;
    return Math.round(num * 100);
  }, [inputValue]);

  const handleSubmit = async () => {
    if (parsedCents <= 0) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      // haptics only available on native
    }
    onSubmitOffer(parsedCents);
  };

  const isUrgent = remainingMs < 30_000;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
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
            key="panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dispute-title"
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
              {/* Title row + countdown */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2
                    id="dispute-title"
                    className="font-display font-bold text-base text-foreground"
                  >
                    Disputa de Corrida
                  </h2>
                  {/* Countdown */}
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-bold font-mono tabular-nums",
                      isUrgent
                        ? "bg-danger/20 text-danger border border-danger/40"
                        : "bg-surface-2 text-muted-foreground border border-border",
                    )}
                    aria-live="polite"
                    aria-label={`Tempo restante: ${formatCountdown(remainingMs)}`}
                  >
                    {formatCountdown(remainingMs)}
                  </span>
                </div>
                <button
                  type="button"
                  ref={firstFocusRef}
                  onClick={onClose}
                  aria-label="Fechar painel de disputa"
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground",
                    "hover:bg-surface-2 hover:text-foreground transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  )}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>

              {/* Fare info grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* Passenger offer */}
                <div className="rounded-2xl border border-border bg-surface-2 p-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Oferta do passageiro
                  </p>
                  <p
                    className={cn(
                      "font-display font-extrabold text-xl text-neon",
                      "[text-shadow:0_0_16px_oklch(0.86_0.24_148/0.5)]",
                    )}
                    aria-label={`Oferta do passageiro: ${formatBRL(passengerOffer)}`}
                  >
                    {formatBRL(passengerOffer)}
                  </p>
                </div>

                {/* Current best bid */}
                <div className="rounded-2xl border border-electric/30 bg-electric/5 p-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Melhor oferta dos motoristas
                  </p>
                  <p
                    className={cn(
                      "font-display font-extrabold text-xl text-electric",
                      "[text-shadow:0_0_16px_oklch(0.72_0.22_246/0.4)]",
                    )}
                    aria-label={`Melhor oferta dos motoristas: ${formatBRL(currentBid)}`}
                  >
                    {formatBRL(currentBid)}
                  </p>
                </div>
              </div>

              {/* Drivers competing badge */}
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2">
                  <Users size={13} className="text-muted-foreground" aria-hidden="true" />
                </div>
                <span className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{driversInDispute}</span> motoristas
                  disputando esta corrida
                </span>
              </div>

              {/* Counter-offer input */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="counter-offer-input"
                  className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                >
                  Sua contra-oferta (R$)
                </label>
                <div className="relative flex items-center">
                  <span
                    className="absolute left-3 text-sm font-semibold text-muted-foreground select-none"
                    aria-hidden="true"
                  >
                    R$
                  </span>
                  <input
                    id="counter-offer-input"
                    type="text"
                    inputMode="decimal"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    aria-label="Valor da contra-oferta em reais"
                    aria-describedby="counter-offer-hint"
                    className={cn(
                      "w-full rounded-xl border bg-surface-2 py-3 pl-10 pr-4",
                      "font-display font-bold text-lg text-foreground tabular-nums",
                      "placeholder:text-muted-foreground/50",
                      "border-border transition-colors",
                      "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:border-electric",
                    )}
                    placeholder="0,00"
                  />
                </div>
                <p id="counter-offer-hint" className="text-[10px] text-muted-foreground">
                  Oferta mínima: {formatBRL(passengerOffer)}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col gap-2">
                <Button
                  variant="electric"
                  size="xl"
                  className="w-full"
                  disabled={parsedCents <= 0}
                  aria-label={`Enviar contra-oferta de ${parsedCents > 0 ? formatBRL(parsedCents) : "—"}`}
                  onClick={handleSubmit}
                >
                  Enviar contra-oferta
                  {parsedCents > 0 && (
                    <span className="ml-1 opacity-80 text-sm">· {formatBRL(parsedCents)}</span>
                  )}
                </Button>
                <Button
                  ref={lastFocusRef}
                  variant="outline"
                  size="default"
                  className="w-full"
                  aria-label="Cancelar disputa"
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
