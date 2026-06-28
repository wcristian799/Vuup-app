/**
 * VUUP Component Library — documented specs
 *
 * This file defines the component inventory, variant contracts,
 * accessibility requirements, and token usage for each component.
 *
 * Organized by:
 *   1. Foundation components (primitives from shadcn/ui + Radix)
 *   2. VUUP brand components (purpose-built, non-generic)
 *   3. Layout components (structural shells)
 *
 * All components use Tailwind v4 CSS variables and the tokens
 * defined in ./tokens.ts.
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. FOUNDATION COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Button — src/components/ui/button.tsx
 * ─────────────────────────────────────
 * Extends shadcn/ui Button with two VUUP-specific variants.
 *
 * Variants:
 *   default    – bg: primary, text: primaryFg
 *   destructive– bg: destructive, text: destructiveFg
 *   outline    – border: input, bg: background, hover: accent
 *   secondary  – bg: secondary, text: secondaryFg
 *   ghost      – hover: accent, no background
 *   link       – text: primary, underline on hover
 *   electric   – bg: electric, text: primaryFg, text-shadow glow  ← VUUP
 *   neon       – bg: neon, text: background, font-semibold         ← VUUP
 *
 * Sizes:
 *   sm  – h:32px, px:12px, text:xs
 *   default – h:36px, px:16px, text:sm
 *   lg  – h:40px, px:32px
 *   xl  – h:48px, px:40px, text:base  (primary CTA — meets tapTarget.preferred)
 *   icon– h:36px w:36px
 *
 * Accessibility:
 *   - Focus ring: 1px solid ring, offset 1px (from shadcn base)
 *   - Disabled: pointer-events-none, opacity:50%
 *   - Loading state: add aria-busy="true", spinner via aria-hidden icon
 *   - Min tap target for xl: 48px ✅ — use xl for primary mobile CTAs
 *   - Icon-only buttons (size:icon) MUST have aria-label
 */

/**
 * Badge
 * ─────
 * Usage: status pills, tier labels, count indicators
 *
 * Variants:
 *   default    – bg: primary, text: primaryFg
 *   secondary  – bg: secondary, text: secondaryFg
 *   destructive– bg: destructive, text: destructiveFg
 *   outline    – border only
 *   neon       – bg: neon/20, text: neon, border: neon/40     ← VUUP (earnings)
 *   gold       – bg: gold/20, text: gold, border: gold/40     ← VUUP (patrono)
 *   electric   – bg: electric/20, text: electric, border: electric/40 ← VUUP
 *
 * Spec:
 *   - Radius: radius.full (pill)
 *   - Padding: 2px 8px (text:xs)
 *   - Font: fontWeight.semibold
 *   - No min tap target required (informational only — not interactive)
 *   - If interactive (clickable badge/filter): min 32px height, add role="button"
 */

/**
 * Card
 * ────
 * Usage: trip summaries, earnings summaries, driver info, system notices
 *
 * Structure:
 *   <Card>           — outer container
 *     <CardHeader>   — title row (optional)
 *     <CardContent>  — main body
 *     <CardFooter>   — action row (optional)
 *   </Card>
 *
 * Token usage:
 *   - Background: card (oklch 0.18 0.02 260)
 *   - Foreground: card-foreground
 *   - Border: 1px solid border
 *   - Radius: radius.lg (16px) default
 *
 * VUUP variants (to be added as className):
 *   card-electric  – border: electric/40, shadow: electric
 *   card-neon      – border: neon/40, shadow: neon
 *   card-gold      – border: gold/40, shadow: gold, top-border: 2px gold
 *   card-danger    – border: danger/50, shadow: danger
 *
 * Accessibility:
 *   - Static cards: no special role needed
 *   - Clickable cards: role="button" or wrap in <a>/<button>
 *   - Interactive cards: min tap target 48px height, focus ring required
 */

/**
 * Progress
 * ────────
 * Usage: earnings goal progress (Patrono cards), trip completion, loading
 *
 * Spec:
 *   - Track: background surface3, radius full
 *   - Fill: gradient goldFade (Patrono) / electricFade (default)
 *   - Heights: sm:4px, md:6px, lg:8px
 *   - Animation: width transition duration:dramatic, easing:decelerate
 *   - Indeterminate: sliding shimmer (electricFade moving left→right)
 *
 * Accessibility:
 *   - role="progressbar"
 *   - aria-valuenow, aria-valuemin="0", aria-valuemax="100"
 *   - aria-label describing the metric (e.g. "Progresso para meta de ganhos")
 *   - If indeterminate: aria-valuenow omitted, add aria-label with context
 */

/**
 * Switch (Radix UI)
 * ─────────────────
 * Usage: Supermarket mode toggle, notification preferences, settings
 *
 * Spec:
 *   - Track size: 48×28px
 *   - Thumb size: 24×24px
 *   - On state: track bg gold/40, thumb bg gold
 *   - Off state: track bg surface2, thumb bg surface3
 *   - Default (non-supermarket): on=electric, off=surface2/surface3
 *   - Transition: thumb translate, duration:normal (200ms)
 *
 * Accessibility:
 *   - role="switch" (Radix provides)
 *   - aria-checked, aria-label required
 *   - Keyboard: Space toggles (Radix provides)
 *   - Focus ring: 2px solid ring, offset 2px
 */

/**
 * Tabs (Radix UI)
 * ───────────────
 * Two usages in VUUP:
 *   A) Bottom tab bar (main navigation — custom implementation)
 *   B) In-page tabs (e.g. Cockpit: Hoje / Semana / Mês)
 *
 * Bottom tab bar spec:
 *   - Height: 80px (spacing[20])
 *   - 5 tabs, equal width (flex-1)
 *   - Background: card/80, backdrop-blur: 16px
 *   - Border-top: 1px solid border
 *   - Active tab: icon + label color electric; add 2px electric underline above icon
 *   - Inactive: color mutedFg
 *   - Icon size: 22px
 *   - Label: fontSize["2xs"] (10px), fontWeight.medium
 *   - Min tap target per tab: 48px height (meets preferred) — the full 80px
 *     container minus the label means the touch zone is ample ✅
 *
 * In-page tabs spec:
 *   - Trigger: pill shape (radius.full), 32px height min
 *   - Active: bg electric, text primaryFg
 *   - Inactive: text mutedFg, hover bg surface3
 *   - Container: horizontal scroll if overflow (no wrapping)
 *
 * Accessibility:
 *   - role="tablist", role="tab", role="tabpanel" (Radix provides)
 *   - aria-selected, aria-controls (Radix provides)
 *   - Bottom bar: aria-label="Navegação principal" on <nav>
 *   - Each tab: aria-label includes the tab name
 */

/**
 * Avatar
 * ──────
 * Usage: driver profile, passenger card, community dot popups
 *
 * Sizes:
 *   sm  – 32×32px
 *   md  – 40×40px (default, meets tapTarget.comfort)
 *   lg  – 56×56px
 *   xl  – 80×80px
 *
 * Fallback: initials (2 chars) in fontWeight.semibold
 *   - Background: electric/20 (driver) / gold/20 (patrono) / surface3 (default)
 *
 * Patrono ring: 2px gold border + shadow.gold
 * Active ring:  2px neon border (currently online / on trip)
 *
 * Accessibility:
 *   - alt text or aria-label required
 *   - Decorative avatars: aria-hidden="true"
 */

/**
 * Dialog / Sheet (Radix UI)
 * ─────────────────────────
 * Usage: trip details, driver info, SOS confirmation, onboarding steps
 *
 * Dialog:
 *   - Backdrop: black/60 blur-sm
 *   - Panel: bg card, border 1px solid border, radius radius["2xl"]
 *   - Max width: 440px (fits within 480px shell with 20px margins)
 *   - Shadow: shadow.xl
 *
 * Sheet (bottom):
 *   - Slides from bottom (translateY)
 *   - Handle: 32×4px, bg border, radius full, centered
 *   - Max height: 90dvh
 *   - Safe area padding at bottom (env(safe-area-inset-bottom))
 *
 * Accessibility:
 *   - role="dialog", aria-modal="true"
 *   - aria-labelledby pointing to dialog title
 *   - Focus trap inside (Radix provides)
 *   - Escape closes (Radix provides)
 *   - Close button: aria-label="Fechar"
 */

// ─────────────────────────────────────────────────────────────────────────────
// 2. VUUP BRAND COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * EarningsCounter  (new — src/components/vuup/EarningsCounter.tsx)
 * ─────────────────────────────────────────────────────────────────
 * Animated rolling number display for monetary values.
 *
 * Props:
 *   value: number        – current value in BRL cents
 *   currency?: string    – default "R$"
 *   size?: "lg"|"hero"   – "hero" = fontSize["5xl"], "lg" = fontSize["3xl"]
 *   color?: ColorToken   – default "neon"
 *   animateOnMount?: boolean – default true
 *
 * Implementation:
 *   - Use Motion useMotionValue + animate() for smooth number transitions
 *   - Each digit column animates vertically (translateY) on value change
 *   - aria-live="polite"
 *   - aria-label="Ganhos: R$ [formatted value]"
 *   - Respects prefers-reduced-motion (instant update if reduce)
 */

/**
 * VehicleMarker  (new — src/components/vuup/VehicleMarker.tsx)
 * ──────────────────────────────────────────────────────────────
 * Leaflet custom marker for real-time vehicle position.
 *
 * Props:
 *   driverId: string
 *   position: [lat, lng]
 *   status: "active"|"idle"|"on_trip"
 *   label: string        – screen-reader label ("Motorista [anonymized]")
 *
 * Visual:
 *   active   – electric border, pulsing (see MapaVivoSpec)
 *   idle     – surface3 border, no animation
 *   on_trip  – neon border, no pulse (steady)
 *
 * Implementation note:
 *   Use ReactDOM.createPortal or Leaflet DivIcon for React rendering.
 *   The marker div must have tabIndex={0} for keyboard map navigation.
 */

/**
 * TripCard  (new — src/components/vuup/TripCard.tsx)
 * ───────────────────────────────────────────────────
 * Summary card shown in the map bottom panel and history lists.
 *
 * Props:
 *   origin: string
 *   destination: string
 *   fare: number         – BRL cents
 *   duration: number     – minutes
 *   status: "pending"|"active"|"completed"|"cancelled"
 *   onPress?: () => void
 *
 * Layout:
 *   Left column: origin → destination (route line SVG, 2px, electric)
 *   Right column: fare (neon, fontWeight.bold), duration (mutedFg, sm)
 *   Status badge: bottom-right corner
 *
 * Accessibility:
 *   - role="article" when in a list
 *   - aria-label includes origin, destination, fare, status
 *   - Keyboard: Enter/Space triggers onPress
 *   - Min height: 72px (comfortable tap)
 */

/**
 * PatronoCard  (new — src/components/vuup/PatronoCard.tsx)
 * ──────────────────────────────────────────────────────────
 * Full spec in wow-specs.ts PatronoCardSpec.
 * This entry documents the component API shape.
 *
 * Props:
 *   tier: "prata"|"ouro"|"diamante"
 *   monthlyEarnings: number   – BRL cents
 *   goalAmount: number        – BRL cents
 *   progressPercent: number   – 0–100
 *   onViewBenefits?: () => void
 */

/**
 * ShieldStatus  (new — src/components/vuup/ShieldStatus.tsx)
 * ─────────────────────────────────────────────────────────
 * Full spec in wow-specs.ts ShieldEnxameSpec.
 *
 * Props:
 *   state: ShieldState        – "safe"|"warning"|"danger"|"off"
 *   communityCount: number
 *   onSOSPress?: () => void
 */

/**
 * ModeSliderCard  (new — src/components/vuup/ModeSliderCard.tsx)
 * ──────────────────────────────────────────────────────────────
 * Single card in the Matrix snap-scroll slider.
 *
 * Props:
 *   mode: "hourly"|"daily"|"weekly"|"monthly"
 *   projectedEarning: number  – BRL cents
 *   actualEarning: number     – BRL cents
 *   tripCount: number
 *   isActive: boolean
 */

// ─────────────────────────────────────────────────────────────────────────────
// 3. LAYOUT COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * AppShell  (src/routes/__root.tsx wraps this pattern)
 * ──────────────────────────────────────────────────────
 * The outer shell for all screens.
 *
 * Structure:
 *   <main
 *     className="relative mx-auto h-[100dvh] w-full max-w-[480px] overflow-hidden"
 *     style={{ background: gradient.canvas }}
 *   >
 *     <StatusBar />      — h:32px, top
 *     <ScreenContent />  — absolute inset-0 pt-8 pb-20
 *     <BottomTabBar />   — absolute bottom-0, h:80px
 *   </main>
 *
 * Responsive:
 *   - max-w-[480px] centers on tablet/desktop — treat as a phone shell
 *   - No horizontal scroll; vertical scroll per tab content
 *
 * Safe area:
 *   - Add pb-[env(safe-area-inset-bottom)] to BottomTabBar for notch devices
 *   - Add pt-[env(safe-area-inset-top)] to StatusBar for dynamic island
 */

/**
 * StatusBar  (src/components/vuup/StatusBar.tsx)
 * ──────────────────────────────────────────────
 * Top bar simulating mobile system UI.
 *
 * Layout: h:32px, px:16px, flex justify-between items-center
 * Left:  "VUUP" logotype — font.display, fontSize.sm, fontWeight.bold, color electric
 * Right: clock — font.mono, fontSize.xs, color mutedFg
 *
 * Accessibility:
 *   - aria-hidden="true" (decorative — system status is handled by the OS)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Export: component inventory list for documentation tooling
// ─────────────────────────────────────────────────────────────────────────────

export const componentInventory = [
  // Foundation (shadcn/ui + Radix)
  { name: "Button", path: "src/components/ui/button.tsx", status: "implemented" },
  { name: "Badge", path: "src/components/ui/badge.tsx", status: "pending" },
  { name: "Card", path: "src/components/ui/card.tsx", status: "pending" },
  { name: "Progress", path: "src/components/ui/progress.tsx", status: "pending" },
  { name: "Switch", path: "src/components/ui/switch.tsx", status: "pending" },
  { name: "Tabs", path: "src/components/ui/tabs.tsx", status: "pending" },
  { name: "Avatar", path: "src/components/ui/avatar.tsx", status: "pending" },
  { name: "Dialog", path: "src/components/ui/dialog.tsx", status: "pending" },
  { name: "Sheet", path: "src/components/ui/sheet.tsx", status: "pending" },
  { name: "Sonner", path: "src/components/ui/sonner.tsx", status: "implemented" },
  // VUUP brand
  { name: "EarningsCounter", path: "src/components/vuup/EarningsCounter.tsx", status: "specced" },
  { name: "VehicleMarker", path: "src/components/vuup/VehicleMarker.tsx", status: "specced" },
  { name: "TripCard", path: "src/components/vuup/TripCard.tsx", status: "specced" },
  { name: "PatronoCard", path: "src/components/vuup/PatronoCard.tsx", status: "specced" },
  { name: "ShieldStatus", path: "src/components/vuup/ShieldStatus.tsx", status: "specced" },
  { name: "ModeSliderCard", path: "src/components/vuup/ModeSliderCard.tsx", status: "specced" },
  { name: "DriverDashboard", path: "src/components/vuup/DriverDashboard.tsx", status: "implemented" },
  { name: "ScreenTransition", path: "src/components/vuup/ScreenTransition.tsx", status: "implemented" },
  { name: "DisputeCounterOfferPanel", path: "src/components/vuup/DisputeCounterOfferPanel.tsx", status: "implemented" },
  { name: "EntregasScreen", path: "src/components/vuup/EntregasScreen.tsx", status: "implemented" },
  { name: "DeliveryConfirmationPanel", path: "src/components/vuup/DeliveryConfirmationPanel.tsx", status: "implemented" },
  // Layout
  { name: "AppShell", path: "src/routes/__root.tsx (pattern)", status: "implemented" },
  { name: "StatusBar", path: "src/components/vuup/StatusBar.tsx", status: "implemented" },
] as const;

export type ComponentStatus = "implemented" | "pending" | "specced";
