/**
 * Which requests the web build sends through its own Worker (`worker/proxy.ts`):
 * the APIs that send no CORS headers, so a browser page cannot call them
 * directly. Shared by the app and the Worker, so both agree on the hosts.
 */
export const PROXIED_HOSTS: readonly string[] = ["id.twitch.tv", "api.igdb.com", "api.steampowered.com"];

/** The same-origin path the app calls; the Worker answers it. */
export const PROXY_PATH = "/api/proxy";

/**
 * Carries the real URL. A header rather than a query string, so the Steam
 * key in a Steam URL never appears in the Worker's own request URL or logs.
 */
export const PROXY_URL_HEADER = "X-Proxy-Url";

export function isProxiedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && PROXIED_HOSTS.includes(parsed.hostname);
  } catch {
    return false;
  }
}

/** The request a browser page sends instead of `input`: unchanged when the host needs no proxy. */
export function viaProxy(input: string, init?: RequestInit): { url: string; init?: RequestInit } {
  if (!isProxiedUrl(input)) return { url: input, init };
  const headers = new Headers(init?.headers);
  headers.set(PROXY_URL_HEADER, input);
  return { url: PROXY_PATH, init: { ...init, headers } };
}
