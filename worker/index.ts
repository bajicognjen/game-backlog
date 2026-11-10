/**
 * The Cloudflare Worker behind the web version: static assets from `dist/`
 * (configured in `wrangler.jsonc`, served before this code runs for every
 * path but `/api/*`) and the proxy route.
 */
import { PROXY_PATH } from "../src/platform/proxy";
import { handleProxy } from "./proxy";

interface Env {
  ASSETS: Fetcher;
}

export default {
  fetch(request, env) {
    if (new URL(request.url).pathname === PROXY_PATH) return handleProxy(request);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
