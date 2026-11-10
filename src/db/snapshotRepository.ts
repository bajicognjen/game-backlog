import { todayIso } from "../domain/dates";
import { withCompletedOrder, withPlanOrder } from "../domain/plan";
import { SEED_SETTINGS, buildSeedGames } from "../domain/seed";
import { withHoursPlayed } from "../domain/sessions";
import type { Game, PlaySession, Settings } from "../domain/types";
import type { Repository, Snapshot } from "./repository";

/** Everything a snapshot repository keeps between calls. */
export interface SnapshotState {
  settings: Settings;
  games: Game[];
  sessions: PlaySession[];
  /**
   * The next ids to hand out. They only grow, like SQLite's AUTOINCREMENT,
   * so a row put back by undo can never collide with one added meanwhile.
   */
  nextGameId: number;
  nextSessionId: number;
}

/** Where a snapshot repository keeps its state between sessions. */
export interface SnapshotStore {
  /** The saved state, or null on the first run. */
  load(): Promise<SnapshotState | null>;
  save(state: SnapshotState): Promise<void>;
}

/** The first-run state: the seed plan, as `ensureSeeded` loads it into SQLite. */
export function seedState(): SnapshotState {
  const games = buildSeedGames();
  return { settings: { ...SEED_SETTINGS }, games, sessions: [], nextGameId: nextIdAfter(games), nextSessionId: 1 };
}

/** A clean first run for a new user: no games, the plan starting today. */
export function emptyState(now: Date = new Date()): SnapshotState {
  return { settings: { ...SEED_SETTINGS, startDate: todayIso(now) }, games: [], sessions: [], nextGameId: 1, nextSessionId: 1 };
}

export function nextIdAfter(rows: ReadonlyArray<{ id: number }>): number {
  return Math.max(0, ...rows.map((row) => row.id)) + 1;
}

export interface SnapshotOptions {
  /** The state of the first run, when the store holds nothing yet: the seed plan unless told otherwise. */
  firstRun?: () => SnapshotState;
}

/**
 * A repository that holds the whole snapshot in memory and applies every
 * write as a pure change of it, with the same plan helpers the SQL
 * statements follow (`domain/plan.ts`). With a store, each change is saved
 * before it becomes current, so a failed save leaves the state as it was;
 * without one it is the throwaway repository the unit tests run against.
 */
export function createSnapshotRepository(store: SnapshotStore | null = null, options: SnapshotOptions = {}): Repository {
  const firstRun = options.firstRun ?? seedState;
  let state: SnapshotState | null = null;
  let initPromise: Promise<void> | null = null;
  /** Writes run one after another, in the order they were asked. */
  let queue: Promise<unknown> = Promise.resolve();

  function init(): Promise<void> {
    if (!initPromise) {
      initPromise = (async () => {
        const saved = store ? await store.load() : null;
        if (saved) {
          state = saved;
          return;
        }
        const initial = firstRun();
        if (store) await store.save(initial);
        state = initial;
      })();
    }
    return initPromise;
  }

  async function current(): Promise<SnapshotState> {
    await init();
    return state as SnapshotState;
  }

  function commit(change: (current: SnapshotState) => SnapshotState): Promise<void> {
    const run = queue.then(async () => {
      const next = change(await current());
      if (store) await store.save(next);
      state = next;
    });
    queue = run.catch(() => undefined);
    return run;
  }

  const nextCompletedOrder = (games: readonly Game[]) => Math.max(0, ...games.map((g) => g.completedOrder ?? 0)) + 1;

  return {
    async load(): Promise<Snapshot> {
      await queue;
      const s = await current();
      return { settings: { ...s.settings }, games: withHoursPlayed(s.games, s.sessions), sessions: s.sessions.map((x) => ({ ...x })) };
    },

    saveSettings(patch) {
      return commit((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
    },

    addPlannedGame(input, order) {
      if (!order.ids.includes("new")) return Promise.reject(new Error("Plan order must contain the slot for the new game"));
      return commit((s) => {
        const id = s.nextGameId;
        const game: Game = {
          id,
          ...input,
          platform: order.platform,
          status: "pending",
          hoursPlayed: 0,
          position: null,
          completedOrder: null,
          completedAt: null,
          rating: null,
          review: null,
        };
        const games = withPlanOrder(
          [...s.games, game],
          order.ids.map((slot) => (slot === "new" ? id : slot)),
          order.platform,
        );
        return { ...s, games, nextGameId: id + 1 };
      });
    },

    addCompletedGame(input) {
      return commit((s) => {
        const game: Game = { id: s.nextGameId, ...input, status: "completed", hoursPlayed: 0, position: null, completedOrder: nextCompletedOrder(s.games) };
        return { ...s, games: [...s.games, game], nextGameId: s.nextGameId + 1 };
      });
    },

    updateGame(id, patch) {
      return commit((s) => ({ ...s, games: s.games.map((g) => (g.id === id ? { ...g, ...patch } : g)) }));
    },

    deleteGame(id, planOrder) {
      return commit((s) => ({
        ...s,
        sessions: s.sessions.filter((x) => x.gameId !== id),
        games: withPlanOrder(
          s.games.filter((g) => g.id !== id),
          planOrder.ids,
          planOrder.platform,
        ),
      }));
    },

    setPlanOrder(planOrder) {
      return commit((s) => ({ ...s, games: withPlanOrder(s.games, planOrder.ids, planOrder.platform) }));
    },

    finishGame(id, input, planOrder) {
      return commit((s) => {
        const order = nextCompletedOrder(s.games);
        let games = s.games.map((g) =>
          g.id === id
            ? { ...g, status: "completed" as const, position: null, completedOrder: order, completedAt: input.completedAt, rating: input.rating, review: input.review }
            : g,
        );
        games = withPlanOrder(games, planOrder.ids, planOrder.platform);
        const nextId = planOrder.ids[0];
        if (input.startNext && nextId !== undefined) {
          games = games.map((g) => (g.id === nextId && g.status !== "completed" ? { ...g, status: "in_progress" as const } : g));
        }
        const settings = input.nextStartDate ? { ...s.settings, startDate: input.nextStartDate } : s.settings;
        return { ...s, games, settings };
      });
    },

    setCompletedOrder(ids) {
      return commit((s) => ({ ...s, games: withCompletedOrder(s.games, ids) }));
    },

    dropGame(id, droppedAt, planOrder) {
      return commit((s) => {
        const order = nextCompletedOrder(s.games);
        const games = s.games.map((g) => (g.id === id ? { ...g, status: "dropped" as const, position: null, completedOrder: order, completedAt: droppedAt } : g));
        return { ...s, games: withPlanOrder(games, planOrder.ids, planOrder.platform) };
      });
    },

    addSession(input) {
      return commit((s) => ({ ...s, sessions: [...s.sessions, { id: s.nextSessionId, ...input }], nextSessionId: s.nextSessionId + 1 }));
    },

    deleteSession(id) {
      return commit((s) => ({ ...s, sessions: s.sessions.filter((x) => x.id !== id) }));
    },

    addSessions(inputs) {
      return commit((s) => ({
        ...s,
        sessions: [...s.sessions, ...inputs.map((input, i) => ({ id: s.nextSessionId + i, ...input }))],
        nextSessionId: s.nextSessionId + inputs.length,
      }));
    },

    deleteSessions(ids) {
      return commit((s) => ({ ...s, sessions: s.sessions.filter((x) => !ids.includes(x.id)) }));
    },

    reinsertGame(game, restored, planOrder, completedOrder) {
      return commit((s) => {
        let games: Game[] = [...s.games, { ...game, position: null, completedOrder: null }];
        if (planOrder) games = withPlanOrder(games, planOrder.ids, planOrder.platform);
        if (completedOrder) games = withCompletedOrder(games, completedOrder);
        return { ...s, games, sessions: [...s.sessions, ...restored.map((x) => ({ ...x }))] };
      });
    },

    restoreGame(game, planOrder, completedOrder) {
      return commit((s) => {
        let games = s.games.map((g) =>
          g.id === game.id
            ? { ...g, status: game.status, position: null, completedOrder: null, completedAt: game.completedAt, rating: game.rating, review: game.review }
            : g,
        );
        if (planOrder) games = withPlanOrder(games, planOrder.ids, planOrder.platform);
        if (completedOrder) games = withCompletedOrder(games, completedOrder);
        return { ...s, games };
      });
    },

    /** Like the SQLite import: the plan settings come from the file, credentials and local lists stay. */
    replaceAll(backup) {
      return commit((s) => {
        const games = backup.games.map((g) => ({ ...g }));
        const sessions = backup.sessions.map((x) => ({ ...x }));
        return {
          settings: { ...s.settings, startDate: backup.settings.startDate, hoursPerWeek: backup.settings.hoursPerWeek, theme: backup.settings.theme },
          games,
          sessions,
          nextGameId: Math.max(s.nextGameId, nextIdAfter(games)),
          nextSessionId: Math.max(s.nextSessionId, nextIdAfter(sessions)),
        };
      });
    },
  };
}
