import { create } from "zustand";
import { updatePriceMemory, type PriceMemory } from "../domain/priceMemory";
import { steamConfigured, type SteamWishlistEntry } from "../domain/steam";
import type { Settings } from "../domain/types";
import { priceMemoryStore } from "../platform/priceMemory";
import { steamFailureOf, type SteamFailure } from "../platform/steam";
import { loadWishlist } from "./steam";
import { useStore } from "./store";

export type WishlistStage = { kind: "idle" } | { kind: "loading" } | { kind: "failed"; reason: SteamFailure } | { kind: "ready" };

/**
 * The Steam wishlist with the store's prices, shared by the Wishlist section
 * and anything else that wants its summary: loaded once at start when Steam
 * is set up, again on Refresh, and for another account or region. Every
 * load brings the price memory up to date, so "new since you last looked"
 * and the lowest seen price follow from it.
 */
interface WishlistState {
  stage: WishlistStage;
  entries: SteamWishlistEntry[];
  memory: ReadonlyMap<number, PriceMemory>;
  /** The last look the current marks rest on: what Settings said when the list was loaded, so a look during the load leaves the marks until the next one. */
  seenAt: number;
  /** Ask Steam, update the price memory, and keep the answer. One load at a time; nothing without Steam set up. */
  load(): Promise<void>;
  /** Forget the list: Steam no longer set up, or about to load another account. */
  reset(): void;
}

/** The account and store region a loaded list belongs to. */
export function wishlistKey(settings: Pick<Settings, "steamApiKey" | "steamId" | "steamCountry">): string {
  return `${settings.steamApiKey.trim()}|${settings.steamId.trim()}|${settings.steamCountry}`;
}

let current: AbortController | null = null;

export const useWishlist = create<WishlistState>((set, get) => ({
  stage: { kind: "idle" },
  entries: [],
  memory: new Map(),
  seenAt: 0,

  async load() {
    const { settings } = useStore.getState();
    if (!steamConfigured(settings)) {
      get().reset();
      return;
    }
    if (get().stage.kind === "loading") return;
    const controller = new AbortController();
    current = controller;
    set({ stage: { kind: "loading" } });
    try {
      const entries = await loadWishlist(controller.signal);
      const previous = await priceMemoryStore.load(settings.steamCountry);
      const memory = updatePriceMemory(
        previous,
        entries.flatMap((entry) => (entry.store ? [entry.store] : [])),
        Date.now(),
      );
      await priceMemoryStore.save(settings.steamCountry, memory);
      if (controller.signal.aborted) return;
      set({ stage: { kind: "ready" }, entries, memory, seenAt: settings.wishlistSeenAt });
    } catch (error) {
      if (!controller.signal.aborted) set({ stage: { kind: "failed", reason: steamFailureOf(error) } });
    }
  },

  reset() {
    current?.abort();
    current = null;
    set({ stage: { kind: "idle" }, entries: [], memory: new Map(), seenAt: 0 });
  },
}));
