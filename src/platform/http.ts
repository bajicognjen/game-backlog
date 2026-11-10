import { isTauri } from "@tauri-apps/api/core";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { viaProxy } from "./proxy";

/**
 * Inside the desktop app, requests go through Tauri's HTTP plugin (sent from
 * the Rust side, so no CORS restrictions; the allowed hosts are listed in
 * `src-tauri/capabilities/default.json`). In a browser page the APIs that
 * send no CORS headers go through the web build's own Worker instead
 * (`viaProxy`); everything else uses the normal `fetch`, as do the unit
 * tests, which stub it and run without a page.
 */
export function httpFetch(input: string, init?: RequestInit): Promise<Response> {
  if (isTauri()) return tauriFetch(input, init);
  if (typeof window === "undefined") return fetch(input, init);
  const proxied = viaProxy(input, init);
  return fetch(proxied.url, proxied.init);
}

/** A request that takes longer than this is reported as a network problem. */
export const REQUEST_TIMEOUT_MS = 15_000;

export type ProviderFailure = "no-credentials" | "unauthorized" | "network" | "other";

export class ProviderError extends Error {
  constructor(
    public readonly reason: ProviderFailure,
    public readonly status: number | null = null,
  ) {
    super(reason);
    this.name = "ProviderError";
  }
}

/** Fetch with a timeout; a caller's abort (a newer query) is rethrown as-is, everything else becomes a ProviderError. */
export async function fetchWithTimeout(input: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
  try {
    return await httpFetch(input, { ...init, signal: withTimeout(signal) });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ProviderError("network");
  }
}

export function withTimeout(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  if (!signal) return timeout;
  if (typeof AbortSignal.any === "function") return AbortSignal.any([signal, timeout]);
  const controller = new AbortController();
  signal.addEventListener("abort", () => controller.abort(), { once: true });
  timeout.addEventListener("abort", () => controller.abort(), { once: true });
  return controller.signal;
}

export function statusToFailure(status: number): ProviderFailure {
  return status === 401 || status === 403 ? "unauthorized" : "other";
}
