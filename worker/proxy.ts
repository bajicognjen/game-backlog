/**
 * The web build's proxy for the APIs that send no CORS headers. A page of
 * this origin sends its Twitch, IGDB and Steam requests to `/api/proxy` with
 * the real URL in the `X-Proxy-Url` header (see `src/platform/proxy.ts`) and
 * its own credentials in the headers or query string, exactly as the desktop
 * app sends them; the Worker holds no keys of its own. It serves only pages
 * of this origin (`Sec-Fetch-Site: same-origin`) and reaches only the
 * listed hosts, so it cannot be used as a general proxy.
 */
import { PROXIED_HOSTS, PROXY_URL_HEADER } from "../src/platform/proxy";

export type UpstreamFetch = (url: string, init: RequestInit) => Promise<Response>;

/** Request headers that stay here: the browser's own, the connection's, and what Cloudflare adds. */
const DROPPED_REQUEST_HEADERS = new Set([
  "host",
  "cookie",
  "origin",
  "referer",
  "connection",
  "content-length",
  "accept-encoding",
  "te",
  "upgrade",
  "x-real-ip",
  "true-client-ip",
  PROXY_URL_HEADER.toLowerCase(),
]);
const DROPPED_REQUEST_PREFIXES = ["sec-", "cf-", "x-forwarded-"];

/** The only response headers passed back; the rest describe the upstream connection or set cookies. */
const KEPT_RESPONSE_HEADERS = ["content-type", "retry-after", "x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-reset"];

export async function handleProxy(request: Request, upstreamFetch: UpstreamFetch = (url, init) => fetch(url, init)): Promise<Response> {
  if (!isSameOrigin(request)) return problem(403, "The proxy only serves the app on this origin.");
  if (request.method !== "GET" && request.method !== "POST") return problem(405, "Only GET and POST pass through.");
  const target = upstreamUrlOf(request.headers.get(PROXY_URL_HEADER));
  if (!target) return problem(403, `Only ${PROXIED_HOSTS.join(", ")} can be reached through the proxy.`);

  const init: RequestInit = { method: request.method, headers: forwardedRequestHeaders(request.headers), redirect: "manual" };
  if (request.method === "POST") init.body = await request.arrayBuffer();
  let upstream: Response;
  try {
    upstream = await upstreamFetch(target.href, init);
  } catch {
    return problem(502, `${target.hostname} could not be reached.`);
  }
  return new Response(upstream.body, { status: upstream.status, headers: forwardedResponseHeaders(upstream.headers) });
}

/** True for requests a page of this origin makes; curl and other sites get nothing. */
export function isSameOrigin(request: Request): boolean {
  const site = request.headers.get("Sec-Fetch-Site");
  if (site !== null) return site === "same-origin";
  const origin = request.headers.get("Origin");
  return origin !== null && origin === new URL(request.url).origin;
}

export function upstreamUrlOf(header: string | null): URL | null {
  if (!header) return null;
  let url: URL;
  try {
    url = new URL(header);
  } catch {
    return null;
  }
  return url.protocol === "https:" && PROXIED_HOSTS.includes(url.hostname) ? url : null;
}

export function forwardedRequestHeaders(headers: Headers): Headers {
  const out = new Headers();
  headers.forEach((value, name) => {
    if (DROPPED_REQUEST_HEADERS.has(name) || DROPPED_REQUEST_PREFIXES.some((prefix) => name.startsWith(prefix))) return;
    out.set(name, value);
  });
  return out;
}

export function forwardedResponseHeaders(headers: Headers): Headers {
  const out = new Headers({ "Cache-Control": "no-store" });
  for (const name of KEPT_RESPONSE_HEADERS) {
    const value = headers.get(name);
    if (value !== null) out.set(name, value);
  }
  return out;
}

function problem(status: number, message: string): Response {
  return new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
