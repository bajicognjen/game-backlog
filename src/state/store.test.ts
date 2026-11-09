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
