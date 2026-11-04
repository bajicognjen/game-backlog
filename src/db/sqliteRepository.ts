import type Database from "@tauri-apps/plugin-sql";
import { getDb } from "./client";
import {
  DELETE_ALL_GAMES,
  completedOrderStatements,
  deleteGameStatement,
  finishGameStatement,
  insertCompletedGameStatement,
  insertGameStatement,
  insertGameWithIdStatement,
  listGames,
  planOrderStatements,
  positionStatement,
  resetPlanPositions,
  startGameStatement,
  updateGameQuery,
} from "./games";
import type { Repository, Snapshot } from "./repository";
import { ensureSeeded } from "./seed";
import { loadSettings, saveSettings, settingsStatements, upsertSetting } from "./settings";
import { runBatch } from "./sql";

let initPromise: Promise<Database> | null = null;

/** Open the database and run the first-run seed exactly once per app session. */
function initDb(): Promise<Database> {
  if (!initPromise) {
    initPromise = (async () => {
      const db = await getDb();
      await ensureSeeded(db);
      return db;
    })();
  }
  return initPromise;
}

export const sqliteRepository: Repository = {
  async load(): Promise<Snapshot> {
    await initDb();
    const [settings, games] = await Promise.all([loadSettings(), listGames()]);
    return { settings, games };
  },

  saveSettings,

  async addPlannedGame(input, order) {
    const newIndex = order.ids.indexOf("new");
    if (newIndex < 0) throw new Error("Plan order must contain the slot for the new game");
    const db = await initDb();
    await runBatch(db, [
      resetPlanPositions(order.platform),
      insertGameStatement({
        ...input,
        platform: order.platform,
        status: "pending",
        position: newIndex + 1,
        completedOrder: null,
        completedAt: null,
        rating: null,
        review: null,
      }),
      ...order.ids.flatMap((id, index) => (id === "new" ? [] : [positionStatement(id, index + 1)])),
    ]);
  },

  async addCompletedGame(input) {
    const db = await initDb();
    await db.execute(insertCompletedGameStatement(input));
  },

  async updateGame(id, patch) {
    const query = updateGameQuery(id, patch);
    if (!query) return;
    const db = await initDb();
    await db.execute(query.sql, query.values);
  },

  async deleteGame(id, planOrder) {
    const db = await initDb();
    await runBatch(db, [deleteGameStatement(id), ...planOrderStatements(planOrder.ids, planOrder.platform)]);
  },

  async setPlanOrder(planOrder) {
    const db = await initDb();
    await runBatch(db, planOrderStatements(planOrder.ids, planOrder.platform));
  },

  async finishGame(id, input, planOrder) {
    const db = await initDb();
    const nextId = planOrder.ids[0];
    await runBatch(db, [
      finishGameStatement(id, input),
      ...planOrderStatements(planOrder.ids, planOrder.platform),
      ...(input.nextStartDate ? [upsertSetting("start_date", input.nextStartDate)] : []),
      ...(input.startNext && nextId !== undefined ? [startGameStatement(nextId)] : []),
    ]);
  },

  async setCompletedOrder(ids) {
    const db = await initDb();
    await runBatch(db, completedOrderStatements(ids));
  },

  async replaceAll(backup) {
    const db = await initDb();
    await runBatch(db, [
      DELETE_ALL_GAMES,
      ...backup.games.map(insertGameWithIdStatement),
      ...settingsStatements(backup.settings),
      upsertSetting("seeded", "1"),
    ]);
  },
};
