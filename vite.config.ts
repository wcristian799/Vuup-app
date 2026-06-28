import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig({
  // base: './' is required for Capacitor's file:// protocol on Android/iOS (the
  // default, preserving the tested mobile build). Web hosts (Vercel) serve from
  // the domain root, where relative paths break nested routes — the Vercel build
  // sets VITE_BASE=/ to override. See DEPLOY.md.
  base: process.env["VITE_BASE"] ?? "./",
  plugins: [
    // TanStack Router file-based routing (must come before react)
    TanStackRouterVite({ autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "masked-icon.svg"],
      manifest: {
        name: "VUUP — Mobilidade Urbana Viva",
        short_name: "VUUP",
        description:
          "App VUUP: corridas, motoboy, rotas coletivas, renda passiva e segurança comunitária por efeito enxame.",
        theme_color: "#0c1a3d",
        background_color: "#111827",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\./,
            handler: "NetworkFirst",
            options: {
              cacheName: "vuup-api-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24, // 24h
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: false, // disable SW in dev to avoid stale cache issues
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
  },
});
