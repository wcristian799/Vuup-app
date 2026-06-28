/**
 * VUUP Design Tokens — single source of truth
 *
 * These mirror the CSS custom properties defined in src/styles.css.
 * Import this file wherever TypeScript-typed token references are needed
 * (e.g. Framer Motion keyframes, canvas drawing, Storybook docs).
 *
 * Contrast ratios are calculated against --background (oklch 0.13 0.015 260 ≈ #121219).
 * Targets: WCAG AA ≥ 4.5:1 for text, ≥ 3:1 for large text / UI components.
 */

// ─── Color Tokens ────────────────────────────────────────────────────────────

export const color = {
  // Canvas
  background: "oklch(0.13 0.015 260)", // ≈ #121219 — deep urban black
  foreground: "oklch(0.98 0.005 240)", // ≈ #F8F9FF — near-white text   CR ~14:1 ✅

  // Surface hierarchy (dark cards, sheets, overlays)
  surface: "oklch(0.17 0.018 260)", // ≈ #191A22 — base card
  surface2: "oklch(0.21 0.022 262)", // ≈ #1E1F2A — raised card
  surface3: "oklch(0.26 0.026 262)", // ≈ #252634 — elevated panel

  // Brand palette
  electric: "oklch(0.72 0.22 246)", // ≈ #3B82F6 — primary blue   CR ~5.2:1 ✅
  electricDeep: "oklch(0.46 0.24 262)", // ≈ #1D4ED8 — pressed / dark shade
  neon: "oklch(0.86 0.24 148)", // ≈ #4ADE80 — earnings green  CR ~8.1:1 ✅
  neonGlow: "oklch(0.92 0.22 152)", // ≈ #86EFAC — soft glow variant
  gold: "oklch(0.84 0.16 88)", // ≈ #FACC15 — founder gold    CR ~8.4:1 ✅
  goldSoft: "oklch(0.92 0.10 88)", // ≈ #FDE68A — soft label
  ice: "oklch(0.88 0.08 220)", // ≈ #BAE6FD — cold blue accent CR ~9.2:1 ✅
  danger: "oklch(0.65 0.24 22)", // ≈ #F87171 — alert / shield   CR ~4.8:1 ✅
  dangerGlow: "oklch(0.78 0.20 24)", // ≈ #FCA5A5 — glow variant

  // Semantic (shadcn mapped)
  primary: "oklch(0.68 0.21 248)",
  primaryFg: "oklch(0.12 0.02 260)",
  secondary: "oklch(0.21 0.022 262)",
  secondaryFg: "oklch(0.88 0.01 240)",
  muted: "oklch(0.21 0.018 260)",
  mutedFg: "oklch(0.62 0.02 250)", // ≈ #8B8FA8 — CR ~3.6:1 (UI only, not body text) ⚠
  accent: "oklch(0.24 0.03 262)",
  accentFg: "oklch(0.90 0.01 240)",
  destructive: "oklch(0.62 0.22 22)",
  destructiveFg: "oklch(0.98 0.005 240)",
  border: "oklch(0.28 0.025 262)", // ≈ #363748
  input: "oklch(0.21 0.022 262)",
  ring: "oklch(0.68 0.21 248)",
} as const;

export type ColorToken = keyof typeof color;

// ─── Typography Tokens ───────────────────────────────────────────────────────

export const font = {
  display: '"Space Grotesk", "Inter", system-ui, sans-serif',
  sans: '"Inter", system-ui, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
} as const;

export const fontSize = {
  "2xs": "0.625rem", // 10px — tab labels
  xs: "0.75rem", // 12px — captions, badges
  sm: "0.875rem", // 14px — secondary text
  base: "1rem", // 16px — body (min for mobile readability)
  lg: "1.125rem", // 18px — lead text
  xl: "1.25rem", // 20px — card headings
  "2xl": "1.5rem", // 24px
  "3xl": "1.875rem", // 30px
  "4xl": "2.25rem", // 36px — hero numbers
  "5xl": "3rem", // 48px — big metric
} as const;

export const fontWeight = {
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  extrabold: "800",
} as const;

export const lineHeight = {
  none: "1",
  tight: "1.25",
  snug: "1.375",
  normal: "1.5",
  relaxed: "1.625",
  loose: "2",
} as const;

// ─── Spacing Tokens ──────────────────────────────────────────────────────────
// 4px base grid

export const spacing = {
  0: "0",
  px: "1px",
  0.5: "2px",
  1: "4px",
  1.5: "6px",
  2: "8px",
  2.5: "10px",
  3: "12px",
  3.5: "14px",
  4: "16px",
  5: "20px",
  6: "24px",
  7: "28px",
  8: "32px",
  9: "36px",
  10: "40px",
  12: "48px",
  14: "56px",
  16: "64px",
  20: "80px", // bottom-nav height
  24: "96px",
} as const;

// ─── Border Radius Tokens ────────────────────────────────────────────────────
// Base radius = 1rem (16px) — generously rounded for a "soft urban" aesthetic

export const radius = {
  none: "0",
  sm: "calc(var(--radius) - 4px)", // 12px
  md: "calc(var(--radius) - 2px)", // 14px
  lg: "var(--radius)", // 16px — default card/modal
  xl: "calc(var(--radius) + 4px)", // 20px
  "2xl": "calc(var(--radius) + 8px)", // 24px — sheets, large cards
  "3xl": "calc(var(--radius) + 12px)", // 28px — pill FABs
  full: "9999px", // pills, badges, avatars
} as const;

// ─── Elevation / Shadow Tokens ───────────────────────────────────────────────

export const shadow = {
  sm: "0 1px 3px oklch(0 0 0 / 0.4)",
  md: "0 4px 12px oklch(0 0 0 / 0.5)",
  lg: "0 8px 24px oklch(0 0 0 / 0.55)",
  xl: "0 16px 40px oklch(0 0 0 / 0.6)",
  electric: "0 0 16px oklch(0.72 0.22 246 / 0.5)", // electric blue glow
  neon: "0 0 16px oklch(0.86 0.24 148 / 0.5)", // neon green glow
  gold: "0 0 16px oklch(0.84 0.16 88 / 0.45)", // gold shimmer
  danger: "0 0 12px oklch(0.65 0.24 22 / 0.5)", // danger pulse
  inner: "inset 0 2px 8px oklch(0 0 0 / 0.4)",
} as const;

// ─── Motion / Easing Tokens ──────────────────────────────────────────────────

export const easing = {
  standard: [0.2, 0, 0, 1] as [number, number, number, number],
  decelerate: [0, 0, 0.2, 1] as [number, number, number, number],
  accelerate: [0.4, 0, 1, 1] as [number, number, number, number],
  springy: { type: "spring" as const, stiffness: 400, damping: 28 },
  bouncy: { type: "spring" as const, stiffness: 600, damping: 20 },
  slowReveal: { duration: 0.6, ease: [0.2, 0, 0, 1] as [number, number, number, number] },
} as const;

export const duration = {
  instant: 0,
  fast: 100, // ms — micro-interactions (icon swap)
  normal: 200, // ms — most UI transitions
  slow: 350, // ms — page transitions, modals
  dramatic: 600, // ms — WOW entrances
  hero: 900, // ms — full-screen reveals
} as const;

// ─── Touch / Tap Target Tokens ───────────────────────────────────────────────
// WCAG 2.5.5 (AAA) recommends 44×44px; WCAG 2.5.8 (AA, 2.2+) ≥ 24×24px.
// VUUP targets 48×48px min for primary actions (comfort on mobile glass).

export const tapTarget = {
  min: "24px", // WCAG AA absolute floor
  comfort: "44px", // WCAG AAA recommendation
  preferred: "48px", // VUUP standard for primary actions
  tabBar: "56px", // bottom tab items (height: 80px container, icon+label ≤ 56px)
} as const;

// ─── Z-Index Scale ───────────────────────────────────────────────────────────

export const zIndex = {
  base: 0,
  raised: 10,
  dropdown: 20,
  sticky: 30,
  overlay: 40,
  modal: 50,
  toast: 60,
  tooltip: 70,
} as const;

// ─── Gradient Presets ────────────────────────────────────────────────────────

export const gradient = {
  canvas:
    "linear-gradient(160deg, oklch(0.13 0.02 268) 0%, oklch(0.11 0.015 255) 50%, oklch(0.14 0.025 275) 100%)",
  electricFade: "linear-gradient(135deg, oklch(0.46 0.24 262) 0%, oklch(0.72 0.22 246) 100%)",
  neonFade: "linear-gradient(135deg, oklch(0.65 0.24 152) 0%, oklch(0.86 0.24 148) 100%)",
  goldFade: "linear-gradient(135deg, oklch(0.70 0.16 80) 0%, oklch(0.84 0.16 88) 100%)",
  heatmap: "radial-gradient(circle, oklch(0.65 0.24 22 / 0.8) 0%, oklch(0.65 0.24 22 / 0) 70%)",
  matrixRow:
    "linear-gradient(90deg, transparent 0%, oklch(0.72 0.22 246 / 0.08) 50%, transparent 100%)",
} as const;
