/// <reference types="node" />
/**
 * Runs the SQL the app generates against a real SQLite database (node:sqlite)
 * using the same migration file the Rust side applies. This covers what the
 * in-memory repository cannot: the unique position index, the CHECK
 * constraints and the batched reorder statements.
 */
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { NO_METADATA, buildSeedGames } from "../domain/seed";
import { createBackup, parseBackup, serializeBackup } from "../domain/backup";
import { SEED_SETTINGS } from "../domain/seed";
import {
  DELETE_ALL_GAMES,
  completedOrderStatements,
  deleteGameStatement,
  dropGameStatement,
  finishGameStatement,
  insertCompletedGameStatement,
  insertGameStatement,
  insertGameWithIdStatement,
  planOrderStatements,
  positionStatement,
  resetPlanPositions,
  restoreGameStatement,
  startGameStatement,
  updateGameQuery,
} from "./games";
import {
  deleteSessionStatement,
  deleteSessionsOfGameStatement,
  deleteSessionsStatement,
  insertSessionStatement,
  insertSessionWithIdStatement,
} from "./sessions";
import { settingsStatements, upsertSetting } from "./settings";
import { lit } from "./sql";

const MIGRATIONS = [
  "0001_initial.sql",
  "0002_platform.sql",
  "0003_paused_status.sql",
  "0004_genre.sql",
  "0005_rawg_and_dropped.sql",
  "0006_provider.sql",
  "0007_play_sessions.sql",
  "0008_series.sql",
  "0009_details.sql",
  "0010_design.sql",
  "0011_together.sql",
].map((file) =>
  readFileSync(new URL(`../../src-tauri/migrations/${file}`, import.meta.url), "utf8"),
);

interface Row {
  id: number;
  title: string;
  status: string;
  platform: string;
  position: number | null;
  casual_hours: number;
  note: string | null;
}

interface CompletedRow {
  id: number;
  title: string;
  completed_order: number | null;
  completed_at: string | null;
  rating: number | null;
  review: string | null;
}

let db: DatabaseSync;

function batch(statements: readonly string[]): void {
  db.exec(["BEGIN;", ...statements.map((s) => (s.trim().endsWith(";") ? s : `${s};`)), "COMMIT;"].join("\n"));
}

function completed(): CompletedRow[] {
  return db
    .prepare(
      "SELECT id, title, completed_order, completed_at, rating, review FROM games WHERE status IN ('completed', 'dropped') ORDER BY completed_order",
    )
    .all() as unknown as CompletedRow[];
}

/** One platform's plan: its games not played together. */
function plan(platform = "pc"): Row[] {
  return db
    .prepare(
      "SELECT id, title, status, platform, position, casual_hours, note FROM games WHERE status NOT IN ('completed', 'dropped') AND platform = ? AND together = 0 ORDER BY position",
    )
    .all(platform) as unknown as Row[];
}

/** The Together list, whatever the platform. */
function togetherList(): Row[] {
  return db
    .prepare(
      "SELECT id, title, status, platform, position, casual_hours, note FROM games WHERE status NOT IN ('completed', 'dropped') AND together = 1 ORDER BY position",
    )
    .all() as unknown as Row[];
}

beforeEach(() => {
  db = new DatabaseSync(":memory:");
  for (const migration of MIGRATIONS) db.exec(migration);
  batch(buildSeedGames().map(insertGameStatement));
});

describe("seed through the real schema", () => {
  it("inserts 27 planned and 10 completed games with contiguous positions", () => {
    const rows = plan();
    expect(rows).toHaveLength(27);
    expect(rows.map((r) => r.position)).toEqual(rows.map((_, i) => i + 1));
    expect(rows[0]).toMatchObject({ title: "Batman: Arkham Knight", status: "in_progress" });
    const completed = db.prepare("SELECT COUNT(*) AS n FROM games WHERE status = 'completed'").get() as { n: number };
    expect(completed.n).toBe(10);
  });

  it("escapes quotes and keeps unicode", () => {
    const row = db.prepare("SELECT title, note FROM games WHERE title LIKE 'Assassin%'").get() as unknown as Row;
    expect(row.title).toBe("Assassin's Creed Shadows");
    expect(row.note).toBe("Main story ~35–40h, don't clear the whole map");
    expect(lit("it's")).toBe("'it''s'");
  });
});

describe("plan order statements", () => {
  it("reorders without tripping the unique position index", () => {
    const ids = plan().map((r) => r.id);
    const moved = [ids[2], ...ids.slice(0, 2), ...ids.slice(3)]; // third game to the top
    batch(planOrderStatements(moved, "pc"));
    const rows = plan();
    expect(rows.map((r) => r.id)).toEqual(moved);
    expect(rows.map((r) => r.position)).toEqual(moved.map((_, i) => i + 1));
    expect(rows[0]).toMatchObject({ title: "Assassin's Creed Shadows", status: "pending" });
    expect(rows[1]).toMatchObject({ title: "Batman: Arkham Knight", status: "in_progress" });
  });

  it("inserts a new game at a chosen slot", () => {
    const ids = plan().map((r) => r.id);
    const order: (number | "new")[] = [ids[0], "new", ...ids.slice(1)];
    batch([
      resetPlanPositions("pc"),
      insertGameStatement({
        title: "Hades",
        type: "roguelike",
        genre: "roguelike",
        platform: "pc",
        together: false,
        status: "pending",
        casualHours: 12.5,
        series: null,
        seriesOrder: null,
        note: null,
        position: 2,
        completedOrder: null,
        completedAt: null,
        rating: null,
        review: null,
        ...NO_METADATA,
      }),
      ...order.flatMap((id, i) => (id === "new" ? [] : [positionStatement(id, i + 1)])),
    ]);
    const rows = plan();
    expect(rows).toHaveLength(28);
    expect(rows[1]).toMatchObject({ title: "Hades", position: 2, status: "pending", casual_hours: 12.5 });
    expect(rows[2]).toMatchObject({ title: "Resident Evil 4 Remake", position: 3 });
  });

  it("deletes a game and closes the gap", () => {
    const ids = plan().map((r) => r.id);
    batch([deleteGameStatement(ids[0]), ...planOrderStatements(ids.slice(1), "pc")]);
    const rows = plan();
    expect(rows).toHaveLength(26);
    expect(rows[0]).toMatchObject({ title: "Resident Evil 4 Remake", position: 1, status: "pending" });
    expect(rows.map((r) => r.position)).toEqual(rows.map((_, i) => i + 1));
  });

  it("rolls the whole batch back when one statement fails", () => {
    const ids = plan().map((r) => r.id);
    const before = JSON.stringify(plan());
    expect(() =>
      batch([...planOrderStatements(ids.slice().reverse(), "pc"), "INSERT INTO games (title, type, status) VALUES ('x', 'bogus', 'pending')"]),
    ).toThrow(/CHECK/);
    db.exec("ROLLBACK;");
    expect(JSON.stringify(plan())).toBe(before);
  });
});

describe("updateGameQuery", () => {
  it("updates only the given fields with positional parameters", () => {
    const first = plan()[0];
    const query = updateGameQuery(first.id, { casualHours: 30, note: "new note" });
    expect(query).not.toBeNull();
    db.prepare(query!.sql).run(...(query!.values as (string | number | null)[]));
    const row = db.prepare("SELECT title, casual_hours, note FROM games WHERE id = ?").get(first.id) as unknown as Row;
    expect(row).toMatchObject({ title: "Batman: Arkham Knight", casual_hours: 30, note: "new note" });
  });

  it("returns null for an empty patch", () => {
    expect(updateGameQuery(1, {})).toBeNull();
  });

  it("bumps updated_at through the trigger", () => {
    const first = plan()[0];
    db.exec(`UPDATE games SET updated_at = '2000-01-01 00:00:00' WHERE id = ${first.id}`);
    const query = updateGameQuery(first.id, { title: "Batman" })!;
    db.prepare(query.sql).run(...(query.values as (string | number | null)[]));
    const row = db.prepare("SELECT updated_at FROM games WHERE id = ?").get(first.id) as { updated_at: string };
    expect(row.updated_at).not.toBe("2000-01-01 00:00:00");
  });
});

describe("finishing and rating", () => {
  it("moves the current game to the end of the completed list and advances the plan", () => {
    const ids = plan().map((r) => r.id);
    batch([
      finishGameStatement(ids[0], { completedAt: "2026-11-15", rating: 8, review: "Great" }),
      ...planOrderStatements(ids.slice(1), "pc"),
      upsertSetting("start_date", "2026-11-16"),
      startGameStatement(ids[1]),
    ]);
    const done = completed();
    expect(done).toHaveLength(11);
    expect(done[10]).toMatchObject({
      title: "Batman: Arkham Knight",
      completed_order: 11,
      completed_at: "2026-11-15",
      rating: 8,
      review: "Great",
    });
    const rows = plan();
    expect(rows).toHaveLength(26);
    expect(rows[0]).toMatchObject({ title: "Resident Evil 4 Remake", position: 1, status: "in_progress" });
    const setting = db.prepare("SELECT value FROM settings WHERE key = 'start_date'").get() as unknown as { value: string };
    expect(setting.value).toBe("2026-11-16");
  });

  it("adds a previously finished game at the end of the completed list", () => {
    db.exec(
      insertCompletedGameStatement({
        title: "Portal 2",
        type: "linear",
        genre: "puzzle",
        platform: "ps4",
        together: false,
        casualHours: 8,
        series: "Portal",
        seriesOrder: 2,
        note: null,
        completedAt: null,
        rating: 10,
        review: null,
        ...NO_METADATA,
      }),
    );
    const done = completed();
    expect(done[done.length - 1]).toMatchObject({ title: "Portal 2", completed_order: 11, completed_at: null, rating: 10 });
    const row = db.prepare("SELECT platform FROM games WHERE title = 'Portal 2'").get() as unknown as { platform: string };
    expect(row.platform).toBe("ps4");
    expect(plan()).toHaveLength(27);
  });

  it("rates and un-rates a completed game", () => {
    const target = completed()[0];
    const rate = updateGameQuery(target.id, { rating: 9, review: "Super" })!;
    db.prepare(rate.sql).run(...(rate.values as (string | number | null)[]));
    expect(completed()[0]).toMatchObject({ rating: 9, review: "Super" });

    const clear = updateGameQuery(target.id, { rating: null, review: null })!;
    db.prepare(clear.sql).run(...(clear.values as (string | number | null)[]));
    expect(completed()[0]).toMatchObject({ rating: null, review: null });
  });

  it("rejects ratings outside 1–10", () => {
    const target = completed()[0];
    const bad = updateGameQuery(target.id, { rating: 11 })!;
    expect(() => db.prepare(bad.sql).run(...(bad.values as (string | number | null)[]))).toThrow(/CHECK/);
  });
});

describe("backup restore", () => {
  it("replaces all games and settings in one batch, keeping ids", () => {
    const before = buildSeedGames();
    const backup = parseBackup(serializeBackup(createBackup(before, { ...SEED_SETTINGS, hoursPerWeek: 20 })));
    // Make the restored data distinguishable: drop one game, rate another.
    backup.games = backup.games.filter((g) => g.title !== "Skyrim").map((g) => (g.title === "GTA 3" ? { ...g, rating: 6 } : g));

    batch([
      DELETE_ALL_GAMES,
      ...backup.games.map(insertGameWithIdStatement),
      ...settingsStatements(backup.settings),
      upsertSetting("seeded", "1"),
    ]);

    const rows = plan();
    expect(rows).toHaveLength(26);
    expect(rows.map((r) => r.position)).toEqual(rows.map((_, i) => i + 1));
    expect(rows[0]).toMatchObject({ id: 1, title: "Batman: Arkham Knight", status: "in_progress" });
    expect(completed().find((r) => r.title === "GTA 3")).toMatchObject({ rating: 6 });
    const hours = db.prepare("SELECT value FROM settings WHERE key = 'hours_per_week'").get() as unknown as { value: string };
    expect(hours.value).toBe("20");
    const seeded = db.prepare("SELECT value FROM settings WHERE key = 'seeded'").get() as unknown as { value: string };
    expect(seeded.value).toBe("1");
  });

  it("keeps the old data when the restore batch fails", () => {
    const before = JSON.stringify(plan());
    expect(() =>
      batch([DELETE_ALL_GAMES, "INSERT INTO games (id, title, type, status) VALUES (1, 'x', 'bogus', 'pending')"]),
    ).toThrow(/CHECK/);
    db.exec("ROLLBACK;");
    expect(JSON.stringify(plan())).toBe(before);
  });
});

describe("platforms", () => {
  function addPs5(title: string, position: number): void {
    db.exec(
      insertGameStatement({
        title,
        type: "linear",
        genre: null,
        platform: "ps5",
        together: false,
        status: position === 1 ? "in_progress" : "pending",
        casualHours: 0,
        series: null,
        seriesOrder: null,
        note: null,
        position,
        completedOrder: null,
        completedAt: null,
        rating: null,
        review: null,
        ...NO_METADATA,
      }),
    );
  }

  it("defaults existing rows to PC and allows the same position on another platform", () => {
    expect(plan().every((r) => r.platform === "pc")).toBe(true);
    addPs5("Astro Bot", 1); // PC already has position 1
    addPs5("Spider-Man 2", 2);
    expect(plan("ps5").map((r) => r.title)).toEqual(["Astro Bot", "Spider-Man 2"]);
    expect(() => addPs5("Duplicate", 1)).toThrow(/UNIQUE/);
    expect(() => db.exec("UPDATE games SET platform = 'xbox' WHERE title = 'Astro Bot'")).toThrow(/CHECK/);
  });

  it("reorders one platform without touching the other", () => {
    addPs5("Astro Bot", 1);
    addPs5("Spider-Man 2", 2);
    const ps5 = plan("ps5").map((r) => r.id);
    batch(planOrderStatements([ps5[1], ps5[0]], "ps5"));
    expect(plan("ps5").map((r) => [r.title, r.position, r.status])).toEqual([
      ["Spider-Man 2", 1, "pending"],
      ["Astro Bot", 2, "in_progress"],
    ]);
    expect(plan()[0]).toMatchObject({ title: "Batman: Arkham Knight", position: 1, status: "in_progress" });
    expect(plan()).toHaveLength(27);
  });

  it("finishing a PS5 game leaves the PC plan and start date alone", () => {
    addPs5("Astro Bot", 1);
    addPs5("Spider-Man 2", 2);
    const ps5 = plan("ps5").map((r) => r.id);
    batch([finishGameStatement(ps5[0], { completedAt: "2026-11-20", rating: 9, review: null }), ...planOrderStatements(ps5.slice(1), "ps5")]);
    expect(plan("ps5").map((r) => [r.title, r.status])).toEqual([["Spider-Man 2", "pending"]]);
    expect(plan()).toHaveLength(27);
    const done = completed();
    expect(done[done.length - 1]).toMatchObject({ title: "Astro Bot", completed_order: 11 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM settings WHERE key = 'start_date'").get()).toMatchObject({ n: 0 });
  });
});

describe("together list", () => {
  function addTogether(title: string, platform: "pc" | "ps5", position: number): void {
    db.exec(
      insertGameStatement({
        title,
        type: "linear",
        genre: null,
        platform,
        together: true,
        status: "pending",
        casualHours: 12,
        series: null,
        seriesOrder: null,
        note: null,
        position,
        completedOrder: null,
        completedAt: null,
        rating: null,
        review: null,
        ...NO_METADATA,
      }),
    );
  }

  it("keeps existing games out of it and numbers it apart from the PC plan, across platforms", () => {
    expect(togetherList()).toEqual([]);
    addTogether("It Takes Two", "pc", 1); // the PC plan already has position 1
    addTogether("Split Fiction", "ps5", 2);
    expect(togetherList().map((r) => [r.title, r.platform, r.position])).toEqual([
      ["It Takes Two", "pc", 1],
      ["Split Fiction", "ps5", 2],
    ]);
    expect(plan()).toHaveLength(27);
    expect(() => addTogether("Duplicate", "ps5", 1)).toThrow(/UNIQUE/);
    expect(() => db.exec("UPDATE games SET together = 2 WHERE title = 'It Takes Two'")).toThrow(/CHECK/);
  });

  it("reorders the PC plan without touching the Together list", () => {
    addTogether("It Takes Two", "pc", 1);
    addTogether("Remnant II", "pc", 2);
    const pc = plan().map((r) => r.id);
    batch(planOrderStatements([pc[1], pc[0], ...pc.slice(2)], "pc"));
    expect(togetherList().map((r) => [r.title, r.position])).toEqual([
      ["It Takes Two", 1],
      ["Remnant II", 2],
    ]);
    expect(plan()[0]).toMatchObject({ title: "Resident Evil 4 Remake", position: 1 });
  });

  it("moves a game between its plan and the Together list without tripping the index", () => {
    addTogether("It Takes Two", "pc", 1);
    const pc = plan().map((r) => r.id);
    const forest = pc[5]; // position 6 in the PC plan
    // Into Together: clear the slot in the same update, close the gap, append.
    const into = updateGameQuery(forest, { together: true, position: null });
    if (!into) throw new Error("expected a query");
    db.prepare(into.sql).run(...(into.values as (string | number | null)[]));
    batch(planOrderStatements(pc.filter((id) => id !== forest), "pc"));
    const list = togetherList().map((r) => r.id).filter((id) => id !== forest);
    batch(planOrderStatements([...list, forest], "together"));
    expect(togetherList().map((r) => [r.title, r.position])).toEqual([
      ["It Takes Two", 1],
      ["The Forest", 2],
    ]);
    expect(plan()).toHaveLength(26);
    expect(plan().map((r) => r.position)).toEqual(Array.from({ length: 26 }, (_, i) => i + 1));

    // And back to slot 1 of the PC plan, which is taken.
    const back = updateGameQuery(forest, { together: false, position: null });
    if (!back) throw new Error("expected a query");
    db.prepare(back.sql).run(...(back.values as (string | number | null)[]));
    batch(planOrderStatements(togetherList().map((r) => r.id).filter((id) => id !== forest), "together"));
    batch(planOrderStatements([forest, ...plan().map((r) => r.id).filter((id) => id !== forest)], "pc"));
    expect(plan()[0]).toMatchObject({ title: "The Forest", position: 1 });
    expect(togetherList().map((r) => [r.title, r.position])).toEqual([["It Takes Two", 1]]);
  });

  it("finishing a Together game leaves the PC plan and start date alone", () => {
    addTogether("It Takes Two", "pc", 1);
    addTogether("Remnant II", "pc", 2);
    const list = togetherList().map((r) => r.id);
    batch([finishGameStatement(list[0], { completedAt: "2026-11-20", rating: 9, review: null }), ...planOrderStatements(list.slice(1), "together")]);
    expect(togetherList().map((r) => [r.title, r.position])).toEqual([["Remnant II", 1]]);
    expect(plan()).toHaveLength(27);
    expect(plan()[0]).toMatchObject({ title: "Batman: Arkham Knight", status: "in_progress" });
    expect(db.prepare("SELECT together FROM games WHERE id = ?").get(list[0])).toMatchObject({ together: 1 });
  });
});

describe("statuses and finish order", () => {
  it("accepts the paused status after the rebuild migration and keeps data and ids", () => {
    const first = plan()[0];
    expect(first).toMatchObject({ id: 1, title: "Batman: Arkham Knight", status: "in_progress" });
    const pause = updateGameQuery(first.id, { status: "paused" })!;
    db.prepare(pause.sql).run(...(pause.values as (string | number | null)[]));
    expect(plan()[0]).toMatchObject({ id: 1, status: "paused", position: 1 });
    expect(() => db.exec("UPDATE games SET status = 'bogus' WHERE id = 1")).toThrow(/CHECK/);
    const seq = db.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'games'").get() as unknown as { seq: number };
    expect(seq.seq).toBe(37);
    expect(completed()).toHaveLength(10);
  });

  it("keeps the trigger after the rebuild", () => {
    db.exec("UPDATE games SET updated_at = '2000-01-01 00:00:00' WHERE id = 2");
    db.exec("UPDATE games SET note = 'x' WHERE id = 2");
    const row = db.prepare("SELECT updated_at FROM games WHERE id = 2").get() as unknown as { updated_at: string };
    expect(row.updated_at).not.toBe("2000-01-01 00:00:00");
  });

  it("start only touches planned games", () => {
    db.exec(startGameStatement(completed()[0].id));
    expect(completed()[0]).toMatchObject({ title: "Marvel's Spider-Man" });
    expect(db.prepare("SELECT status FROM games WHERE id = ?").get(completed()[0].id)).toMatchObject({ status: "completed" });
  });

  it("renumbers the finish order on drag and drop", () => {
    const ids = completed().map((r) => r.id);
    batch(completedOrderStatements([ids[9], ...ids.slice(0, 9)]));
    const done = completed();
    expect(done[0]).toMatchObject({ title: "Ori and the Blind Forest DE", completed_order: 1 });
    expect(done[1]).toMatchObject({ title: "Marvel's Spider-Man", completed_order: 2 });
    expect(done.map((r) => r.completed_order)).toEqual(done.map((_, i) => i + 1));
    expect(plan()).toHaveLength(27);
  });
});

describe("genre", () => {
  it("stores the genre from the seed and the Hades insert", () => {
    const witcher = db.prepare("SELECT genre FROM games WHERE title = 'The Witcher 3'").get() as unknown as { genre: string };
    expect(witcher.genre).toBe("rpg");
    const update = updateGameQuery(plan()[0].id, { genre: "stealth" })!;
    db.prepare(update.sql).run(...(update.values as (string | number | null)[]));
    expect(db.prepare("SELECT genre FROM games WHERE id = ?").get(plan()[0].id)).toMatchObject({ genre: "stealth" });
    const clear = updateGameQuery(plan()[0].id, { genre: null })!;
    db.prepare(clear.sql).run(...(clear.values as (string | number | null)[]));
    expect(db.prepare("SELECT genre FROM games WHERE id = ?").get(plan()[0].id)).toMatchObject({ genre: null });
  });

  it("backfills genres for seed titles that were stored before the column existed", () => {
    // Simulate an old database: run migrations 1–3, insert the seed without a genre, then migrate.
    const old = new DatabaseSync(":memory:");
    for (const migration of MIGRATIONS.slice(0, 3)) old.exec(migration);
    const insert = old.prepare(
      "INSERT INTO games (title, type, platform, status, casual_hours, position, completed_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    for (const game of buildSeedGames()) {
      // Designs came with migration 10; the old schema only knows these two of them.
      const type = game.type === "open_world" ? "open_world" : "linear";
      insert.run(game.title, type, game.platform, game.status, game.casualHours, game.position, game.completedOrder);
    }
    expect(old.prepare("SELECT COUNT(*) AS n FROM games").get()).toMatchObject({ n: 37 });
    old.exec(MIGRATIONS[3]);
    const filled = old.prepare("SELECT COUNT(*) AS n FROM games WHERE genre IS NOT NULL").get() as unknown as { n: number };
    expect(filled.n).toBe(37);
    expect(old.prepare("SELECT genre FROM games WHERE title = 'Assassin''s Creed Shadows'").get()).toMatchObject({
      genre: "action_adventure",
    });
  });
});

describe("dropped status and RAWG metadata", () => {
  it("drops a planned game into the finished list and closes the gap", () => {
    const ids = plan().map((r) => r.id);
    batch([dropGameStatement(ids[0], "2026-11-05"), ...planOrderStatements(ids.slice(1), "pc")]);
    expect(plan()).toHaveLength(26);
    expect(plan()[0]).toMatchObject({ title: "Resident Evil 4 Remake", position: 1 });
    const row = db
      .prepare("SELECT status, position, completed_order, completed_at, rating FROM games WHERE id = ?")
      .get(ids[0]) as unknown as Record<string, unknown>;
    expect(row).toMatchObject({ status: "dropped", position: null, completed_order: 11, completed_at: "2026-11-05", rating: null });
    expect(() => db.exec(startGameStatement(ids[0]))).not.toThrow();
    expect(db.prepare("SELECT status FROM games WHERE id = ?").get(ids[0])).toMatchObject({ status: "dropped" });
  });

  it("stores and reads RAWG metadata as JSON lists", () => {
    const stmt = insertGameStatement({
      title: "The Witcher 3: Wild Hunt",
      type: "open_world",
      genre: "rpg",
      platform: "ps5",
      together: false,
      status: "pending",
      casualHours: 46,
      series: "The Witcher",
      seriesOrder: 3,
      note: null,
      position: 1,
      completedOrder: null,
      completedAt: null,
      rating: null,
      review: null,
      source: "igdb",
      externalId: 3328,
      coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/x.jpg",
      releaseDate: "2015-05-18",
      providerGenres: ["Action", "RPG"],
      providerTags: ["Singleplayer", "Open World"],
      details: {
        summary: "Geralt.",
        platforms: ["PC (Microsoft Windows)"],
        userRating: 93.4,
        criticRating: 91,
        developers: ["CD PROJEKT RED"],
        publishers: [],
        screenshots: [],
        videos: [{ id: "c0i88t0Kacs", name: "Trailer" }],
        similarGames: [],
        franchises: ["The Witcher"],
        collection: "The Witcher",
        storeLinks: [{ store: "Steam", url: "https://store.steampowered.com/app/292030" }],
        keywords: ["open world"],
        fetchedAt: "2026-11-04T12:00:00.000Z",
      },
    });
    db.exec(stmt);
    const row = db
      .prepare("SELECT source, external_id, cover_url, release_date, provider_genres, provider_tags, details FROM games WHERE external_id = 3328")
      .get() as unknown as Record<string, unknown>;
    expect(JSON.parse(row.details as string)).toMatchObject({ collection: "The Witcher", userRating: 93.4, videos: [{ id: "c0i88t0Kacs" }] });
    expect(row).toMatchObject({
      source: "igdb",
      external_id: 3328,
      release_date: "2015-05-18",
      provider_genres: '["Action","RPG"]',
      provider_tags: '["Singleplayer","Open World"]',
    });
    const id = (db.prepare("SELECT id FROM games WHERE external_id = 3328").get() as unknown as { id: number }).id;
    const unlink = updateGameQuery(id, { source: null, externalId: null, coverUrl: null, releaseDate: null, providerGenres: [], providerTags: [], details: null })!;
    db.prepare(unlink.sql).run(...(unlink.values as (string | number | null)[]));
    expect(db.prepare("SELECT source, external_id, provider_tags, details FROM games WHERE id = ?").get(id)).toMatchObject({
      source: null,
      external_id: null,
      provider_tags: "[]",
      details: null,
    });
  });

  it("keeps every row and id through the second rebuild", () => {
    expect(plan()).toHaveLength(27);
    expect(completed()).toHaveLength(10);
    expect(db.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'games'").get()).toMatchObject({ seq: 37 });
    expect(db.prepare("SELECT provider_genres FROM games WHERE id = 1").get()).toMatchObject({ provider_genres: "[]" });
  });
});

describe("provider migration", () => {
  it("renames the RAWG columns, adds source and backfills it for linked rows", () => {
    const old = new DatabaseSync(":memory:");
    for (const migration of MIGRATIONS.slice(0, 5)) old.exec(migration);
    old.exec(
      "INSERT INTO games (title, type, platform, status, casual_hours, rawg_id, rawg_genres, rawg_tags) VALUES ('Linked', 'linear', 'pc', 'pending', 1, 42, '[\"RPG\"]', '[]')",
    );
    old.exec("INSERT INTO games (title, type, platform, status, casual_hours) VALUES ('Plain', 'linear', 'pc', 'pending', 1)");
    old.exec(MIGRATIONS[5]);
    const rows = old.prepare("SELECT title, source, external_id, provider_genres FROM games ORDER BY id").all() as unknown as Record<string, unknown>[];
    expect(rows).toEqual([
      { title: "Linked", source: "rawg", external_id: 42, provider_genres: '["RPG"]' },
      { title: "Plain", source: null, external_id: null, provider_genres: "[]" },
    ]);
  });
});

describe("play sessions", () => {
  const hoursPlayed = (id: number) =>
    (
      db
        .prepare("SELECT COALESCE((SELECT SUM(hours) FROM play_sessions WHERE game_id = ?), 0) AS h")
        .get(id) as unknown as { h: number }
    ).h;

  it("logs, sums and deletes sessions", () => {
    const batman = plan()[0].id;
    db.exec(insertSessionStatement({ gameId: batman, playedOn: "2026-11-03", hours: 2.5, note: null }));
    db.exec(insertSessionStatement({ gameId: batman, playedOn: "2026-11-04", hours: 3, note: "boss" }));
    expect(hoursPlayed(batman)).toBe(5.5);
    const first = (db.prepare("SELECT id FROM play_sessions ORDER BY id").get() as unknown as { id: number }).id;
    db.exec(deleteSessionStatement(first));
    expect(hoursPlayed(batman)).toBe(3);
    expect(() => db.exec(insertSessionStatement({ gameId: batman, playedOn: "2026-11-05", hours: 0, note: null }))).toThrow(/CHECK/);
  });

  it("imports sessions in one batch and undoes exactly those", () => {
    const [batman, re4] = plan().map((r) => r.id);
    const ids = () => (db.prepare("SELECT id FROM play_sessions ORDER BY id").all() as unknown as { id: number }[]).map((r) => r.id);
    db.exec(insertSessionStatement({ gameId: batman, playedOn: "2026-11-01", hours: 2, note: "by hand" }));
    const before = new Set(ids());
    batch([
      insertSessionStatement({ gameId: batman, playedOn: "2026-11-02", hours: 5, note: "Imported from Steam" }),
      insertSessionStatement({ gameId: re4, playedOn: "2026-11-03", hours: 1.5, note: "Imported from Steam" }),
    ]);
    const imported = ids().filter((id) => !before.has(id));
    expect(imported).toHaveLength(2);
    db.exec(insertSessionStatement({ gameId: re4, playedOn: "2026-11-04", hours: 1, note: "after" }));

    db.exec(deleteSessionsStatement(imported));
    expect(db.prepare("SELECT note FROM play_sessions ORDER BY id").all()).toEqual([{ note: "by hand" }, { note: "after" }]);
    expect(hoursPlayed(batman)).toBe(2);
    // Running it again (ids already gone) changes nothing.
    db.exec(deleteSessionsStatement(imported));
    expect(db.prepare("SELECT COUNT(*) AS n FROM play_sessions").get()).toMatchObject({ n: 2 });
  });

  it("removes a game's sessions with the game", () => {
    const ids = plan().map((r) => r.id);
    db.exec(insertSessionStatement({ gameId: ids[0], playedOn: "2026-11-03", hours: 1, note: null }));
    batch([deleteSessionsOfGameStatement(ids[0]), deleteGameStatement(ids[0]), ...planOrderStatements(ids.slice(1), "pc")]);
    expect(db.prepare("SELECT COUNT(*) AS n FROM play_sessions").get()).toMatchObject({ n: 0 });
  });

  it("restores sessions with their ids", () => {
    const batman = plan()[0].id;
    db.exec(insertSessionWithIdStatement({ id: 42, gameId: batman, playedOn: "2026-11-03", hours: 1.5, note: null }));
    expect(db.prepare("SELECT id, hours FROM play_sessions").get()).toMatchObject({ id: 42, hours: 1.5 });
    expect(() => db.exec(insertSessionWithIdStatement({ id: 43, gameId: 9999, playedOn: "2026-11-03", hours: 1, note: null }))).toThrow(
      /FOREIGN KEY/,
    );
  });
});

describe("series", () => {
  it("stores series fields and the migration backfills known titles", () => {
    const row = db.prepare("SELECT series, series_order FROM games WHERE title = 'GTA Vice City'").get() as unknown as Record<string, unknown>;
    expect(row).toEqual({ series: "GTA", series_order: 2 });
    const update = updateGameQuery(plan()[0].id, { series: "Arkham", seriesOrder: 4 })!;
    db.prepare(update.sql).run(...(update.values as (string | number | null)[]));
    expect(db.prepare("SELECT series, series_order FROM games WHERE id = ?").get(plan()[0].id)).toMatchObject({ series: "Arkham", series_order: 4 });

    const old = new DatabaseSync(":memory:");
    for (const migration of MIGRATIONS.slice(0, 7)) old.exec(migration);
    old.exec("INSERT INTO games (title, type, platform, status, casual_hours) VALUES ('GTA V', 'open_world', 'pc', 'pending', 50)");
    old.exec("INSERT INTO games (title, type, platform, status, casual_hours) VALUES ('Hades', 'linear', 'pc', 'pending', 20)");
    old.exec(MIGRATIONS[7]);
    expect(old.prepare("SELECT series, series_order FROM games WHERE title = 'GTA V'").get()).toMatchObject({ series: "GTA", series_order: 6 });
    expect(old.prepare("SELECT series, series_order FROM games WHERE title = 'Hades'").get()).toMatchObject({ series: null, series_order: null });
  });
});

describe("migration files", () => {
  it("use CRLF line endings, the text installed databases checksummed (see .gitattributes)", () => {
    for (const [i, sql] of MIGRATIONS.entries()) {
      expect(sql.replace(/\r\n/g, ""), `migration ${i + 1}`).not.toContain("\n");
    }
  });
});

describe("design migration", () => {
  it("maps the old types in place and keeps every game, id and session", () => {
    const old = new DatabaseSync(":memory:");
    for (const migration of MIGRATIONS.slice(0, 9)) old.exec(migration);
    const insert = old.prepare("INSERT INTO games (title, type, platform, status, casual_hours, position) VALUES (?, ?, 'pc', 'pending', ?, ?)");
    const types = ["linear", "open_world", "giant", "relaxed", "medium"];
    types.forEach((type, i) => insert.run(`Game ${i + 1}`, type, 10 * (i + 1), i + 1));
    old.exec(insertSessionStatement({ gameId: 3, playedOn: "2026-11-03", hours: 2, note: "kept" }));
    // sqlx runs each migration inside a transaction with foreign keys on; do the same.
    old.exec(`BEGIN;\n${MIGRATIONS[9]}\nCOMMIT;`);

    expect(old.prepare("SELECT id, type FROM games ORDER BY id").all()).toEqual([
      { id: 1, type: "linear" },
      { id: 2, type: "open_world" },
      { id: 3, type: "open_world" },
      { id: 4, type: "linear" },
      { id: 5, type: "semi_open" },
    ]);
    expect(old.prepare("SELECT game_id, hours, note FROM play_sessions").all()).toEqual([{ game_id: 3, hours: 2, note: "kept" }]);
    expect(() => old.exec("UPDATE games SET type = 'giant' WHERE id = 1")).toThrow(/CHECK/);
    expect(() => old.exec("UPDATE games SET position = 2 WHERE id = 1")).toThrow(/UNIQUE/);
    old.exec("UPDATE games SET updated_at = '2000-01-01 00:00:00' WHERE id = 1");
    old.exec("UPDATE games SET title = 'Renamed' WHERE id = 1");
    expect(old.prepare("SELECT updated_at FROM games WHERE id = 1").get()).not.toMatchObject({ updated_at: "2000-01-01 00:00:00" });
  });
});

describe("undo", () => {
  it("reinserts a deleted game with its id and sessions and puts it back in place", () => {
    const ids = plan().map((r) => r.id);
    const target = ids[2];
    const snapshot = db.prepare("SELECT * FROM games WHERE id = ?").get(target) as unknown as Record<string, unknown>;
    db.exec(insertSessionWithIdStatement({ id: 7, gameId: target, playedOn: "2026-11-03", hours: 2, note: null }));
    batch([deleteSessionsOfGameStatement(target), deleteGameStatement(target), ...planOrderStatements(ids.filter((id) => id !== target), "pc")]);
    expect(plan()).toHaveLength(26);

    batch([
      insertGameWithIdStatement({
        id: target,
        title: snapshot.title as string,
        type: "open_world",
        genre: "action_adventure",
        platform: "pc",
        together: false,
        status: "pending",
        casualHours: 55,
        hoursPlayed: 0,
        series: null,
        seriesOrder: null,
        note: null,
        position: null,
        completedOrder: null,
        completedAt: null,
        rating: null,
        review: null,
        ...NO_METADATA,
      }),
      insertSessionWithIdStatement({ id: 7, gameId: target, playedOn: "2026-11-03", hours: 2, note: null }),
      ...planOrderStatements(ids, "pc"),
    ]);
    const rows = plan();
    expect(rows).toHaveLength(27);
    expect(rows[2]).toMatchObject({ id: target, title: "Assassin's Creed Shadows", position: 3 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM play_sessions WHERE game_id = ?").get(target)).toMatchObject({ n: 1 });
  });

  it("restores a dropped game to its old status and slot", () => {
    const ids = plan().map((r) => r.id);
    const before = completed().map((r) => r.id);
    batch([dropGameStatement(ids[0], "2026-11-05"), ...planOrderStatements(ids.slice(1), "pc")]);
    expect(completed()).toHaveLength(11);

    const snapshot = { ...buildSeedGames()[0], id: ids[0] };
    batch([restoreGameStatement(snapshot), ...planOrderStatements(ids, "pc"), ...completedOrderStatements(before)]);
    expect(plan()[0]).toMatchObject({ id: ids[0], status: "in_progress", position: 1 });
    expect(completed()).toHaveLength(10);
    expect(db.prepare("SELECT completed_at, completed_order FROM games WHERE id = ?").get(ids[0])).toMatchObject({
      completed_at: null,
      completed_order: null,
    });
  });
});
