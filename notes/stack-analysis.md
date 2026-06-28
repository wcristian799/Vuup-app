# VUUP Reference Stack Analysis

Source: https://github.com/wcristian799/Vuup-app.git  
Analyzed: 2026-06-28

## Stack Identified in Reference

| Layer         | Choice                                                            |
| ------------- | ----------------------------------------------------------------- |
| Runtime       | Bun (bun.lock, bunfig.toml)                                       |
| Framework     | React 19                                                          |
| Language      | TypeScript 5.8 (strict)                                           |
| Build tool    | Vite 8 (via @lovable.dev/vite-tanstack-config wrapper)            |
| Routing       | TanStack Router v1 (file-based, `/src/routes/`)                   |
| SSR layer     | TanStack Start + Nitro (server-side rendering)                    |
| Styling       | Tailwind CSS v4 (`@import "tailwindcss"` directive)               |
| UI primitives | Radix UI (full set) + shadcn/ui New York style                    |
| Animation     | Motion (motion/react — Framer Motion v12 rebranded)               |
| Icons         | Lucide React                                                      |
| Maps          | Leaflet + react-leaflet                                           |
| Forms         | react-hook-form + Zod                                             |
| Data fetching | TanStack Query v5                                                 |
| Lint          | ESLint 9 (flat config) + typescript-eslint + react-hooks/refresh  |
| Format        | Prettier 3 (printWidth:100, semi, double quotes, trailing commas) |

## Design System (from src/styles.css)

VUUP uses a **dark urban** theme with OKLCH color tokens:

| Token                                       | Usage                    | Value                   |
| ------------------------------------------- | ------------------------ | ----------------------- |
| `--electric`                                | Primary brand blue       | `oklch(0.72 0.22 246)`  |
| `--neon`                                    | Earnings / economy green | `oklch(0.86 0.24 148)`  |
| `--gold`                                    | Founder / passive income | `oklch(0.84 0.16 88)`   |
| `--ice`                                     | Cold blue accent         | `oklch(0.88 0.08 220)`  |
| `--danger`                                  | Alert / shield red       | `oklch(0.65 0.24 22)`   |
| `--background`                              | Deep urban black         | `oklch(0.13 0.015 260)` |
| `--surface` / `--surface-2` / `--surface-3` | Layered card surfaces    | progressively lighter   |

Fonts: Space Grotesk (display/headings) + Inter (body) + JetBrains Mono

## App Architecture (from reference routes/index.tsx)

5-tab mobile UI:

- **Mapa** — real-time ride map (Leaflet)
- **Matrix** — economic/earnings dashboard
- **Cockpit** — wallet and financial overview
- **Radar** — demand/heatmap analytics
- **Escudo** — community safety / shield features

Max-width 480px container, 100dvh height, bottom tab navigation.

## VUUP PWA Stack Decision

For this scaffold we use a **pure SPA** (no SSR) pattern instead of TanStack Start + Nitro:

**Why:** PWA + Capacitor (for later Ionic/Android/iOS builds) requires a client-only bundle. SSR with Nitro is incompatible with Capacitor's filesystem-based app launch. The reference's server-rendering layer is a Lovable.dev hosting concern, not the mobile target architecture.

| Layer      | Scaffolded Choice                             | Matches Reference?                   |
| ---------- | --------------------------------------------- | ------------------------------------ |
| Build      | Vite 6 (stable, without @lovable wrapper)     | ✅ same ecosystem                    |
| Runtime    | Node 22 / npm (bun not installed; works fine) | ⚠ bun preferred; easy to add later   |
| React      | 19                                            | ✅                                   |
| TypeScript | 5.8 strict                                    | ✅                                   |
| Routing    | TanStack Router (client SPA mode)             | ✅ same router                       |
| Styling    | Tailwind CSS v4                               | ✅                                   |
| UI         | Radix + shadcn/ui New York                    | ✅                                   |
| PWA        | vite-plugin-pwa (Workbox)                     | ➕ addition                          |
| Test       | Vitest + jsdom                                | ➕ addition                          |
| SSR        | None (SPA only)                               | ⚠ deliberate deviation for Capacitor |

## Capacitor Readiness Notes

When Capacitor is added (later mobile sprint):

1. `npm install @capacitor/core @capacitor/cli`
2. `npx cap init VUUP com.vuup.app --web-dir dist`
3. `npx cap add android` / `npx cap add ios`
4. Update `vite.config.ts` `base` to `"./"` for file:// protocol

The SPA-only architecture is specifically chosen to enable this without rework.
