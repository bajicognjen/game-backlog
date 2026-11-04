import { withCompletedOrder, withPlanOrder } from "../domain/plan";
import { SEED_SETTINGS, buildSeedGames } from "../domain/seed";
import { withHoursPlayed } from "../domain/sessions";
import type { Game, PlaySession, Settings } from "../domain/types";
import type { Repository, Snapshot } from "./repository";

/**
 * In-memory stand-in used when the UI runs in a plain browser (no Tauri).
 * Starts from the seed data and forgets everything on reload.
 */
export function createMemoryRepository(): Repository {
  let settings: Settings = { ...SEED_SETTINGS };
  let games: Game[] = buildSeedGames();
  let sessions: PlaySession[] = [];
  let nextId = Math.max(0, ...games.map((g) => g.id)) + 1;
  let nextSessionId = 1;
  const nextCompletedOrder = () => Math.max(0, ...games.map((g) => g.completedOrder ?? 0)) + 1;

  return {
    async load(): Promise<Snapshot> {
      return { settings: { ...settings }, games: withHoursPlayed(games, sessions), sessions: sessions.map((s) => ({ ...s })) };
    },

    async saveSettings(patch) {
      settings = { ...settings, ...patch };
    },

    async addPlannedGame(input, order) {
      const id = nextId++;
      games = [
        ...games,
        {
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
        },
      ];
      games = withPlanOrder(
        games,
        order.ids.map((slot) => (slot === "new" ? id : slot)),
        order.platform,
      );
    },

    async addCompletedGame(input) {
      games = [
        ...games,
        { id: nextId++, ...input, status: "completed", hoursPlayed: 0, position: null, completedOrder: nextCompletedOrder() },
      ];
    },

    async updateGame(id, patch) {
      games = games.map((g) => (g.id === id ? { ...g, ...patch } : g));
    },

    async deleteGame(id, planOrder) {
      sessions = sessions.filter((s) => s.gameId !== id);
      games = withPlanOrder(
        games.filter((g) => g.id !== id),
        planOrder.ids,
        planOrder.platform,
      );
    },

    async setPlanOrder(planOrder) {
      games = withPlanOrder(games, planOrder.ids, planOrder.platform);
    },

    async finishGame(id, input, planOrder) {
      const order = nextCompletedOrder();
      games = games.map((g) =>
        g.id === id
          ? {
              ...g,
              status: "completed",
              position: null,
              completedOrder: order,
              completedAt: input.completedAt,
              rating: input.rating,
              review: input.review,
            }
          : g,
      );
      games = withPlanOrder(games, planOrder.ids, planOrder.platform);
      if (input.nextStartDate) settings = { ...settings, startDate: input.nextStartDate };
      const nextId = planOrder.ids[0];
      if (input.startNext && nextId !== undefined) {
        games = games.map((g) => (g.id === nextId && g.status !== "completed" ? { ...g, status: "in_progress" } : g));
      }
    },

    async setCompletedOrder(ids) {
      games = withCompletedOrder(games, ids);
    },

    async dropGame(id, droppedAt, planOrder) {
      const order = nextCompletedOrder();
      games = games.map((g) =>
        g.id === id ? { ...g, status: "dropped", position: null, completedOrder: order, completedAt: droppedAt } : g,
      );
      games = withPlanOrder(games, planOrder.ids, planOrder.platform);
    },

    async replaceAll(backup) {
      games = backup.games.map((g) => ({ ...g }));
      sessions = backup.sessions.map((s) => ({ ...s }));
      settings = { ...backup.settings };
      nextId = Math.max(0, ...games.map((g) => g.id)) + 1;
      nextSessionId = Math.max(0, ...sessions.map((s) => s.id)) + 1;
    },

    async addSession(input) {
      sessions = [...sessions, { id: nextSessionId++, ...input }];
    },

    async reinsertGame(game, restored, planOrder, completedOrder) {
      games = [...games, { ...game, position: null, completedOrder: null }];
      sessions = [...sessions, ...restored.map((s) => ({ ...s }))];
      if (planOrder) games = withPlanOrder(games, planOrder.ids, planOrder.platform);
      if (completedOrder) games = withCompletedOrder(games, completedOrder);
    },

    async restoreGame(game, planOrder, completedOrder) {
      games = games.map((g) =>
        g.id === game.id
          ? { ...g, status: game.status, position: null, completedOrder: null, completedAt: game.completedAt, rating: game.rating, review: game.review }
          : g,
      );
      if (planOrder) games = withPlanOrder(games, planOrder.ids, planOrder.platform);
      if (completedOrder) games = withCompletedOrder(games, completedOrder);
    },

    async deleteSession(id) {
      sessions = sessions.filter((s) => s.id !== id);
    },
  };
}
