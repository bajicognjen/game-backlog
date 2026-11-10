/**
 * Updates of the web build. vite-plugin-pwa generates a service worker that
 * precaches the app (vite.config.ts). When a deploy changes it, the browser
 * installs the new worker, which takes over at once (skipWaiting and
 * clientsClaim); the page that is open keeps running the code it loaded, so
 * this module notices the change of worker and offers a reload, after which
 * the new version runs. Nothing here runs in the desktop app, in the unit
 * tests or in `npm run dev`, none of which serve a service worker.
 *
 * The worker takes over by itself rather than waiting for a SKIP_WAITING
 * message from the page: in Chrome a skipWaiting() requested by message
 * was never carried out while the old worker still controlled the page, so
 * a Reload would have done nothing.
 */
import { isTauri } from "@tauri-apps/api/core";

export const SW_URL = "/sw.js";
/** Besides every time the page becomes visible, a long-lived page asks for a new worker this often. */
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/** The part of the service worker API this module touches; the tests pass a fake. */
export interface ContainerLike extends EventTarget {
  /** The worker serving this page; null on the very first visit. */
  controller: unknown;
}

/** Switches the page to the new version (a reload). */
export type ApplyUpdate = () => void;

/**
 * Call `onReady` whenever a new worker replaces the one that served this
 * page. The very first install, when nothing controlled the page before, is
 * not an update: the page already runs the latest code, so it stays silent.
 */
export function trackUpdates(container: ContainerLike, onReady: (apply: ApplyUpdate) => void, reload: () => void): void {
  let hadController = container.controller !== null;
  container.addEventListener("controllerchange", () => {
    if (hadController) onReady(reload);
    hadController = true;
  });
}

/** In a production web page: register the worker, watch it, and keep asking for new versions. */
export function watchForWebUpdate(onReady: (apply: ApplyUpdate) => void): void {
  if (isTauri() || !import.meta.env.PROD || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const container = navigator.serviceWorker;
  trackUpdates(container, onReady, () => window.location.reload());
  const start = () => {
    container
      .register(SW_URL, { scope: "/" })
      .then((registration) => {
        const check = () => void registration.update().catch(() => undefined);
        setInterval(check, UPDATE_CHECK_INTERVAL_MS);
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") check();
        });
      })
      .catch(() => undefined); // no worker here (an unsupported context): the app works without one
  };
  // Register after the page has loaded, so the first visit is not slowed down by it.
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
}
