/**
 * VUUP WOW Interaction Specs
 *
 * Implementable specs for the five signature interactions.
 * Each spec includes: purpose, motion choreography, token usage,
 * component API shape, and WCAG accessibility notes.
 *
 * These are design-layer specs consumed by the Founding Engineer
 * during VUU-3/VUU-4/VUU-5 implementation.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { color, duration, easing, shadow, tapTarget } from "./tokens";

// ─────────────────────────────────────────────────────────────────────────────
// 1. MAPA VIVO  (Live Map — "Mapa" tab)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Purpose: Real-time ride map with animated vehicle markers, demand heatmap,
 *          and floating action panels. The map IS the experience — everything
 *          else is overlaid on Leaflet.
 *
 * Layout
 * ──────
 * - Full bleed Leaflet map fills the safe area (below status bar, above tab bar)
 * - Custom dark tile style: CartoDB Dark Matter or self-hosted Mapbox style
 * - Overlay stack (z-index ascending):
 *     z:10  Demand heatmap layer (canvas)
 *     z:20  Vehicle markers
 *     z:30  Floating info panel (bottom sheet, slides up 280px)
 *     z:40  FAB cluster (top-right: re-center, filter)
 *
 * Vehicle Marker Spec
 * ───────────────────
 * - Size: 40×40px (meets tapTarget.preferred)
 * - Shape: circle with 2px electric border
 * - Background: surface2, border: electric on active / surface3 on idle
 * - Pulse animation (active driver):
 *     keyframes: opacity 1→0.3→1, scale 1→1.15→1
 *     duration: 2000ms, repeat: infinity, easing: ease-in-out
 * - Icon: 20px vehicle SVG, color: electric (active) / mutedFg (idle)
 * - Accessibility: aria-label="Motorista ativo — [name]", role="button"
 *   Keyboard: focusable, Enter/Space opens driver card
 *
 * Demand Heatmap Spec
 * ───────────────────
 * - Rendered on a Canvas overlay using Leaflet.heat or custom WebGL
 * - Hot spots: gradient.heatmap radial (danger color at center)
 * - Medium demand: gold color at 60% opacity
 * - Cool areas: electric at 30% opacity
 * - Opacity: 0.65 overall — map tiles must remain legible beneath
 * - Updates: smooth morph every 30s (opacity cross-fade 500ms)
 *
 * Floating Bottom Panel Spec
 * ──────────────────────────
 * Entry: translateY(100%) → translateY(0), duration: slow (350ms), easing: decelerate
 * Exit:  translateY(0) → translateY(100%), duration: normal (200ms), easing: accelerate
 * Content: driver card or trip summary
 * Handle: 32×4px pill, color border, centered, drag-to-dismiss supported
 * Background: card/80 backdrop-blur(16px)
 * Border: 1px solid border, radius xl (top corners only, 20px)
 * Shadow: shadow.lg
 * Min height: 180px | Max height: 320px
 *
 * FAB Spec
 * ────────
 * - Size: 48×48px (tapTarget.preferred)
 * - Shape: radius.full (circle)
 * - Re-center: background surface2, icon electric color, shadow.electric on press
 * - Filter: background electric, icon white — drops to surface2 when filter active
 * - Entry: scale(0)→scale(1) with easing.bouncy, staggered 80ms
 * - WCAG: aria-label required ("Re-centrar mapa", "Filtrar motoristas")
 *         focus ring: 2px solid ring, offset 2px
 */
export const MapaVivoSpec = {
  markerSize:          40,
  markerActivePulse:   { duration: 2000, repeatType: "loop" as const },
  panelEntryDuration:  duration.slow,
  panelExitDuration:   duration.normal,
  fabSize:             48,
  heatmapOverallAlpha: 0.65,
  heatmapUpdateFade:   500,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// 2. MATRIX SLIDER  (Economic dashboard — "Matrix" tab)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Purpose: Gamified earnings dashboard. The "matrix" metaphor = cascading
 *          numbers / data flow. The slider is a horizontal snap-scroll through
 *          economic mode cards (hourly, daily, weekly, monthly projections).
 *
 * Layout
 * ──────
 * - Full-height scrollable column inside the 480px container
 * - Top: Hero earnings counter (animated number roll)
 * - Middle: Horizontal snap-scroll slider — one card per mode
 * - Bottom: sparkline chart + recent trips list
 *
 * Hero Earnings Counter
 * ─────────────────────
 * - Value animates with Motion's useMotionValue + animate()
 * - Font: font.display, fontSize["5xl"], fontWeight.extrabold, color neon
 * - Shadow: shadow.neon
 * - Text shadow: 0 0 20px neonGlow
 * - On value change: increment/decrement rolls (each digit animates vertically)
 * - aria-live="polite", aria-label="Ganhos hoje: R$ [value]"
 *
 * Mode Card Spec (snap-scroll slider)
 * ────────────────────────────────────
 * Container:
 *   - display: flex, overflow-x: scroll, scroll-snap-type: x mandatory
 *   - scrollbar-width: none (hidden scrollbar, keyboard arrows still work)
 *   - gap: 12px (spacing[3]), padding: 0 16px
 *   - Keyboard: arrow keys scroll via JS (scrollIntoView on focusedCard)
 *
 * Each card:
 *   - Width: calc(100% - 48px) — peek 24px of next card each side
 *   - scroll-snap-align: center
 *   - min-height: 180px
 *   - Background: surface2, border: 1px solid border
 *   - Radius: radius["2xl"] (24px)
 *   - Active card: border-color electric, shadow.electric
 *   - Entry animation (on first render): each card fades in with
 *     initial={{ opacity:0, y:20 }}, animate={{ opacity:1, y:0 }}
 *     stagger: index * 80ms, duration: slow
 *   - Accessible: role="group", aria-label="Modo [hourly/daily/weekly/monthly]"
 *
 * Cascading number rain (background decoration)
 * ─────────────────────────────────────────────
 * - Canvas element behind the card slider (z:-1)
 * - Random digits (0–9) fall in columns at varying speeds (800–1600ms per cycle)
 * - Color: electric at 15% opacity — purely decorative, aria-hidden="true"
 * - Paused if prefers-reduced-motion
 *
 * Sparkline Chart
 * ───────────────
 * - 7-day earnings line chart (no library — SVG path generated from data)
 * - Line: stroke electric, strokeWidth 2, smooth cubic bezier
 * - Area fill: gradient electric 0.15→0 opacity
 * - Data points: 6px circles, fill electric on hover/focus
 * - Accessible: role="img", aria-label="Gráfico de ganhos dos últimos 7 dias"
 *               <title> and <desc> elements inside SVG
 */
export const MatrixSliderSpec = {
  cardPeekWidth:       24,   // px each side
  cardMinHeight:       180,  // px
  cardStaggerMs:       80,
  numberRainOpacity:   0.15,
  numberRainSpeedMs:   { min: 800, max: 1600 },
  respectReducedMotion: true,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// 3. SHIELD / ENXAME  (Community safety — "Escudo" tab)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Purpose: Safety net visualization. "Escudo" (shield) = protected status.
 *          "Enxame" (swarm) = nearby community members forming a coverage mesh.
 *
 * Layout
 * ──────
 * - Dark full-bleed background (background color)
 * - Central shield graphic (SVG, animated)
 * - Surrounding swarm dots (community members in range)
 * - Bottom: status bar + panic button
 *
 * Shield SVG Animation
 * ─────────────────────
 * States: safe | warning | danger | off
 *
 * safe:
 *   - Shield stroke: electric, fill: electric/10
 *   - Continuous subtle pulse: scale 1→1.04→1, duration 3000ms, loop
 *   - Inner glow: shadow.electric (drop-shadow filter)
 *
 * warning:
 *   - Shield stroke: gold, fill: gold/10
 *   - Faster pulse: scale 1→1.06→1, duration 1500ms, loop
 *   - Badge overlay: exclamation icon, color gold
 *
 * danger:
 *   - Shield stroke: danger, fill: danger/15
 *   - Rapid strobe: opacity 1→0.6→1, duration 600ms, loop
 *   - Outer ring: danger halo, radius growing 60px→90px→60px
 *   - Haptic hint annotation: "trigger navigator.vibrate([200,100,200])"
 *
 * off:
 *   - Shield stroke: mutedFg, fill: none
 *   - No animation
 *
 * State transitions: all use duration.dramatic (600ms), easing.standard
 * aria-live="assertive" on the status region for danger state changes
 *
 * Enxame Dots
 * ───────────
 * - Each community member = a dot, 10px diameter
 * - Positioned radially around the center shield (random angle, 100–180px radius)
 * - Color: electric (verified driver), gold (patrono), ice (passenger)
 * - Float animation: each dot moves ±6px on y-axis, duration random 2–4s, loop
 * - On hover/focus: scale 1→1.4, show tooltip with anonymized label ("Motorista C3")
 * - Connection lines: SVG paths from dots to center, opacity 0.15, stroke electric
 * - Max visible: 12 dots (performance cap); "+N mais" label if overflow
 * - aria-label on the container: "[N] membros da comunidade próximos"
 *
 * Panic Button
 * ────────────
 * - Size: 64×64px (oversize for emergency use)
 * - Shape: radius.full, background danger, shadow.danger
 * - Label: "SOS", font.display, fontWeight.bold, fontSize.xl, color white
 * - Press: scale(0.92) with bouncy spring, duration fast
 * - Hold (500ms): triggers confirm dialog before sending alert
 * - WCAG: aria-label="Acionar alerta de emergência SOS"
 *         Needs visible focus ring: 3px solid dangerGlow, offset 3px
 */
export const ShieldEnxameSpec = {
  shieldStates:        ["safe", "warning", "danger", "off"] as const,
  safeAnimDuration:    3000,
  warningAnimDuration: 1500,
  dangerStrobeDuration:600,
  enxameDotSize:       10,
  enxameRadiusMin:     100,
  enxameRadiusMax:     180,
  enxameMaxVisible:    12,
  panicButtonSize:     64,
  panicHoldMs:         500,
} as const;

export type ShieldState = typeof ShieldEnxameSpec.shieldStates[number];

// ─────────────────────────────────────────────────────────────────────────────
// 4. SUPERMARKET MODE  (Cockpit tab — passive income / subscription layer)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Purpose: "Supermarket mode" = VUUP's passive income / marketplace layer.
 *          When activated, the driver's app transforms visually to signal they
 *          are in a low-effort earnings state (parked, delivering, waiting).
 *          The UI shifts from "active hustle" (electric blue) to "passive gold".
 *
 * Activation Transition
 * ─────────────────────
 * Trigger: toggle switch in Cockpit header
 *
 * Phase 1 — Ripple reveal (0–400ms):
 *   - Circular ripple from toggle origin, expands to fill screen
 *   - Ripple fill: gold/20 tinted overlay
 *   - Duration: 400ms, easing: decelerate
 *
 * Phase 2 — Token swap (400–700ms):
 *   - CSS class "supermarket-mode" added to root
 *   - --primary swaps to gold value
 *   - --ring swaps to gold value
 *   - All electric-colored elements cross-fade to gold (300ms)
 *
 * Phase 3 — Content reveal (600–900ms):
 *   - Supermarket earning cards slide up from below (translateY: 40px→0)
 *   - Each card staggered 60ms, duration: slow (350ms)
 *
 * Deactivation: reverse — Phase 3 exit → Phase 1 ripple collapse
 *
 * Supermarket Earning Card
 * ─────────────────────────
 * - Background: surface2, border: 1px solid gold/30
 * - Left accent bar: 3px solid gold
 * - Icon: category icon (grocery, delivery, etc.), color gold
 * - Title: fontSize.xl, fontWeight.semibold, color foreground
 * - Earnings badge: fontSize.lg, fontWeight.bold, color neon
 *   (neon = earnings signal regardless of mode)
 * - Status pill: "Ativo" (neon) / "Pausado" (mutedFg)
 * - Radius: radius.xl (20px)
 * - WCAG: each card has role="article", aria-label includes name + earnings
 *
 * Toggle Switch
 * ─────────────
 * - Radix UI Switch component (already in deps)
 * - Thumb: gold when on, surface3 when off
 * - Track: gold/40 when on, surface2 when off
 * - Size: 48×28px (track), 24×24px (thumb)
 * - aria-label="Ativar modo supermarket"
 * - Keyboard: Space to toggle (Radix handles this natively)
 */
export const SupermarketModeSpec = {
  rippleDuration:   400,
  tokenSwapDuration:300,
  cardRevealDuration:350,
  cardStaggerMs:    60,
  totalTransitionMs:900,
  cssClass:         "supermarket-mode",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// 5. PATRONO CARDS  (Founder / Patrono tier — special UI treatment)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Purpose: "Patrono" is VUUP's founding-member / premium patron tier.
 *          Patrono cards appear in the Matrix and Cockpit tabs as a prestige
 *          affordance. They use the gold palette with premium motion treatment.
 *
 * Card Anatomy
 * ─────────────
 * ┌─────────────────────────────┐
 * │ ✦ PATRONO        [badge]    │  ← header row
 * │                             │
 * │   R$ 12.450                 │  ← primary metric (large, gold)
 * │   Rendimento passivo mensal  │  ← label (mutedFg, sm)
 * │                             │
 * │   ████████████ 68%          │  ← progress bar (gold)
 * │   Meta: R$ 18.000           │  ← sub-label
 * │                             │
 * │   [Ver benefícios →]        │  ← CTA (ghost, gold)
 * └─────────────────────────────┘
 *
 * Visual Spec
 * ───────────
 * Container:
 *   - Background: linear-gradient(135deg, surface 0%, surface2 100%)
 *   - Border: 1px solid gold/40
 *   - Top border override: 2px solid gold (accent strip)
 *   - Radius: radius["2xl"] (24px)
 *   - Shadow: shadow.gold (0 0 16px oklch(0.84 0.16 88 / 0.45))
 *   - Padding: 20px (spacing[5])
 *
 * "✦ PATRONO" header:
 *   - Font: font.display, fontSize.xs, fontWeight.semibold, letterSpacing: 0.12em
 *   - Color: gold
 *   - Sparkle (✦): animate rotation 0→360deg, duration 4000ms, linear, loop
 *                  Only if prefers-reduced-motion: no-preference
 *
 * Badge:
 *   - Background: gold/20, border: 1px solid gold/50
 *   - Radius: radius.full
 *   - Text: tier name (e.g. "Ouro"), fontSize.xs, color gold
 *   - Padding: 2px 8px
 *
 * Primary metric:
 *   - Font: font.display, fontSize["4xl"], fontWeight.extrabold, color gold
 *   - Text shadow: 0 0 24px goldSoft
 *   - Animated roll on value change (same pattern as Matrix hero counter)
 *
 * Progress bar:
 *   - Track: surface3, height 6px, radius full
 *   - Fill: gradient goldFade (left to right), height 6px, radius full
 *   - Width animated: 0%→[value]% on mount, duration: dramatic (600ms), easing: decelerate
 *   - aria: role="progressbar", aria-valuenow, aria-valuemin=0, aria-valuemax=100
 *           aria-label="Progresso para meta de rendimento"
 *
 * Hover / Press state:
 *   - whileHover: scale(1.015), shadow intensifies to xl
 *   - whileTap: scale(0.985) with springy easing
 *   - transition: duration normal (200ms)
 *
 * WCAG Notes
 * ──────────
 * - Card has role="article", aria-labelledby pointing to metric + label
 * - CTA button: aria-label="Ver benefícios do Plano Patrono"
 * - Focus ring: 2px solid gold, offset 2px
 * - Gold on surface2 background: CR ~6.8:1 ✅ (meets AA for large text and UI)
 * - Gold on surface (darker): CR ~7.4:1 ✅
 *
 * Unlock Animation (first time Patrono status achieved)
 * ──────────────────────────────────────────────────────
 * 1. Full-screen overlay: background gold/10, z-index: modal
 * 2. Shield SVG morphs from electric state to gold "Patrono shield"
 *    duration: hero (900ms), easing: slowReveal
 * 3. Particle burst: 20 gold particles, radial spread from center
 *    each particle: 4–8px circle, fade out over 1200ms
 * 4. "Bem-vindo, Patrono" text fades in below shield, fontSize["3xl"], gold
 * 5. Dismiss: tap anywhere or auto-dismiss after 3s
 * 6. Confetti-like finale: if prefers-reduced-motion: no-preference
 */
export const PatronoCardSpec = {
  containerBorderTopWidth: "2px",
  sparkleRotationDuration: 4000,
  progressRevealDuration:  duration.dramatic,
  unlockParticleCount:     20,
  unlockAutoDismissMs:     3000,
  focusRingColor:          "gold",
  focusRingWidth:          "2px",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Accessibility Summary Table
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Component               | Contrast (on background) | Min tap  | Focus ring        | Notes
 * ----------------------- | ------------------------ | -------- | ----------------- | ------
 * Foreground text         | ~14:1 ✅ AA/AAA          | —        | —                 |
 * Electric (primary)      | ~5.2:1 ✅ AA text        | —        | 2px electric+2px  |
 * Neon (earnings)         | ~8.1:1 ✅ AA/AAA         | —        | —                 |
 * Gold (patrono)          | ~7.4:1 ✅ AA/AAA         | —        | 2px gold+2px      |
 * Danger (shield SOS)     | ~4.8:1 ✅ AA             | —        | 3px dangerGlow+3px|
 * mutedFg (secondary text)| ~3.6:1 ⚠ UI only        | —        | —                 | Not for body text
 * Tab bar buttons         | n/a                      | 48px ✅  | 2px ring+2px      |
 * FAB buttons             | n/a                      | 48px ✅  | 2px ring+2px      |
 * Panic/SOS button        | n/a                      | 64px ✅  | 3px dangerGlow+3px|
 * Vehicle markers (map)   | n/a                      | 40px ✅  | 2px ring+2px      |
 * Card CTAs               | electric ~5.2:1 ✅       | 44px ✅  | 2px ring+2px      |
 *
 * Reduced motion: all looping/continuous animations must check
 * prefers-reduced-motion: reduce and either pause or switch to opacity-only fades.
 *
 * Screen reader: all decorative animations (number rain, enxame float,
 * sparkle rotation) must have aria-hidden="true".
 */
