import { useEffect, useRef, useState } from "react";
import type { SearchHit } from "../domain/provider";
import type { GameSource } from "../domain/types";
import { ProviderError, type ProviderFailure } from "../platform/http";
import { primaryProvider } from "../platform/providers";
import { providers } from "./providers";
import { useStore } from "./store";

export const MIN_QUERY_LENGTH = 3;
export const DEBOUNCE_MS = 400;

export type GameSearchState =
  | { status: "idle" }
  | { status: "short" }
  | { status: "loading"; hits: SearchHit[]; source: GameSource | null }
  | { status: "ready"; hits: SearchHit[]; source: GameSource }
  | { status: "error"; reason: ProviderFailure };

/**
 * Debounced game search: waits `DEBOUNCE_MS` after the last keystroke, only
 * asks for queries of `MIN_QUERY_LENGTH`+ characters, cancels a request a
 * newer query makes stale, and remembers results per query for the session.
 */
export function useGameSearch(query: string): GameSearchState {
  const settings = useStore((s) => s.settings);
  const [state, setState] = useState<GameSearchState>({ status: "idle" });
  const cache = useRef(new Map<string, { hits: SearchHit[]; source: GameSource }>());
  const last = useRef<{ hits: SearchHit[]; source: GameSource | null }>({ hits: [], source: null });

  const provider = primaryProvider(providers);
  const configured = provider.configured(settings);
  const cacheKey = query.trim().toLowerCase();

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed === "") {
      setState({ status: "idle" });
      return;
    }
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setState({ status: "short" });
      return;
    }
    if (!configured) {
      setState({ status: "error", reason: "no-credentials" });
      return;
    }
    const cached = cache.current.get(cacheKey);
    if (cached) {
      last.current = cached;
      setState({ status: "ready", ...cached });
      return;
    }

    setState({ status: "loading", ...last.current });
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const hits = await provider.search(trimmed, controller.signal);
        const outcome = { hits, source: provider.source };
        cache.current.set(cacheKey, outcome);
        last.current = outcome;
        setState({ status: "ready", ...outcome });
      } catch (error) {
        if (controller.signal.aborted) return; // superseded by a newer query
        setState({ status: "error", reason: error instanceof ProviderError ? error.reason : "other" });
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // Credentials are read from the store when the request fires.
  }, [query, configured, cacheKey, provider]);

  return state;
}
