import * as React from "react";
import { Package, MapPin, Camera, Check } from "lucide-react";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type DeliveryStatus =
  | "pending"
  | "accepted"
  | "picked_up"
  | "in_transit"
  | "delivered"
  | "failed";

interface MockDelivery {
  id: string;
  status: DeliveryStatus;
  pickup: { address: string; contactName: string };
  dropoff: { address: string; contactName: string };
  packageDescription: string;
  estimatedDistanceKm: number;
  fareEstimate: number; // BRL cents
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

const STATUS_CONFIG: Record<
  DeliveryStatus,
  { label: string; dotClass: string; labelClass: string }
> = {
  pending: {
    label: "Pendente",
    dotClass: "bg-electric",
    labelClass: "text-electric",
  },
  accepted: {
    label: "Aceito",
    dotClass: "bg-neon",
    labelClass: "text-neon",
  },
  picked_up: {
    label: "Coletado",
    dotClass: "bg-neon",
    labelClass: "text-neon",
  },
  in_transit: {
    label: "Em trânsito",
    dotClass: "bg-neon",
    labelClass: "text-neon",
  },
  delivered: {
    label: "Entregue",
    dotClass: "bg-muted-foreground",
    labelClass: "text-muted-foreground",
  },
  failed: {
    label: "Falhou",
    dotClass: "bg-danger",
    labelClass: "text-danger",
  },
};

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_DELIVERIES: MockDelivery[] = [
  {
    id: "del-001",
    status: "in_transit",
    pickup: { address: "Av. Paulista, 1000 - Bela Vista", contactName: "Carlos Mendes" },
    dropoff: { address: "Rua Augusta, 500 - Consolação", contactName: "Ana Lima" },
    packageDescription: "Caixa com eletrônicos frágeis",
    estimatedDistanceKm: 3.2,
    fareEstimate: 1240,
  },
  {
    id: "del-002",
    status: "delivered",
    pickup: { address: "Rua da Consolação, 200 - Centro", contactName: "Bruno Costa" },
    dropoff: { address: "Av. Rebouças, 800 - Pinheiros", contactName: "Fernanda Souza" },
    packageDescription: "Documentos importantes",
    estimatedDistanceKm: 5.8,
    fareEstimate: 1760,
  },
  {
    id: "del-003",
    status: "accepted",
    pickup: { address: "Rua Oscar Freire, 300 - Jardins", contactName: "Pedro Oliveira" },
    dropoff: { address: "Av. Faria Lima, 1200 - Itaim Bibi", contactName: "Juliana Rocha" },
    packageDescription: "Roupas e acessórios",
    estimatedDistanceKm: 4.1,
    fareEstimate: 1420,
  },
  {
    id: "del-004",
    status: "pending",
    pickup: { address: "Rua Vergueiro, 600 - Vila Mariana", contactName: "Roberto Silva" },
    dropoff: { address: "Rua Bela Cintra, 150 - Jardim Paulista", contactName: "Camila Torres" },
    packageDescription: "Livros e materiais de escritório",
    estimatedDistanceKm: 6.5,
    fareEstimate: 1900,
  },
];

// ─── DeliveryCard ─────────────────────────────────────────────────────────────

interface DeliveryCardProps {
  delivery: MockDelivery;
  onPress?: () => void;
}

function DeliveryCard({ delivery, onPress }: DeliveryCardProps) {
  const config = STATUS_CONFIG[delivery.status];
  const ariaLabel = `Entrega de ${delivery.pickup.address} para ${delivery.dropoff.address}, ${config.label}, ${formatBRL(delivery.fareEstimate)}`;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onPress && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onPress();
    }
  };

  return (
    <div
      role={onPress ? "button" : "article"}
      aria-label={ariaLabel}
      tabIndex={onPress ? 0 : undefined}
      onClick={onPress}
      onKeyDown={handleKeyDown}
      className={cn(
        "min-h-[80px] rounded-2xl border border-border bg-surface-2 px-4 py-3",
        "flex flex-col gap-2",
        onPress &&
          "cursor-pointer hover:border-electric/40 hover:bg-surface-3 transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      )}
    >
      {/* Top row: status + fare */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className={cn("h-2 w-2 rounded-full shrink-0", config.dotClass)}
            aria-hidden="true"
          />
          <span className={cn("text-xs font-semibold", config.labelClass)}>{config.label}</span>
        </div>
        <span className="text-sm font-bold text-neon tabular-nums">
          {formatBRL(delivery.fareEstimate)}
        </span>
      </div>

      {/* Addresses */}
      <div className="flex flex-col gap-0.5">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground/70">Coleta: </span>
          {delivery.pickup.address}
        </p>
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground/70">Entrega: </span>
          {delivery.dropoff.address}
        </p>
      </div>

      {/* Package description + distance badge */}
      <div className="flex items-end justify-between gap-2">
        <p className="text-xs text-muted-foreground truncate max-w-[60%]">
          {delivery.packageDescription.length > 50
            ? delivery.packageDescription.slice(0, 50) + "…"
            : delivery.packageDescription}
        </p>
        <span className="shrink-0 rounded-full border border-border bg-surface-3 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {delivery.estimatedDistanceKm.toFixed(1)} km
        </span>
      </div>
    </div>
  );
}

// ─── Fazer Pedido tab ─────────────────────────────────────────────────────────

function FazerPedidoTab() {
  const [pickupAddress, setPickupAddress] = React.useState("");
  const [pickupContact, setPickupContact] = React.useState("");
  const [dropoffAddress, setDropoffAddress] = React.useState("");
  const [dropoffContact, setDropoffContact] = React.useState("");
  const [packageDesc, setPackageDesc] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const bothAddressesFilled =
    pickupAddress.trim().length > 0 && dropoffAddress.trim().length > 0;

  // Mock estimate: R$6.00 base + R$2.00 × 6km = R$18.00 when both filled
  const fareEstimateCents = bothAddressesFilled ? 1800 : 0;

  const handleSubmit = async () => {
    if (!bothAddressesFilled) return;
    setIsSubmitting(true);
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {
      // native only
    }
    // Simulate brief async
    await new Promise((r) => setTimeout(r, 400));
    toast.success("Pedido enviado!", {
      description: "Estamos procurando um motoboy para sua entrega.",
    });
    // Reset form
    setPickupAddress("");
    setPickupContact("");
    setDropoffAddress("");
    setDropoffContact("");
    setPackageDesc("");
    setIsSubmitting(false);
  };

  const inputClass =
    "w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1";

  return (
    <div className="flex flex-col gap-4 pb-4">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <Package size={18} className="text-electric shrink-0" aria-hidden="true" />
        <h2 className="font-display font-bold text-base text-foreground">Nova entrega</h2>
      </div>

      {/* Address cards */}
      <div className="flex flex-col gap-3">
        {/* Pickup */}
        <div className="rounded-2xl border border-border bg-surface-2 px-4 py-3 flex flex-col gap-2.5">
          <div className="flex items-center gap-1.5">
            <MapPin size={14} className="text-electric shrink-0" aria-hidden="true" />
            <span className="text-xs font-semibold text-electric uppercase tracking-wider">
              Coleta
            </span>
          </div>
          <input
            type="text"
            value={pickupAddress}
            onChange={(e) => setPickupAddress(e.target.value)}
            aria-label="Endereço de coleta"
            placeholder="Endereço de coleta"
            className={inputClass}
          />
          <input
            type="text"
            value={pickupContact}
            onChange={(e) => setPickupContact(e.target.value)}
            aria-label="Nome do contato na coleta"
            placeholder="Nome do contato"
            className={inputClass}
          />
        </div>

        {/* Dropoff */}
        <div className="rounded-2xl border border-border bg-surface-2 px-4 py-3 flex flex-col gap-2.5">
          <div className="flex items-center gap-1.5">
            <MapPin size={14} className="text-neon shrink-0" aria-hidden="true" />
            <span className="text-xs font-semibold text-neon uppercase tracking-wider">
              Entrega
            </span>
          </div>
          <input
            type="text"
            value={dropoffAddress}
            onChange={(e) => setDropoffAddress(e.target.value)}
            aria-label="Endereço de entrega"
            placeholder="Endereço de entrega"
            className={inputClass}
          />
          <input
            type="text"
            value={dropoffContact}
            onChange={(e) => setDropoffContact(e.target.value)}
            aria-label="Nome do contato na entrega"
            placeholder="Nome do contato"
            className={inputClass}
          />
        </div>
      </div>

      {/* Package description */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="package-desc"
          className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
        >
          Descrição do pacote
        </label>
        <textarea
          id="package-desc"
          value={packageDesc}
          onChange={(e) => setPackageDesc(e.target.value.slice(0, 200))}
          aria-label="Descrição do pacote"
          placeholder="Descreva o conteúdo do pacote..."
          rows={3}
          maxLength={200}
          className={cn(inputClass, "resize-none")}
        />
        <p className="text-[10px] text-muted-foreground text-right" aria-live="polite">
          {packageDesc.length}/200
        </p>
      </div>

      {/* Fare estimate card */}
      <div
        className="rounded-2xl border border-neon/30 bg-neon/5 px-4 py-3 flex items-center justify-between"
        aria-live="polite"
        aria-label={`Estimativa de frete: ${fareEstimateCents > 0 ? formatBRL(fareEstimateCents) : "preencha os endereços"}`}
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Estimativa
          </span>
          <span
            className={cn(
              "font-display font-extrabold text-xl tabular-nums",
              fareEstimateCents > 0 ? "text-neon" : "text-muted-foreground",
            )}
          >
            {fareEstimateCents > 0 ? formatBRL(fareEstimateCents) : "R$ —"}
          </span>
        </div>
        {fareEstimateCents > 0 && (
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">~6 km estimado</p>
            <p className="text-[10px] text-muted-foreground">R$6,00 base + R$2,00/km</p>
          </div>
        )}
      </div>

      {/* Submit CTA */}
      <Button
        variant="electric"
        size="xl"
        className="w-full rounded-2xl"
        aria-label="Solicitar entrega"
        disabled={!bothAddressesFilled || isSubmitting}
        onClick={handleSubmit}
        aria-busy={isSubmitting}
      >
        {isSubmitting ? "Enviando..." : "Solicitar entrega"}
      </Button>
    </div>
  );
}

// ─── Meus Pedidos tab ─────────────────────────────────────────────────────────

function MeusPedidosTab() {
  const orders = MOCK_DELIVERIES;

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-2">
          <Package size={24} className="text-muted-foreground" aria-hidden="true" />
        </div>
        <p className="text-sm text-muted-foreground">Nenhum pedido encontrado</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pb-4" role="list" aria-label="Meus pedidos de entrega">
      {orders.map((delivery) => (
        <div key={delivery.id} role="listitem">
          <DeliveryCard delivery={delivery} />
        </div>
      ))}
    </div>
  );
}

// ─── EntregasScreen ───────────────────────────────────────────────────────────

export function EntregasScreen() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Screen header */}
      <div className="px-5 pt-4 pb-3 shrink-0">
        <h1 className="font-display font-bold text-lg text-foreground">Entregas &amp; Comércio</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Envie pacotes com motoboys parceiros
        </p>
      </div>

      {/* Tabs */}
      <div className="flex-1 overflow-hidden flex flex-col px-5">
        <Tabs defaultValue="fazer-pedido" className="flex flex-1 flex-col overflow-hidden">
          <TabsList className="w-full mb-3 shrink-0">
            <TabsTrigger value="fazer-pedido" className="flex-1">
              Fazer Pedido
            </TabsTrigger>
            <TabsTrigger value="meus-pedidos" className="flex-1">
              Meus Pedidos
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="fazer-pedido"
            className="flex-1 overflow-y-auto scrollbar-none"
          >
            <FazerPedidoTab />
          </TabsContent>

          <TabsContent
            value="meus-pedidos"
            className="flex-1 overflow-y-auto scrollbar-none"
          >
            <MeusPedidosTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
