import { create } from "zustand";
import type { ApplyUpdate } from "../platform/pwa";
import { checkForUpdate, installUpdate, type AvailableUpdate } from "../platform/updates";
import { describeError } from "./store";

/** `reloadReady` is the web build: a new version is installed and waits for a reload. */
export type UpdateStatus = "idle" | "checking" | "upToDate" | "available" | "installing" | "checkFailed" | "installFailed" | "reloadReady";

export interface UpdateState {
  status: UpdateStatus;
  /** The newer version on offer. */
  version: string | null;
  /** 0–1 while downloading; null while the size is unknown. */
  progress: number | null;
  /** Technical detail of the last failure. */
  detail: string | null;
  /** Ask GitHub for a newer release. A quiet check (the one at start) stays silent when offline or up to date. */
  check(quiet?: boolean): Promise<void>;
  install(): Promise<void>;
  /** Hide the offer until the next check. */
  dismiss(): void;
  /** Web build: a new version waits; offer the reload that switches to it. */
  offerReload(apply: ApplyUpdate): void;
  reload(): void;
}

/** The release on offer, kept for `install`. */
let pending: AvailableUpdate | null = null;
/** The waiting web worker on offer, kept for `reload`. */
let pendingReload: ApplyUpdate | null = null;

export const useUpdates = create<UpdateState>((set, get) => ({
  status: "idle",
  version: null,
  progress: null,
  detail: null,

  async check(quiet = false) {
    if (get().status === "checking" || get().status === "installing") return;
    set({ status: quiet ? get().status : "checking", detail: null });
    try {
      pending = await checkForUpdate();
      if (pending) set({ status: "available", version: pending.version });
      else set({ status: quiet ? "idle" : "upToDate", version: null });
    } catch (error) {
      pending = null;
      set({ status: quiet ? "idle" : "checkFailed", detail: describeError(error) });
    }
  },

  async install() {
    if (!pending) return;
    set({ status: "installing", progress: null, detail: null });
    try {
      await installUpdate(pending, (progress) => set({ progress }));
    } catch (error) {
      set({ status: "installFailed", detail: describeError(error) });
    }
  },

  dismiss() {
    pendingReload = null;
    set({ status: "idle", detail: null });
  },

  offerReload(apply) {
    pendingReload = apply;
    set({ status: "reloadReady", detail: null });
  },

  reload() {
    pendingReload?.();
  },
}));
