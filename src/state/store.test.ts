/**
 * The store against the in-memory repository (what it uses outside Tauri).
 * Covers the undo of a Steam import: it must take back exactly the sessions
 * the import wrote, never one logged by hand before or after it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STEAM_IMPORT_NOTE } from "../domain/steam";
import { useStore } from "./store";

const store = useStore.getState;

beforeEach(async () => {
  // The undo offer and the automatic backup run on timers; keep them from firing.
  vi.useFakeTimers();
  await store().load();
});

afterEach(() => vi.useRealTimers());

describe("logSessions", () => {
  it("writes nothing and offers no undo for an empty import", async () => {
    const before = store().sessions.length;
    expect(await store().logSessions([], { done: "Added", undone: "Removed" })).toBe(true);
    expect(store().sessions).toHaveLength(before);
    expect(store().undo).toBeNull();
  });

  it("undo removes the imported sessions and keeps the ones logged by hand", async () => {
    const [first, second] = store().games.filter((g) => g.platform === "pc");
    await store().logSession({ gameId: first.id, playedOn: "2026-11-01", hours: 2, note: "before" });

    const ok = await store().logSessions(
      [
        { gameId: first.id, playedOn: "2026-11-02", hours: 5, note: STEAM_IMPORT_NOTE },
        { gameId: second.id, playedOn: "2026-11-03", hours: 1.5, note: STEAM_IMPORT_NOTE },
      ],
      { done: "Added", undone: "Removed" },
    );
    expect(ok).toBe(true);
    expect(store().notice).toBe("Added");
    expect(store().games.find((g) => g.id === first.id)?.hoursPlayed).toBe(7);

    // Logged while the undo offer still stands.
    await store().logSession({ gameId: second.id, playedOn: "2026-11-04", hours: 1, note: "after" });
    expect(store().undo).not.toBeNull();

    await store().undoLast();
    expect(store().sessions.map((s) => s.note)).toEqual(["before", "after"]);
    expect(store().games.find((g) => g.id === first.id)?.hoursPlayed).toBe(2);
    expect(store().games.find((g) => g.id === second.id)?.hoursPlayed).toBe(1);
    expect(store().notice).toBe("Removed");
    expect(store().undo).toBeNull();
  });
});

describe("the Together list", () => {
  const byTitle = (title: string) => {
    const game = store().games.find((g) => g.title === title);
    if (!game) throw new Error(`No game titled ${title}`);
    return game;
  };
  const pcPlan = () => plannedTitles("pc");
  const together = () => plannedTitles("together");
  function plannedTitles(plan: "pc" | "together"): string[] {
    return store()
      .games.filter((g) => g.status !== "completed" && g.status !== "dropped" && (plan === "together" ? g.together : !g.together && g.platform === "pc"))
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((g) => g.title);
  }

  it("moves a game out of the PC plan to the end of Together, and undo puts it back in its slot", async () => {
    const slot = pcPlan().indexOf("The Forest");
    const pcCount = pcPlan().length;
    expect(await store().setTogether(byTitle("The Forest").id, true)).toBe(true);

    expect(together()).toEqual(["The Forest"]);
    expect(pcPlan()).toHaveLength(pcCount - 1);
    expect(store().games.filter((g) => !g.together && g.platform === "pc" && g.position !== null).map((g) => g.position).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual(
      Array.from({ length: pcCount - 1 }, (_, i) => i + 1),
    );
    expect(byTitle("The Forest")).toMatchObject({ platform: "pc", together: true, position: 1 });
    expect(store().notice).toContain("The Forest");

    await store().undoLast();
    expect(together()).toEqual([]);
    expect(pcPlan().indexOf("The Forest")).toBe(slot);
  });

  it("moves between plans from the edit form, to the chosen slot", async () => {
    const forest = byTitle("The Forest");
    const mafia = byTitle("Mafia: Definitive Edition");
    expect(await store().editGame(mafia.id, { together: true }, 0)).toBe(true);
    expect(await store().editGame(forest.id, { together: true }, 0)).toBe(true);
    expect(together()).toEqual(["The Forest", "Mafia: Definitive Edition"]);
    // Back to the first slot of the PC plan, which another game holds: no collision.
    expect(await store().editGame(forest.id, { together: false }, 0)).toBe(true);
    expect(pcPlan()[0]).toBe("The Forest");
    expect(await store().editGame(mafia.id, { together: false }, 8)).toBe(true);
    expect(together()).toEqual([]);
  });

  it("finishing a Together game keeps the PC plan's start date and current game", async () => {
    const forest = byTitle("The Forest");
    await store().setTogether(forest.id, true);
    await store().setGameStatus(forest.id, "in_progress");
    const startDate = store().settings.startDate;
    const current = store().games.filter((g) => g.status === "in_progress" && !g.together).map((g) => g.title);

    expect(await store().finishGame(forest.id, { completedAt: "2026-11-20", rating: 8, review: null, nextStartDate: null, startNext: false })).toBe(true);
    expect(byTitle("The Forest")).toMatchObject({ status: "completed", together: true, position: null });
    expect(store().settings.startDate).toBe(startDate);
    expect(store().games.filter((g) => g.status === "in_progress" && !g.together).map((g) => g.title)).toEqual(current);
  });
});

describe("routine confirmations", () => {
  afterEach(() => {
    store().setSyncPanelOpen(false);
    store().dismissNotice();
  });

  it("clear themselves after 8 s, but not while the pointer or focus holds them", () => {
    store().notify("Exported.");
    vi.advanceTimersByTime(5000);
    store().pauseNotice();
    vi.advanceTimersByTime(60_000);
    expect(store().notice).toBe("Exported.");
    store().resumeNotice();
    vi.advanceTimersByTime(2900);
    expect(store().notice).toBe("Exported.");
    vi.advanceTimersByTime(200);
    expect(store().notice).toBeNull();
  });

  it("one shown in Settings → Sync stays while Sync is open, and clears itself once Settings closes", () => {
    store().setSyncPanelOpen(true);
    store().notify("Sync is on.", "sync");
    vi.advanceTimersByTime(60_000);
    expect(store().notice).toBe("Sync is on.");
    store().resumeNotice(); // leaving the notice while Sync is open starts nothing
    vi.advanceTimersByTime(60_000);
    expect(store().notice).toBe("Sync is on.");

    store().setSyncPanelOpen(false);
    vi.advanceTimersByTime(7900);
    expect(store().notice).toBe("Sync is on.");
    vi.advanceTimersByTime(200);
    expect(store().notice).toBeNull();
  });
});
