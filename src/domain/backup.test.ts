import { describe, expect, it } from "vitest";
import { BACKUP_VERSION, BackupError, backupFileName, createBackup, parseBackup, serializeBackup } from "./backup";
import { SEED_SETTINGS, buildSeedGames } from "./seed";
import { computeSchedule } from "./schedule";

function reasonOf(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    if (error instanceof BackupError) return `${error.path}: ${error.reason}`;
    throw error;
  }
  throw new Error("expected a BackupError");
}

describe("createBackup / serializeBackup / parseBackup", () => {
  it("round-trips the seed data exactly", () => {
    const games = buildSeedGames();
    const backup = createBackup(games, SEED_SETTINGS, new Date("2026-11-04T10:00:00Z"));
    expect(backup.version).toBe(BACKUP_VERSION);
    expect(backup.exportedAt).toBe("2026-11-04T10:00:00.000Z");

    const parsed = parseBackup(serializeBackup(backup));
    expect(parsed.settings).toEqual(SEED_SETTINGS);
    expect(parsed.games).toHaveLength(37);
    expect(parsed.games.map((g) => g.id).sort((a, b) => a - b)).toEqual(games.map((g) => g.id).sort((a, b) => a - b));
    expect(computeSchedule(parsed.games, parsed.settings).totals.hours).toBe(901);
    expect(parsed.games.filter((g) => g.status === "completed")).toHaveLength(10);
  });

  it("writes planned games first, then completed, as readable JSON", () => {
    const text = serializeBackup(createBackup(buildSeedGames(), SEED_SETTINGS));
    expect(text.startsWith("{\n  \"app\": \"game-backlog\"")).toBe(true);
    const titles = (JSON.parse(text) as { games: { title: string }[] }).games.map((g) => g.title);
    expect(titles[0]).toBe("Batman: Arkham Knight");
    expect(titles[26]).toBe("Skyrim");
    expect(titles[27]).toBe("Marvel's Spider-Man");
  });

  it("names the file after the day", () => {
    expect(backupFileName(new Date(2026, 10, 4))).toBe("plan-igara-2026-11-04.json");
  });
});

describe("parseBackup normalisation", () => {
  it("renumbers gaps in positions and keeps statuses as stored", () => {
    const backup = createBackup(buildSeedGames(), SEED_SETTINGS);
    const games = backup.games.map((g) => ({ ...g }));
    games[0].status = "paused";
    games[0].position = 10;
    games[1].position = 3;
    games[2].position = 99;
    for (let i = 3; i < 27; i++) games[i].position = 100 + i;
    const parsed = parseBackup(serializeBackup({ ...backup, games }));
    const planned = parsed.games.filter((g) => g.status !== "completed").sort((a, b) => a.position! - b.position!);
    expect(planned.map((g) => g.title).slice(0, 3)).toEqual([
      "Resident Evil 4 Remake",
      "Batman: Arkham Knight",
      "Assassin's Creed Shadows",
    ]);
    expect(planned[0].status).toBe("pending");
    expect(planned[1].status).toBe("paused");
    expect(planned.map((g) => g.position)).toEqual(planned.map((_, i) => i + 1));
  });

  it("renumbers finish order and clears stray fields", () => {
    const backup = createBackup(buildSeedGames(), SEED_SETTINGS);
    const games = backup.games.map((g) => ({ ...g }));
    const done = games.filter((g) => g.status === "completed");
    done[0].completedOrder = 50;
    done[0].position = 4; // nonsense for a completed game
    const parsed = parseBackup(serializeBackup({ ...backup, games }));
    const completed = parsed.games.filter((g) => g.status === "completed").sort((a, b) => a.completedOrder! - b.completedOrder!);
    expect(completed.map((g) => g.completedOrder)).toEqual(completed.map((_, i) => i + 1));
    expect(completed.every((g) => g.position === null)).toBe(true);
    expect(completed[completed.length - 1].title).toBe("Marvel's Spider-Man");
  });

  it("defaults optional fields", () => {
    const parsed = parseBackup(
      JSON.stringify({
        version: 1,
        settings: { startDate: "2026-11-02", hoursPerWeek: 13 },
        games: [{ id: 1, title: "A", type: "linear", status: "pending" }],
      }),
    );
    expect(parsed.settings.theme).toBe("system");
    expect(parsed.games[0]).toMatchObject({
      casualHours: 0,
      note: null,
      rating: null,
      position: 1,
      status: "pending",
      platform: "pc",
    });
  });

  it("imports a version 1 file as PC games and keeps the PS5 queue separate", () => {
    const v1 = {
      version: 1,
      settings: { startDate: "2026-11-02", hoursPerWeek: 13 },
      games: [
        { id: 1, title: "A", type: "linear", status: "in_progress", position: 1 },
        { id: 2, title: "B", type: "giant", status: "pending", position: 2 },
      ],
    };
    expect(parseBackup(JSON.stringify(v1)).games.every((g) => g.platform === "pc")).toBe(true);

    const v2 = {
      version: 2,
      settings: { startDate: "2026-11-02", hoursPerWeek: 13 },
      games: [
        { id: 1, title: "A", type: "linear", status: "pending", position: 7, platform: "pc" },
        { id: 2, title: "B", type: "giant", status: "pending", position: 9, platform: "ps5" },
        { id: 3, title: "C", type: "giant", status: "pending", position: 3, platform: "ps5" },
      ],
    };
    const parsed = parseBackup(JSON.stringify(v2));
    expect(parsed.games.find((g) => g.id === 1)).toMatchObject({ position: 1, status: "pending", platform: "pc" });
    expect(parsed.games.find((g) => g.id === 3)).toMatchObject({ position: 1, status: "pending", platform: "ps5" });
    expect(parsed.games.find((g) => g.id === 2)).toMatchObject({ position: 2, status: "pending", platform: "ps5" });
    expect(reasonOf(() => parseBackup(JSON.stringify({ ...v2, games: [{ ...v2.games[0], platform: "xbox" }] })))).toBe(
      "games[0].platform: enum",
    );
  });
});

describe("parseBackup rejections", () => {
  const valid = () => {
    const backup = createBackup(buildSeedGames(), SEED_SETTINGS);
    return JSON.parse(serializeBackup(backup)) as Record<string, unknown> & { games: Record<string, unknown>[] };
  };

  it("rejects non-JSON and non-objects", () => {
    expect(reasonOf(() => parseBackup("not json"))).toBe("$: json");
    expect(reasonOf(() => parseBackup("[]"))).toBe("$: type");
  });

  it("rejects unsupported versions", () => {
    const data = valid();
    data.version = 99;
    expect(reasonOf(() => parseBackup(JSON.stringify(data)))).toBe("version: version");
  });

  it("rejects bad settings", () => {
    const data = valid();
    (data.settings as Record<string, unknown>).hoursPerWeek = 0;
    expect(reasonOf(() => parseBackup(JSON.stringify(data)))).toBe("settings.hoursPerWeek: range");
    (data.settings as Record<string, unknown>).hoursPerWeek = 13;
    (data.settings as Record<string, unknown>).startDate = "02.11.2026";
    expect(reasonOf(() => parseBackup(JSON.stringify(data)))).toBe("settings.startDate: date");
  });

  it("rejects bad games with the offending path", () => {
    const data = valid();
    data.games[3].type = "rpg";
    expect(reasonOf(() => parseBackup(JSON.stringify(data)))).toBe("games[3].type: enum");
    data.games[3].type = "giant";
    data.games[3].rating = 11;
    expect(reasonOf(() => parseBackup(JSON.stringify(data)))).toBe("games[3].rating: range");
    data.games[3].rating = null;
    data.games[3].completedAt = "2026-13-01";
    expect(reasonOf(() => parseBackup(JSON.stringify(data)))).toBe("games[3].completedAt: date");
    data.games[3].completedAt = null;
    data.games[3].title = "   ";
    expect(reasonOf(() => parseBackup(JSON.stringify(data)))).toBe("games[3].title: missing");
    data.games[3].title = "ok";
    data.games[4].id = data.games[3].id;
    expect(reasonOf(() => parseBackup(JSON.stringify(data)))).toBe("games[4].id: duplicate");
  });
});
