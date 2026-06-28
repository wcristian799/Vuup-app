import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Zap } from "lucide-react";

// Foundation components
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";

// VUUP brand components
import { StatusBar } from "@/components/vuup/StatusBar";
import { EarningsCounter } from "@/components/vuup/EarningsCounter";
import { TripCard } from "@/components/vuup/TripCard";
import { PatronoCard } from "@/components/vuup/PatronoCard";
import { ShieldStatus } from "@/components/vuup/ShieldStatus";
import { ModeSliderCard } from "@/components/vuup/ModeSliderCard";
import { DriverDashboard } from "@/components/vuup/DriverDashboard";
import { DisputeCounterOfferPanel } from "@/components/vuup/DisputeCounterOfferPanel";
import { EntregasScreen } from "@/components/vuup/EntregasScreen";
import { DeliveryConfirmationPanel } from "@/components/vuup/DeliveryConfirmationPanel";

export const Route = createFileRoute("/gallery")({
  component: GalleryPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="font-display text-lg font-semibold text-muted-foreground uppercase tracking-widest mb-3 px-4">
        {title}
      </h2>
      {children}
    </section>
  );
}

function GalleryPage() {
  const [shieldState, setShieldState] = React.useState<"safe" | "warning" | "danger" | "off">(
    "safe",
  );
  const [supermarketMode, setSupermarketMode] = React.useState(false);
  const [earningsValue, setEarningsValue] = React.useState(24350);
  const [disputeOpen, setDisputeOpen] = React.useState(false);
  const [deliveryConfirmOpen, setDeliveryConfirmOpen] = React.useState(false);

  const COMMUNITY_MEMBERS = [
    { id: "m1", label: "Motorista A1", type: "driver" as const },
    { id: "m2", label: "Motorista B2", type: "driver" as const },
    { id: "m3", label: "Patrono C3", type: "patron" as const },
    { id: "m4", label: "Motorista D4", type: "driver" as const },
    { id: "m5", label: "Passageiro E5", type: "passenger" as const },
    { id: "m6", label: "Motorista F6", type: "driver" as const },
  ];

  return (
    <main
      className="relative mx-auto h-[100dvh] w-full max-w-[480px] overflow-hidden text-foreground"
      style={{ background: "var(--gradient-canvas)" }}
    >
      {/* Status bar */}
      <StatusBar />

      {/* Scrollable content */}
      <div className="absolute inset-0 pt-8 pb-4 overflow-y-auto">
        {/* Gallery header */}
        <div className="flex items-center gap-3 px-4 py-3 mb-2">
          <Link
            to="/"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-electric hover:border-electric transition-colors"
            aria-label="Voltar"
          >
            <ArrowLeft size={16} />
          </Link>
          <h1 className="font-display text-xl font-bold text-foreground">Galeria de Componentes</h1>
        </div>

        {/* ── WOW Interactions CTA ── */}
        <Section title="WOW Interactions">
          <div className="px-4">
            <Link
              to="/wow"
              className="flex items-center gap-3 rounded-2xl border border-electric/40 bg-electric/8 p-4 hover:bg-electric/12 transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Ver demonstração completa das WOW Interactions"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-electric/15 shrink-0">
                <Zap size={20} className="text-electric" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-electric">Abrir WOW Gallery</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Mapa Vivo · Matrix Slider · Escudo/Enxame · Supermarket · Patrono
                </p>
              </div>
              <span className="text-muted-foreground group-hover:text-electric transition-colors text-lg">
                →
              </span>
            </Link>
          </div>
        </Section>
        <Section title="Tokens de cor">
          <div className="grid grid-cols-4 gap-2 px-4">
            {[
              { name: "electric", bg: "bg-electric", label: "Electric" },
              { name: "neon", bg: "bg-neon", label: "Neon" },
              { name: "gold", bg: "bg-gold", label: "Gold" },
              { name: "danger", bg: "bg-danger", label: "Danger" },
              { name: "ice", bg: "bg-ice", label: "Ice" },
              { name: "surface", bg: "bg-surface", label: "Surface" },
              { name: "surface2", bg: "bg-surface-2", label: "Surface2" },
              { name: "surface3", bg: "bg-surface-3", label: "Surface3" },
            ].map(({ name, bg, label }) => (
              <div key={name} className="flex flex-col items-center gap-1">
                <div className={`h-10 w-full rounded-lg border border-border ${bg}`} />
                <span className="text-[9px] text-muted-foreground text-center leading-tight">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Buttons ── */}
        <Section title="Botões">
          <div className="flex flex-wrap gap-2 px-4">
            <Button variant="default" size="sm">
              Default
            </Button>
            <Button variant="electric" size="sm">
              Electric
            </Button>
            <Button variant="neon" size="sm">
              Neon
            </Button>
            <Button variant="outline" size="sm">
              Outline
            </Button>
            <Button variant="ghost" size="sm">
              Ghost
            </Button>
            <Button variant="destructive" size="sm">
              Danger
            </Button>
            <Button variant="secondary" size="sm">
              Secondary
            </Button>
          </div>
          <div className="flex gap-2 px-4 mt-2">
            <Button variant="electric" size="xl" className="flex-1">
              CTA Principal (xl)
            </Button>
          </div>
        </Section>

        {/* ── Badges ── */}
        <Section title="Badges">
          <div className="flex flex-wrap gap-2 px-4">
            <Badge>Default</Badge>
            <Badge variant="electric">Electric</Badge>
            <Badge variant="neon">Neon</Badge>
            <Badge variant="gold">Gold</Badge>
            <Badge variant="destructive">Perigo</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="secondary">Secondary</Badge>
          </div>
        </Section>

        {/* ── Earnings Counter ── */}
        <Section title="EarningsCounter">
          <div className="px-4 space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5 text-center">
              <p className="text-xs text-muted-foreground mb-2">Hero size · neon</p>
              <EarningsCounter value={earningsValue} size="hero" />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setEarningsValue((v) => v - 1000)}
              >
                −R$10
              </Button>
              <Button
                variant="electric"
                size="sm"
                className="flex-1"
                onClick={() => setEarningsValue((v) => v + 5000)}
              >
                +R$50
              </Button>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground mb-1">Large size · gold</p>
              <EarningsCounter value={124500} size="lg" colorClass="text-gold" />
            </div>
          </div>
        </Section>

        {/* ── Cards ── */}
        <Section title="Cards">
          <div className="px-4 space-y-3">
            <Card>
              <CardHeader>
                <CardTitle>Card padrão</CardTitle>
                <CardDescription>Subtítulo descritivo</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Conteúdo do card.</p>
              </CardContent>
              <CardFooter className="gap-2">
                <Button variant="outline" size="sm">
                  Cancelar
                </Button>
                <Button variant="electric" size="sm">
                  Confirmar
                </Button>
              </CardFooter>
            </Card>
            <Card className="card-electric">
              <CardContent className="pt-5">
                <p className="text-sm text-electric font-medium">Card electric</p>
              </CardContent>
            </Card>
            <Card className="card-gold">
              <CardContent className="pt-5">
                <p className="text-sm text-gold font-medium">Card gold (Patrono)</p>
              </CardContent>
            </Card>
          </div>
        </Section>

        {/* ── Progress ── */}
        <Section title="Progress">
          <div className="px-4 space-y-3">
            {(["default", "gold", "neon", "danger"] as const).map((v) => (
              <div key={v} className="space-y-1">
                <p className="text-xs text-muted-foreground capitalize">{v}</p>
                <Progress
                  value={68}
                  variant={v}
                  size="md"
                  role="progressbar"
                  aria-valuenow={68}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Progresso ${v}`}
                />
              </div>
            ))}
          </div>
        </Section>

        {/* ── Tabs ── */}
        <Section title="Tabs">
          <div className="px-4">
            <Tabs defaultValue="hoje">
              <TabsList>
                <TabsTrigger value="hoje">Hoje</TabsTrigger>
                <TabsTrigger value="semana">Semana</TabsTrigger>
                <TabsTrigger value="mes">Mês</TabsTrigger>
              </TabsList>
              <TabsContent value="hoje">
                <p className="text-sm text-muted-foreground pt-2">Dados de hoje</p>
              </TabsContent>
              <TabsContent value="semana">
                <p className="text-sm text-muted-foreground pt-2">Dados da semana</p>
              </TabsContent>
              <TabsContent value="mes">
                <p className="text-sm text-muted-foreground pt-2">Dados do mês</p>
              </TabsContent>
            </Tabs>
          </div>
        </Section>

        {/* ── Switch ── */}
        <Section title="Switch">
          <div className="px-4 space-y-3">
            <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
              <div>
                <p className="text-sm font-medium">Modo padrão</p>
                <p className="text-xs text-muted-foreground">Toggle electric</p>
              </div>
              <Switch variant="default" aria-label="Ativar modo padrão" defaultChecked />
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-gold/30 bg-card p-4">
              <div>
                <p className="text-sm font-medium text-gold">Modo supermarket</p>
                <p className="text-xs text-muted-foreground">Toggle gold</p>
              </div>
              <Switch
                variant="supermarket"
                aria-label="Ativar modo supermarket"
                checked={supermarketMode}
                onCheckedChange={setSupermarketMode}
              />
            </div>
          </div>
        </Section>

        {/* ── Avatars ── */}
        <Section title="Avatars">
          <div className="flex items-end gap-4 px-4">
            <div className="flex flex-col items-center gap-1">
              <Avatar size="sm" ring="none">
                <AvatarFallback variant="default">JD</AvatarFallback>
              </Avatar>
              <span className="text-[9px] text-muted-foreground">sm</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Avatar size="md" ring="electric">
                <AvatarFallback variant="driver">M1</AvatarFallback>
              </Avatar>
              <span className="text-[9px] text-muted-foreground">md·electric</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Avatar size="lg" ring="gold">
                <AvatarFallback variant="patron">P</AvatarFallback>
              </Avatar>
              <span className="text-[9px] text-muted-foreground">lg·gold</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Avatar size="xl" ring="neon">
                <AvatarImage
                  src="https://api.dicebear.com/9.x/initials/svg?seed=VUUP"
                  alt="VUUP avatar"
                />
                <AvatarFallback>VU</AvatarFallback>
              </Avatar>
              <span className="text-[9px] text-muted-foreground">xl·neon</span>
            </div>
          </div>
        </Section>

        {/* ── TripCard ── */}
        <Section title="TripCard">
          <div className="px-4 space-y-2">
            <TripCard
              origin="Av. Paulista, 1578"
              destination="Aeroporto de Congonhas"
              fare={3450}
              duration={22}
              status="active"
              onPress={() => {}}
            />
            <TripCard
              origin="Shopping Eldorado"
              destination="Estação Consolação"
              fare={1280}
              duration={8}
              status="completed"
            />
            <TripCard
              origin="Centro"
              destination="Zona Sul"
              fare={4200}
              duration={35}
              status="pending"
            />
            <TripCard
              origin="Terminal Barra Funda"
              destination="Butantã"
              fare={1850}
              duration={14}
              status="cancelled"
            />
          </div>
        </Section>

        {/* ── PatronoCard ── */}
        <Section title="PatronoCard">
          <div className="px-4 space-y-3">
            <PatronoCard
              tier="ouro"
              monthlyEarnings={1245000}
              goalAmount={1800000}
              progressPercent={69}
              onViewBenefits={() => {}}
            />
            <PatronoCard
              tier="diamante"
              monthlyEarnings={3180000}
              goalAmount={4000000}
              progressPercent={79}
            />
          </div>
        </Section>

        {/* ── ModeSliderCard ── */}
        <Section title="ModeSliderCard (Matrix)">
          <div
            className="flex gap-3 overflow-x-auto px-4 scrollbar-none"
            style={{ scrollSnapType: "x mandatory" }}
          >
            {(["hourly", "daily", "weekly", "monthly"] as const).map((mode, i) => (
              <ModeSliderCard
                key={mode}
                mode={mode}
                projectedEarning={[8000, 48000, 280000, 1200000][i]}
                actualEarning={[6200, 31500, 198000, 876000][i]}
                tripCount={[8, 22, 110, 445][i]}
                isActive={i === 1}
              />
            ))}
          </div>
        </Section>

        {/* ── ShieldStatus ── */}
        <Section title="ShieldStatus">
          <div className="px-4 space-y-3">
            <div className="flex gap-2 flex-wrap">
              {(["safe", "warning", "danger", "off"] as const).map((s) => (
                <Button
                  key={s}
                  variant={shieldState === s ? "electric" : "outline"}
                  size="sm"
                  onClick={() => setShieldState(s)}
                  className="capitalize"
                >
                  {s}
                </Button>
              ))}
            </div>
            <div className="rounded-2xl border border-border bg-card py-6 flex justify-center">
              <ShieldStatus
                state={shieldState}
                communityCount={COMMUNITY_MEMBERS.length}
                communityMembers={COMMUNITY_MEMBERS}
                onSOSPress={() => alert("SOS acionado!")}
              />
            </div>
          </div>
        </Section>

        {/* ── Dialog ── */}
        <Section title="Dialog e Sheet">
          <div className="flex gap-2 px-4">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1">
                  Abrir Dialog
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirmação de viagem</DialogTitle>
                  <DialogDescription>
                    Você confirma o aceite desta corrida de R$ 34,50?
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" size="sm">
                    Recusar
                  </Button>
                  <Button variant="electric" size="sm">
                    Aceitar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1">
                  Abrir Sheet
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Detalhes da corrida</SheetTitle>
                  <SheetDescription>Av. Paulista → Aeroporto · 22 min · R$ 34,50</SheetDescription>
                </SheetHeader>
                <div className="px-5 pt-4 pb-6">
                  <TripCard
                    origin="Av. Paulista, 1578"
                    destination="Aeroporto de Congonhas"
                    fare={3450}
                    duration={22}
                    status="active"
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </Section>

        {/* ── DisputeCounterOfferPanel ── */}
        <Section title="DisputeCounterOfferPanel">
          <div className="px-4">
            <p className="text-xs text-muted-foreground mb-3">
              Bottom-sheet de contra-oferta em tempo real (disputa de corrida).
              ARIA completo: role=dialog, aria-modal, focus trap, Escape to close.
            </p>
            <Button
              variant="electric"
              size="sm"
              onClick={() => setDisputeOpen(true)}
              aria-label="Demonstrar painel de disputa de corrida"
            >
              Abrir painel de disputa
            </Button>
          </div>
        </Section>

        {/* ── DriverDashboard ── */}
        <Section title="DriverDashboard (tela completa)">
          <div className="px-4">
            <p className="text-xs text-muted-foreground mb-3">
              Dashboard do motorista/fundador — visível na aba "Perfil" do app principal.
            </p>
            <div className="rounded-2xl border border-border bg-surface-2 overflow-hidden" style={{ maxHeight: 480 }}>
              <div className="overflow-y-auto h-[480px]">
                <DriverDashboard isPatrono={true} tier="ouro" />
              </div>
            </div>
          </div>
        </Section>

        {/* ── EntregasScreen ── */}
        <Section title="EntregasScreen (Entregas & Comércio)">
          <div className="px-4">
            <p className="text-xs text-muted-foreground mb-3">
              Tela de entregas — aba "Entregas" do app. Dois sub-tabs: pedido novo e lista.
            </p>
            <div className="rounded-2xl border border-border bg-surface-2 overflow-hidden" style={{ maxHeight: 520 }}>
              <div className="overflow-y-auto h-[520px]">
                <EntregasScreen />
              </div>
            </div>
          </div>
        </Section>

        {/* ── DeliveryConfirmationPanel ── */}
        <Section title="DeliveryConfirmationPanel">
          <div className="px-4">
            <p className="text-xs text-muted-foreground mb-3">
              Bottom-sheet de confirmação de entrega (motoboy). ARIA completo: role=dialog,
              aria-modal, focus trap, Escape to close. Labels ARIA no botão de confirmação.
            </p>
            <Button
              variant="neon"
              size="sm"
              onClick={() => setDeliveryConfirmOpen(true)}
              aria-label="Demonstrar painel de confirmação de entrega"
            >
              Abrir confirmação de entrega
            </Button>
          </div>
        </Section>

        <div className="h-8" />
      </div>

      {/* ── DriverDashboard full screen ── rendered outside scroll for demo */}

      {/* ── DisputeCounterOfferPanel ── */}
      <DisputeCounterOfferPanel
        open={disputeOpen}
        rideId="demo-ride-001"
        passengerOffer={2400}
        currentBid={2200}
        driversInDispute={3}
        windowRemainingMs={12000}
        onSubmitOffer={(amount) => {
          // eslint-disable-next-line no-console
          console.log("Offer submitted:", amount);
          setDisputeOpen(false);
        }}
        onClose={() => setDisputeOpen(false)}
      />

      {/* ── DeliveryConfirmationPanel ── */}
      <DeliveryConfirmationPanel
        open={deliveryConfirmOpen}
        delivery={{
          id: "demo-delivery-001",
          dropoff: { address: "Rua Augusta, 1200 — Consolação", contactName: "João Silva" },
          packageDescription: "Caixa frágil — eletrônicos",
          fareActual: 2400,
        }}
        onConfirm={() => setDeliveryConfirmOpen(false)}
        onClose={() => setDeliveryConfirmOpen(false)}
      />
    </main>
  );
}
