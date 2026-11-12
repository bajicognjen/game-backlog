import type Database from "@tauri-apps/plugin-sql";
import { getDb } from "./client";
import {
  DELETE_ALL_GAMES,
  completedOrderStatements,
  deleteGameStatement,
  dropGameStatement,
  finishGameStatement,
  insertCompletedGameStatement,
  insertGameStatement,
  insertGameWithIdStatement,
  listGames,
  planOrderStatements,
  positionStatement,
  resetPlanPositions,
  restoreGameStatement,
  startGameStatement,
  updateGameQuery,
} from "./games";
import type { Repository, Snapshot } from "./repository";
import { ensureSeeded } from "./seed";
import {
  DELETE_ALL_SESSIONS,
  deleteSessionStatement,
  deleteSessionsOfGameStatement,
  deleteSessionsStatement,
  insertSessionStatement,
  insertSessionWithIdStatement,
  listSessions,
} from "./sessions";
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
    const [settings, games, sessions] = await Promise.all([loadSettings(), listGames(), listSessions()]);
    return { settings, games, sessions };
  },

  saveSettings,

  async addPlannedGame(input, order) {
    const newIndex = order.ids.indexOf("new");
    if (newIndex < 0) throw new Error("Plan order must contain the slot for the new game");
    const db = await initDb();
    await runBatch(db, [
      resetPlanPositions(order.plan),
      insertGameStatement({
        ...input,
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
    await runBatch(db, [
      deleteSessionsOfGameStatement(id),
      deleteGameStatement(id),
      ...planOrderStatements(planOrder.ids, planOrder.plan),
    ]);
  },

  async setPlanOrder(planOrder) {
    const db = await initDb();
    await runBatch(db, planOrderStatements(planOrder.ids, planOrder.plan));
  },

  async finishGame(id, input, planOrder) {
    const db = await initDb();
    const nextId = planOrder.ids[0];
    await runBatch(db, [
      finishGameStatement(id, input),
      ...planOrderStatements(planOrder.ids, planOrder.plan),
      ...(input.nextStartDate ? [upsertSetting("start_date", input.nextStartDate)] : []),
      ...(input.startNext && nextId !== undefined ? [startGameStatement(nextId)] : []),
    ]);
  },

  async setCompletedOrder(ids) {
    const db = await initDb();
    await runBatch(db, completedOrderStatements(ids));
  },

  async dropGame(id, droppedAt, planOrder) {
    const db = await initDb();
    await runBatch(db, [dropGameStatement(id, droppedAt), ...planOrderStatements(planOrder.ids, planOrder.plan)]);
  },

  async replaceAll(backup) {
    const db = await initDb();
    await runBatch(db, [
      DELETE_ALL_SESSIONS,
      DELETE_ALL_GAMES,
      ...backup.games.map(insertGameWithIdStatement),
      ...backup.sessions.map(insertSessionWithIdStatement),
      ...settingsStatements(backup.settings),
      upsertSetting("seeded", "1"),
    ]);
  },

  async addSession(input) {
    const db = await initDb();
    await db.execute(insertSessionStatement(input));
  },

  async reinsertGame(game, sessions, planOrder, completedOrder) {
    const db = await initDb();
    await runBatch(db, [
      insertGameWithIdStatement({ ...game, position: null, completedOrder: null }),
      ...sessions.map(insertSessionWithIdStatement),
      ...(planOrder ? planOrderStatements(planOrder.ids, planOrder.plan) : []),
      ...(completedOrder ? completedOrderStatements(completedOrder) : []),
    ]);
  },

  async restoreGame(game, planOrder, completedOrder) {
    const db = await initDb();
    await runBatch(db, [
      restoreGameStatement(game),
      ...(planOrder ? planOrderStatements(planOrder.ids, planOrder.plan) : []),
      ...(completedOrder ? completedOrderStatements(completedOrder) : []),
    ]);
  },

  async deleteSession(id) {
    const db = await initDb();
    await db.execute(deleteSessionStatement(id));
  },

  async addSessions(inputs) {
    if (inputs.length === 0) return;
    const db = await initDb();
    await runBatch(db, inputs.map(insertSessionStatement));
  },

  async deleteSessions(ids) {
    if (ids.length === 0) return;
    const db = await initDb();
    await db.execute(deleteSessionsStatement(ids));
  },
};
