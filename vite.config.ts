/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { readFileSync } from "node:fs";

const host = process.env.TAURI_DEV_HOST;
const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

// Tauri sets TAURI_ENV_* for its before*Command hooks. The manifest and the
// service worker belong to the web build only; the desktop app gets neither.
const tauriBuild = Boolean(process.env.TAURI_ENV_PLATFORM);

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [
    react(),
    ...(tauriBuild
      ? []
      : [
          VitePWA({
            // A new deploy takes over on the next load; no "update available" prompt needed.
            registerType: "autoUpdate",
            injectRegister: "inline",
            includeAssets: ["favicon.png", "icons/*.png"],
            manifest: {
              name: "Game Backlog",
              short_name: "Backlog",
              description: "Plan the order of a singleplayer backlog and see when each game starts and ends.",
              lang: "en-GB",
              start_url: "/",
              scope: "/",
              display: "standalone",
              background_color: "#0f1216",
              theme_color: "#0f1216",
              icons: [
                { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
                { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
                { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
              ],
            },
            workbox: {
              globPatterns: ["**/*.{js,css,html,png,webmanifest}"],
              // The proxy is never a page; offline it must fail, not answer with index.html.
              navigateFallbackDenylist: [/^\/api\//],
              cleanupOutdatedCaches: true,
            },
          }),
        ]),
  ],

  // The version shown in the top bar; `version.test.ts` keeps it equal to the Tauri and Cargo versions.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
    // 4. in a browser, the API proxy is the Worker from `npm run dev:worker` (wrangler's default port)
    proxy: {
      "/api": "http://localhost:8787",
    },
  },

  // Unit tests cover the pure domain modules and the Worker's proxy; nothing there touches Tauri.
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "worker/**/*.test.ts"],
  },
}));
