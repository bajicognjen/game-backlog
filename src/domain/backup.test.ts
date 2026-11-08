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
    const backup = createBackup(games, SEED_SETTINGS, [], new Date("2026-11-04T10:00:00Z"));
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
    expect(backupFileName(new Date(2026, 10, 4))).toBe("game-backlog-2026-11-04.json");
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

  it("keeps IGDB metadata, never exports credentials, and tolerates old files", () => {
    const games = buildSeedGames();
    games[0] = {
      ...games[0],
      source: "igdb",
      externalId: 1942,
      coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1wyy.jpg",
      releaseDate: "2015-05-18",
      providerGenres: ["Action", "Role-playing (RPG)"],
      providerTags: ["Singleplayer", "Open World"],
    };
    const text = serializeBackup(
      createBackup(games, { ...SEED_SETTINGS, igdbClientSecret: "secret", igdbAccessToken: "tok", steamApiKey: "steamkey", steamId: "76561198000000000" }),
    );
    expect(text).not.toContain("secret");
    expect(text).not.toContain("tok");
    expect(text).not.toContain("steamkey");
    expect(text).not.toContain("76561198000000000");
    const parsed = parseBackup(text);
    expect(parsed.settings.igdbClientSecret).toBe("");
    expect(parsed.settings.steamApiKey).toBe("");
    expect(parsed.settings.steamId).toBe("");
    expect(parsed.games.find((g) => g.id === games[0].id)).toMatchObject({
      source: "igdb",
      externalId: 1942,
      releaseDate: "2015-05-18",
      providerGenres: ["Action", "Role-playing (RPG)"],
      providerTags: ["Singleplayer", "Open World"],
    });
    expect(parsed.games[1]).toMatchObject({ source: null, externalId: null, coverUrl: null, providerGenres: [], providerTags: [] });

    const bad = JSON.parse(text) as { games: Record<string, unknown>[] };
    bad.games[0].providerTags = "Singleplayer";
    expect(reasonOf(() => parseBackup(JSON.stringify(bad)))).toBe("games[0].providerTags: type");
  });

  it("round-trips play sessions and recomputes hours played", () => {
    const games = buildSeedGames();
    const sessions = [
      { id: 1, gameId: games[0].id, playedOn: "2026-11-03", hours: 4, note: null },
      { id: 2, gameId: games[0].id, playedOn: "2026-11-04", hours: 2.5, note: "tonight" },
    ];
    const parsed = parseBackup(serializeBackup(createBackup(games, SEED_SETTINGS, sessions)));
    expect(parsed.sessions).toEqual(sessions);
    expect(parsed.games.find((g) => g.id === games[0].id)?.hoursPlayed).toBe(6.5);
    expect(computeSchedule(parsed.games, parsed.settings).totals.hours).toBe(901 - 6.5);

    const orphan = JSON.parse(serializeBackup(createBackup(games, SEED_SETTINGS, sessions))) as { sessions: Record<string, unknown>[] };
    orphan.sessions[0].gameId = 9999;
    expect(reasonOf(() => parseBackup(JSON.stringify(orphan)))).toBe("sessions[0].gameId: missing");
    orphan.sessions[0].gameId = games[0].id;
    orphan.sessions[0].hours = 0;
    expect(reasonOf(() => parseBackup(JSON.stringify(orphan)))).toBe("sessions[0].hours: range");
  });

  it("imports old RAWG links as unlinked cached data", () => {
    const v5 = {
      version: 5,
      settings: { startDate: "2026-11-02", hoursPerWeek: 13 },
      games: [
        { id: 1, title: "A", type: "linear", status: "pending", rawgId: 99, coverUrl: "https://x/a.jpg", rawgGenres: ["RPG"], rawgTags: ["Open World"] },
      ],
    };
    expect(parseBackup(JSON.stringify(v5)).games[0]).toMatchObject({
      source: null,
      externalId: null,
      coverUrl: "https://x/a.jpg",
      providerGenres: ["RPG"],
      providerTags: ["Open World"],
    });
    const v6 = {
      version: 6,
      settings: { startDate: "2026-11-02", hoursPerWeek: 13, gameSource: "rawg" },
      games: [{ id: 1, title: "A", type: "linear", status: "pending", source: "rawg", externalId: 99, providerGenres: ["RPG"] }],
    };
    expect(parseBackup(JSON.stringify(v6)).games[0]).toMatchObject({ source: null, externalId: null, providerGenres: ["RPG"] });
  });

  it("keeps genres, defaults them to none and rejects unknown ones", () => {
    const backup = createBackup(buildSeedGames(), SEED_SETTINGS);
    const parsed = parseBackup(serializeBackup(backup));
    expect(parsed.games.find((g) => g.title === "The Witcher 3")?.genre).toBe("rpg");
    expect(parsed.games.find((g) => g.title === "Far Cry 4")?.genre).toBe("shooter");

    const noGenre = parseBackup(
      JSON.stringify({
        version: 3,
        settings: { startDate: "2026-11-02", hoursPerWeek: 13 },
        games: [{ id: 1, title: "A", type: "linear", status: "pending", platform: "pc" }],
      }),
    );
    expect(noGenre.games[0].genre).toBeNull();

    const bad = JSON.parse(serializeBackup(backup)) as { games: Record<string, unknown>[] };
    bad.games[0].genre = "mmo";
    expect(reasonOf(() => parseBackup(JSON.stringify(bad)))).toBe("games[0].genre: enum");
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

  it("maps the size and mood types of version 10 files to designs, and rejects them in version 11", () => {
    const v10 = {
      version: 10,
      settings: { startDate: "2026-11-02", hoursPerWeek: 13 },
      games: [
        { id: 1, title: "A", type: "giant", status: "in_progress", position: 1 },
        { id: 2, title: "B", type: "medium", status: "pending", position: 2 },
        { id: 3, title: "C", type: "relaxed", status: "pending", position: 3 },
        { id: 4, title: "D", type: "open_world", status: "pending", position: 4 },
      ],
    };
    expect(parseBackup(JSON.stringify(v10)).games.map((g) => g.type)).toEqual(["open_world", "semi_open", "linear", "open_world"]);
    expect(reasonOf(() => parseBackup(JSON.stringify({ ...v10, version: 11 })))).toBe("games[0].type: enum");
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
    data.games[3].type = "open_world";
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
