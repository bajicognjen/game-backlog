import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSeedGames } from "./seed";
import {
  MIN_IMPORT_HOURS,
  baseGameAppIds,
  editionCandidates,
  excludedByDefault,
  importedHours,
  lastPlayedDay,
  lastPlayedOn,
  minutesToHours,
  parseHiddenApps,
  parseSteamIdInput,
  steamLibrary,
  steamSearchTitle,
  steamWishlist,
  type SteamWishlistEntry,
  planSteamImport,
  steamAppIdOf,
  type SteamOwnedGame,
} from "./steam";
import type { Game, PlaySession } from "./types";

const details = (steamUrl: string | null): Game["details"] => ({
  summary: null,
  platforms: [],
  userRating: null,
  criticRating: null,
  developers: [],
  publishers: [],
  screenshots: [],
  videos: [],
  similarGames: [],
  franchises: [],
  collection: null,
  storeLinks: steamUrl ? [{ store: "Steam", url: steamUrl }] : [{ store: "GOG", url: "https://www.gog.com/game/x" }],
  keywords: [],
  fetchedAt: "2026-11-01T00:00:00.000Z",
});

function game(id: number, title: string, extra: Partial<Game> = {}): Game {
  return {
    id,
    title,
    type: "linear",
    genre: null,
    platform: "pc",
    together: false,
    status: "pending",
    casualHours: 20,
    hoursPlayed: 0,
    series: null,
    seriesOrder: null,
    note: null,
    position: id,
    completedOrder: null,
    completedAt: null,
    rating: null,
    review: null,
    source: null,
    externalId: null,
    coverUrl: null,
    releaseDate: null,
    providerGenres: [],
    providerTags: [],
    details: null,
    ...extra,
  };
}

const owned = (appid: number, name: string, minutes: number, lastPlayed?: number): SteamOwnedGame => ({
  appid,
  name,
  playtime_forever: minutes,
  rtime_last_played: lastPlayed,
});

const TODAY = "2026-11-08";
/** 2026-11-01T12:00:00Z */
const NOV_1 = 1_793_534_400;

describe("steamAppIdOf", () => {
  it("reads the app id from the IGDB store link", () => {
    expect(steamAppIdOf(game(1, "W3", { details: details("https://store.steampowered.com/app/292030") }))).toBe(292030);
    expect(steamAppIdOf(game(1, "W3", { details: details("https://store.steampowered.com/app/292030/The_Witcher_3/?x=1") }))).toBe(292030);
  });

  it("is null without details, without a Steam link, or with an unexpected link", () => {
    expect(steamAppIdOf(game(1, "W3"))).toBeNull();
    expect(steamAppIdOf(game(1, "W3", { details: details(null) }))).toBeNull();
    expect(steamAppIdOf(game(1, "W3", { details: details("https://store.steampowered.com/sub/1234") }))).toBeNull();
  });
});

describe("minutesToHours", () => {
  it("rounds to one decimal", () => {
    expect(minutesToHours(0)).toBe(0);
    expect(minutesToHours(7)).toBe(0.1);
    expect(minutesToHours(90)).toBe(1.5);
    expect(minutesToHours(3607)).toBe(60.1);
  });
});

describe("planSteamImport", () => {
  const witcher = game(1, "The Witcher 3", { details: details("https://store.steampowered.com/app/292030") });
  const cyberpunk = game(2, "Cyberpunk 2077");
  const forest = game(3, "The Forest", { details: details(null) });
  const ps5Game = game(4, "Spider-Man 2", { platform: "ps5" });
  const library: SteamOwnedGame[] = [
    owned(292030, "The Witcher® 3: Wild Hunt", 1230, NOV_1),
    owned(1091500, "Cyberpunk 2077", 600, 0),
    owned(242760, "The Forest", 15),
    owned(1, "Spider-Man 2", 999),
  ];

  it("matches by store link first, then by exact title, and skips other platforms", () => {
    const plan = planSteamImport([witcher, cyberpunk, forest, ps5Game], [], library, TODAY);
    expect(plan.items.map((i) => [i.game.title, i.matchedBy, i.hours, i.playedOn])).toEqual([
      ["The Witcher 3", "store", 20.5, "2026-11-01"],
      ["Cyberpunk 2077", "title", 10, TODAY],
      ["The Forest", "title", 0.3, TODAY],
    ]);
    expect(plan.unmatched).toEqual([]);
    expect(plan.shared).toEqual([]);
  });

  it("adds only the hours Steam has beyond the log and keeps the log when it is ahead", () => {
    const sessions: PlaySession[] = [
      { id: 1, gameId: 1, playedOn: "2026-11-01", hours: 12, note: null },
      { id: 2, gameId: 1, playedOn: "2026-11-02", hours: 4.5, note: null },
      { id: 3, gameId: 2, playedOn: "2026-11-02", hours: 15, note: null },
      { id: 4, gameId: 3, playedOn: "2026-11-03", hours: 0.25, note: null },
    ];
    const plan = planSteamImport([witcher, cyberpunk, forest], sessions, library, TODAY);
    expect(plan.items.map((i) => [i.game.title, i.loggedHours, i.steamHours, i.hours])).toEqual([["The Witcher 3", 16.5, 20.5, 4]]);
    expect(plan.ahead.map((m) => m.game.title)).toEqual(["Cyberpunk 2077"]);
    expect(plan.upToDate.map((m) => m.game.title)).toEqual(["The Forest"]);
    expect(importedHours(plan.items)).toBe(4);
  });

  it("ignores differences under six minutes", () => {
    const sessions: PlaySession[] = [{ id: 1, gameId: 2, playedOn: "2026-11-02", hours: 9.95, note: null }];
    const plan = planSteamImport([cyberpunk], sessions, library, TODAY);
    expect(plan.items).toEqual([]);
    expect(plan.upToDate).toHaveLength(1);
    expect(MIN_IMPORT_HOURS).toBe(0.1);
  });

  it("leaves games Steam does not list, or lists twice under one name, unmatched", () => {
    const skyrim = game(5, "Skyrim");
    const doom = game(6, "Doom");
    const plan = planSteamImport([skyrim, doom], [], [owned(2280, "DOOM", 100), owned(379720, "DOOM", 200), owned(3, "Other", 5)], TODAY);
    expect(plan.unmatched.map((g) => g.title)).toEqual(["Skyrim", "Doom"]);
    expect(plan.items).toEqual([]);
  });

  it("does not match a remake to its original by title when IGDB links another Steam app", () => {
    const remake = game(14, "Resident Evil 4", { details: details("https://store.steampowered.com/app/2050650") });
    const original = game(15, "Resident Evil 4", { details: details("https://store.steampowered.com/app/254700") });
    const unlinked = game(16, "Resident Evil 4");
    const ownsOriginal = [owned(254700, "Resident Evil 4", 900)];

    const linked = planSteamImport([remake], [], ownsOriginal, TODAY);
    expect(linked.items).toEqual([]);
    expect(linked.unmatched.map((g) => g.id)).toEqual([14]);

    // The right app still matches through its link, and a game without a link still tries the title.
    expect(planSteamImport([original], [], ownsOriginal, TODAY).items.map((i) => [i.game.id, i.matchedBy])).toEqual([[15, "store"]]);
    expect(planSteamImport([unlinked], [], ownsOriginal, TODAY).items.map((i) => [i.game.id, i.matchedBy])).toEqual([[16, "title"]]);
  });

  describe("editions without a Steam link of their own", () => {
    // Steam's API names these without the edition, and IGDB links only the base games.
    const gtaV = game(20, "Grand Theft Auto V: Special Edition", { source: "igdb", externalId: 45131, details: details(null) });
    const tombRaider = game(21, "Shadow of the Tomb Raider: Definitive Edition", { source: "igdb", externalId: 123051, details: details(null) });
    const dyingLight = game(22, "Dying Light 2: Stay Human - Reloaded Edition", { source: "igdb", externalId: 322800, details: details(null) });
    const linked = game(23, "The Witcher 3", { source: "igdb", externalId: 1942, details: details("https://store.steampowered.com/app/292030") });
    const unlinked = game(24, "Cyberpunk 2077");
    const onPs5 = game(25, "Spider-Man 2", { platform: "ps5", source: "igdb", externalId: 1 });
    const steam = [
      owned(271590, "Grand Theft Auto V Legacy", 2400),
      owned(3240220, "Grand Theft Auto V Enhanced", 0),
      owned(750920, "Shadow of the Tomb Raider", 0),
      owned(534380, "Dying Light 2: Reloaded Edition", 90),
    ];
    const baseLinks = new Map([
      [45131, [{ store: "Steam" as const, url: "https://store.steampowered.com/app/271590" }]],
      [123051, [{ store: "Steam" as const, url: "https://store.steampowered.com/app/750920" }]],
      [322800, [{ store: "GOG" as const, url: "https://www.gog.com/game/dl2" }, { store: "Steam" as const, url: "https://store.steampowered.com/app/534380" }]],
    ]);

    it("are the only games worth asking IGDB about", () => {
      expect(editionCandidates([gtaV, tombRaider, dyingLight, linked, unlinked, onPs5])).toEqual([45131, 123051, 322800]);
    });

    it("match through their base game's Steam app", () => {
      const baseApps = baseGameAppIds([gtaV, tombRaider, dyingLight, linked], baseLinks);
      expect([...baseApps]).toEqual([
        [20, 271590],
        [21, 750920],
        [22, 534380],
      ]);
      const plan = planSteamImport([gtaV, tombRaider, dyingLight], [], steam, TODAY, baseApps);
      expect(plan.items.map((i) => [i.game.id, i.matchedBy, i.hours])).toEqual([
        [20, "store", 40],
        [22, "store", 1.5],
      ]);
      expect(plan.upToDate.map((m) => m.game.id)).toEqual([21]);
      expect(plan.unmatched).toEqual([]);
    });

    it("stay unmatched without IGDB's help, and never fall back to the title when the base app is not owned", () => {
      expect(planSteamImport([gtaV, tombRaider, dyingLight], [], steam, TODAY).unmatched.map((g) => g.id)).toEqual([20, 21, 22]);
      const sameName = game(26, "Shadow of the Tomb Raider", { source: "igdb", externalId: 37777, details: details(null) });
      const plan = planSteamImport([sameName], [], steam, TODAY, new Map([[26, 999999]]));
      expect(plan.unmatched.map((g) => g.id)).toEqual([26]);
    });
  });

  it("does not split one Steam app between two library games", () => {
    const gta4 = game(7, "GTA IV", { details: details("https://store.steampowered.com/app/12210") });
    const episodes = game(8, "GTA IV: Episodes from Liberty City", { details: details("https://store.steampowered.com/app/12210") });
    const plan = planSteamImport([gta4, episodes, cyberpunk], [], [owned(12210, "Grand Theft Auto IV: The Complete Edition", 3000), ...library], TODAY);
    expect(plan.shared).toHaveLength(1);
    expect(plan.shared[0].steam.appid).toBe(12210);
    expect(plan.shared[0].games.map((g) => g.title)).toEqual(["GTA IV", "GTA IV: Episodes from Liberty City"]);
    expect(plan.items.map((i) => i.game.title)).toEqual(["Cyberpunk 2077"]);
    expect(plan.unmatched).toEqual([]);
  });

  it("flags games not started with nothing logged, and only those start unticked", () => {
    const replay = game(9, "Hollow Knight");
    const loggedButPending = game(10, "Celeste");
    const playing = game(11, "Hades", { status: "in_progress" });
    const paused = game(12, "Disco Elysium", { status: "paused" });
    const finished = game(13, "Inside", { status: "completed", position: null, completedOrder: 1 });
    const sessions: PlaySession[] = [{ id: 1, gameId: 10, playedOn: "2026-11-02", hours: 1, note: null }];
    const steam = [
      owned(367520, "Hollow Knight", 2400),
      owned(504230, "Celeste", 300),
      owned(1145360, "Hades", 600),
      owned(632470, "Disco Elysium", 600),
      owned(304430, "INSIDE", 240),
    ];
    const plan = planSteamImport([replay, loggedButPending, playing, paused, finished], sessions, steam, TODAY);
    expect(plan.items.map((i) => [i.game.title, i.notStarted])).toEqual([
      ["Hollow Knight", true],
      ["Celeste", false],
      ["Hades", false],
      ["Disco Elysium", false],
      ["Inside", false],
    ]);
    expect([...excludedByDefault(plan.items)]).toEqual([9]);
  });

  it("works on the seed library without crashing and lists everything as unmatched", () => {
    const plan = planSteamImport(buildSeedGames(), [], [], TODAY);
    expect(plan.items).toEqual([]);
    expect(plan.unmatched.length).toBeGreaterThan(0);
    expect(plan.unmatched.every((g) => g.platform === "pc")).toBe(true);
  });
});

describe("lastPlayedOn", () => {
  it("uses Steam's date when it is in the past, else today", () => {
    expect(lastPlayedOn({ rtime_last_played: NOV_1 }, TODAY)).toBe("2026-11-01");
    expect(lastPlayedOn({ rtime_last_played: 0 }, TODAY)).toBe(TODAY);
    expect(lastPlayedOn({}, TODAY)).toBe(TODAY);
    expect(lastPlayedOn({ rtime_last_played: NOV_1 + 30 * 86_400 }, TODAY)).toBe(TODAY);
  });

  describe("on the local calendar", () => {
    afterEach(() => vi.unstubAllEnvs());
    // 23:30 on 7 November in UTC: past midnight east of Greenwich, still evening west of it.
    const LATE_NOV_7_UTC = Date.UTC(2026, 10, 7, 23, 30) / 1000;

    it("keeps a session played just after midnight on that day", () => {
      vi.stubEnv("TZ", "Europe/Belgrade");
      expect(lastPlayedOn({ rtime_last_played: LATE_NOV_7_UTC }, TODAY)).toBe("2026-11-08");
    });

    it("keeps a late-evening session on that evening", () => {
      vi.stubEnv("TZ", "America/New_York");
      expect(lastPlayedOn({ rtime_last_played: LATE_NOV_7_UTC }, TODAY)).toBe("2026-11-07");
    });
  });
});

describe("parseSteamIdInput", () => {
  it("accepts a SteamID64, both profile URL forms and a bare custom name", () => {
    expect(parseSteamIdInput(" 76561198000000001 ")).toEqual({ kind: "id", steamId: "76561198000000001" });
    expect(parseSteamIdInput("https://steamcommunity.com/profiles/76561198000000001/")).toEqual({ kind: "id", steamId: "76561198000000001" });
    expect(parseSteamIdInput("https://steamcommunity.com/profiles/76561198000000001/games/?tab=all")).toEqual({ kind: "id", steamId: "76561198000000001" });
    expect(parseSteamIdInput("https://steamcommunity.com/id/gaben/")).toEqual({ kind: "vanity", name: "gaben" });
    expect(parseSteamIdInput("steamcommunity.com/id/gaben")).toEqual({ kind: "vanity", name: "gaben" });
    expect(parseSteamIdInput("gaben")).toEqual({ kind: "vanity", name: "gaben" });
  });

  it("rejects empty and malformed input", () => {
    expect(parseSteamIdInput("")).toBeNull();
    expect(parseSteamIdInput("   ")).toBeNull();
    expect(parseSteamIdInput("1234")).toBeNull();
    expect(parseSteamIdInput("https://example.com/profiles/76561198000000001")).toBeNull();
    expect(parseSteamIdInput("not a name")).toBeNull();
  });
});

describe("steamLibrary", () => {
  const DAY = 86_400;
  const linked = game(1, "The Witcher 3", { source: "igdb", externalId: 1942, details: details("https://store.steampowered.com/app/292030") });
  const edition = game(2, "Shadow of the Tomb Raider: Definitive Edition", { source: "igdb", externalId: 123051, details: details(null) });
  const unlinked = game(3, "Cyberpunk 2077");
  const onPs5 = game(4, "Marvel's Spider-Man", { platform: "ps5" });
  const remake = game(5, "Resident Evil 4", { source: "igdb", externalId: 1, details: details("https://store.steampowered.com/app/2050650") });
  const steam = [
    owned(292030, "The Witcher® 3: Wild Hunt", 1230, NOV_1),
    owned(750920, "Shadow of the Tomb Raider", 0),
    owned(1091500, "Cyberpunk 2077", 600, NOV_1),
    owned(1817070, "Marvel’s Spider-Man Remastered", 0),
    owned(1817071, "Marvel's Spider-Man", 0),
    owned(254700, "Resident Evil 4", 900, NOV_1 - 400 * DAY),
    owned(239140, "Dying Light", 0),
    owned(391220, "Rise of the Tomb Raider", 0),
    owned(1546990, "Grand Theft Auto: Vice City - The Definitive Edition", 30, NOV_1 - 10 * DAY),
    owned(431960, "Wallpaper Engine", 5000, NOV_1 + DAY),
  ];

  it("leaves out games already in the app, on the import's terms and on any platform", () => {
    const library = steamLibrary([linked, edition, unlinked, onPs5, remake], steam, [], new Map([[2, 750920]]));
    const all = [...library.notPlayed, ...library.played, ...library.hidden].map((g) => g.appid);
    expect(all).not.toContain(292030); // through its store link
    expect(all).not.toContain(750920); // an edition, through its base game's app
    expect(all).not.toContain(1091500); // unlinked, through the title
    expect(all).not.toContain(1817071); // the same title on another platform
    expect(all).toContain(1817070); // a different title stays
    expect(all).toContain(254700); // the original of a remake linked to its own app stays
  });

  it("splits never played from played, and keeps hidden games apart", () => {
    const library = steamLibrary([linked, edition, unlinked, onPs5, remake], steam, [431960], new Map([[2, 750920]]));
    expect(library.notPlayed.map((g) => g.name)).toEqual(["Dying Light", "Marvel’s Spider-Man Remastered", "Rise of the Tomb Raider"]);
    // Most recently played first.
    expect(library.played.map((g) => g.appid)).toEqual([1546990, 254700]);
    expect(library.hidden.map((g) => g.appid)).toEqual([431960]);
  });

  it("brings a game back once it is no longer hidden", () => {
    expect(steamLibrary([], steam, [], new Map()).played.map((g) => g.appid)).toContain(431960);
  });
});

describe("steam helpers", () => {
  it("cleans a Steam name for an IGDB search", () => {
    expect(steamSearchTitle("Batman™: Arkham Knight")).toBe("Batman: Arkham Knight");
    expect(steamSearchTitle("The Witcher® 3:  Wild Hunt ")).toBe("The Witcher 3: Wild Hunt");
  });

  it("gives the last-played day, or null without one", () => {
    expect(lastPlayedDay({ rtime_last_played: NOV_1 })).toBe("2026-11-01");
    expect(lastPlayedDay({ rtime_last_played: 0 })).toBeNull();
    expect(lastPlayedDay({})).toBeNull();
  });

  it("reads the stored hidden list, dropping anything that is not an app id", () => {
    expect(parseHiddenApps("[431960, 239140, 431960]")).toEqual([431960, 239140]);
    expect(parseHiddenApps('[1, "2", -3, 4.5, null]')).toEqual([1]);
    expect(parseHiddenApps('{"a": 1}')).toEqual([]);
    expect(parseHiddenApps("not json")).toEqual([]);
    expect(parseHiddenApps(undefined)).toEqual([]);
  });
});

describe("steamWishlist", () => {
  const entry = (appid: number, name: string, priority: number, added: string): SteamWishlistEntry => ({
    appid,
    name,
    priority,
    dateAdded: Date.parse(`${added}T12:00:00Z`) / 1000,
    store: null,
  });
  const wishes = [
    entry(620, "Portal 2", 0, "2024-01-10"),
    entry(264710, "Subnautica", 2, "2023-05-01"),
    entry(413150, "Stardew Valley", 1, "2022-02-02"),
    entry(553850, "HELLDIVERS™ 2", 0, "2025-03-03"),
    entry(292030, "The Witcher® 3: Wild Hunt", 0, "2021-01-01"),
  ];
  const witcher = game(1, "The Witcher 3", { source: "igdb", externalId: 1942, details: details("https://store.steampowered.com/app/292030") });

  it("ranked wishes first in the owner's order, then the rest newest first, without games already in the app", () => {
    const { wishlist } = steamWishlist([witcher], wishes, []);
    expect(wishlist.map((e) => e.name)).toEqual(["Stardew Valley", "Subnautica", "HELLDIVERS™ 2", "Portal 2"]);
  });

  it("keeps hidden wishes apart", () => {
    const { wishlist, hidden } = steamWishlist([], wishes, [620, 553850]);
    expect(hidden.map((e) => e.name)).toEqual(["HELLDIVERS™ 2", "Portal 2"]);
    expect(wishlist).toHaveLength(3);
  });
});
