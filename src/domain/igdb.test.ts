import { describe, expect, it } from "vitest";
import {
  DETAIL_FIELDS,
  gameByIdQuery,
  normaliseTitle,
  rankSearchHits,
  igdbImageUrl,
  mapIgdbDetails,
  mapIgdbGame,
  mapIgdbSearchResult,
  searchQuery,
  timeToBeatQuery,
  unixToIsoDate,
  type IgdbGame,
  type IgdbGameDetails,
} from "./igdb";
import { thumbnailUrl } from "./provider";

const witcher: IgdbGame = {
  id: 1942,
  name: "The Witcher 3: Wild Hunt",
  first_release_date: 1431907200, // 2015-05-18 UTC
  cover: { url: "//images.igdb.com/igdb/image/upload/t_thumb/co1wyy.jpg" },
  genres: [{ name: "Role-playing (RPG)" }, { name: "Adventure" }],
  themes: [{ name: "Action" }, { name: "Fantasy" }, { name: "Open world" }],
  game_modes: [{ name: "Single player" }],
  platforms: [{ abbreviation: "PC" }, { abbreviation: "PS4" }, { abbreviation: null, name: "Nintendo Switch" }],
};

describe("Apicalypse queries", () => {
  it("builds a search with the fields the app needs and a limit", () => {
    expect(searchQuery("zelda")).toBe(
      'search "zelda"; fields id,name,first_release_date,cover.url,platforms.abbreviation,platforms.name,version_title,game_type; where game_type = (0,4,8,9,10,11); limit 15;',
    );
    expect(searchQuery('he said "hi"', 5)).toContain('search "he said \\"hi\\""; ');
    expect(searchQuery("x", 5)).toContain("limit 5;");
    expect(searchQuery("x", 5, "category")).toContain("fields id,name,first_release_date,cover.url,platforms.abbreviation,platforms.name,version_title,category; where category = (0,4,8,9,10,11);");
    expect(searchQuery("x", 5, "game_type", true)).toContain("where game_type = (0,1,2,4,6,8,9,10,11,13);");
    expect(searchQuery("x", 5, "none")).not.toContain("where");
    expect(searchQuery("x", 5)).not.toContain("version_parent"); // editions (Definitive, GOTY) stay listed
  });

  it("asks for every cached field in one detail request", () => {
    for (const field of [
      "screenshots.url",
      "videos.video_id",
      "rating",
      "aggregated_rating",
      "involved_companies.company.name",
      "involved_companies.developer",
      "similar_games.cover.url",
      "franchises.name",
      "collection.name",
      "external_games.url",
      "platforms.name",
      "keywords.name",
    ]) {
      expect(DETAIL_FIELDS).toContain(field);
    }
    expect(gameByIdQuery(1942)).toBe(`fields ${DETAIL_FIELDS}; where id = 1942;`);
  });

  it("builds id lookups with integers only", () => {
    expect(gameByIdQuery(1942.7)).toContain("where id = 1942;");
    expect(timeToBeatQuery(1942)).toBe("fields game_id,normally,hastily,completely; where game_id = 1942;");
  });
});

describe("mapIgdbGame", () => {
  it("maps genres, themes, modes, cover, date and playtime into the shared shape", () => {
    const meta = mapIgdbGame(witcher, 46 * 3600 + 1200);
    expect(meta).toMatchObject({
      source: "igdb",
      externalId: 1942,
      title: "The Witcher 3: Wild Hunt",
      coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1wyy.jpg",
      releaseDate: "2015-05-18",
      providerGenres: ["Action", "Role-playing (RPG)", "Adventure"],
      providerTags: ["Singleplayer", "Fantasy", "Open World"],
      playtimeHours: 46,
      genre: "rpg",
      typeHint: "open_world",
      singleplayer: true,
      multiplayer: false,
      openWorld: true,
    });
  });

  it("derives horror from themes and action-adventure from theme + genre", () => {
    const re4 = mapIgdbGame({ id: 1, name: "RE4", genres: [{ name: "Shooter" }], themes: [{ name: "Action" }, { name: "Horror" }, { name: "Survival" }] });
    expect(re4.genre).toBe("horror");
    const uncharted = mapIgdbGame({ id: 2, name: "U", genres: [{ name: "Adventure" }], themes: [{ name: "Action" }] });
    expect(uncharted.genre).toBe("action_adventure");
    const shooter = mapIgdbGame({ id: 4, name: "S", genres: [{ name: "Adventure" }, { name: "Shooter" }], themes: [{ name: "Action" }] });
    expect(shooter.genre).toBe("shooter");
    const coop = mapIgdbGame({ id: 3, name: "C", game_modes: [{ name: "Co-operative" }, { name: "Multiplayer" }] });
    expect(coop).toMatchObject({ multiplayer: true, singleplayer: false, providerTags: ["Co-op", "Multiplayer"] });
  });

  it("turns known keywords into tags and derives the design from themes and keywords", () => {
    expect(mapIgdbGame(witcher, 100 * 3600).typeHint).toBe("open_world");
    const ori = mapIgdbGame({ id: 5, name: "Ori", genres: [{ name: "Platform" }], keywords: [{ name: " Metroidvania " }, { name: "2d" }] });
    expect(ori).toMatchObject({ providerTags: ["Metroidvania"], typeHint: "metroidvania", genre: "metroidvania" });
    expect(ori.details?.keywords).toEqual(["metroidvania", "2d"]);
    const mafia = mapIgdbGame({ id: 6, name: "Mafia", themes: [{ name: "Open world" }], keywords: [{ name: "semi-open world" }] });
    expect(mafia).toMatchObject({ providerTags: ["Open World", "Semi-open"], typeHint: "semi_open" });
    const forest = mapIgdbGame({ id: 7, name: "Forest", themes: [{ name: "Survival" }, { name: "Open world" }], keywords: [{ name: "base building" }] });
    expect(forest.typeHint).toBe("sandbox");
    const story = mapIgdbGame({ id: 8, name: "Story", genres: [{ name: "Adventure" }], game_modes: [{ name: "Single player" }] });
    expect(story.typeHint).toBe("linear");
  });

  it("tolerates missing fields", () => {
    const meta = mapIgdbGame({ id: 9, name: " Bare " });
    expect(meta).toMatchObject({ title: "Bare", coverUrl: null, releaseDate: null, providerGenres: [], providerTags: [], playtimeHours: null, genre: null, typeHint: null });
  });
});

describe("search hits and helpers", () => {
  it("maps a search row with platform abbreviations or names", () => {
    expect(mapIgdbSearchResult(witcher)).toEqual({
      source: "igdb",
      externalId: 1942,
      title: "The Witcher 3: Wild Hunt",
      releaseDate: "2015-05-18",
      coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1wyy.jpg",
      platforms: ["PC", "PS4", "Nintendo Switch"],
      kind: null,
      edition: null,
    });
  });

  it("labels the record kind from either field and keeps the edition name", () => {
    expect(mapIgdbSearchResult({ ...witcher, game_type: 8 }).kind).toBe("remake");
    expect(mapIgdbSearchResult({ ...witcher, category: 1 }).kind).toBe("dlc");
    expect(mapIgdbSearchResult({ ...witcher, game_type: 0, category: 1 }).kind).toBe("main");
    expect(mapIgdbSearchResult({ ...witcher, game_type: 99 }).kind).toBeNull();
    expect(mapIgdbSearchResult({ ...witcher, version_title: " Definitive Edition " }).edition).toBe("Definitive Edition");
  });

  it("converts unix seconds and image sizes", () => {
    expect(unixToIsoDate(1431907200)).toBe("2015-05-18");
    expect(unixToIsoDate(null)).toBeNull();
    expect(igdbImageUrl("//images.igdb.com/igdb/image/upload/t_thumb/co1.jpg", "t_720p")).toBe(
      "https://images.igdb.com/igdb/image/upload/t_720p/co1.jpg",
    );
    expect(thumbnailUrl("https://images.igdb.com/igdb/image/upload/t_cover_big/co1.jpg", 120)).toBe(
      "https://images.igdb.com/igdb/image/upload/t_cover_small/co1.jpg",
    );
    expect(thumbnailUrl("https://elsewhere.example/x.png")).toBe("https://elsewhere.example/x.png");
  });
});

describe("mapIgdbDetails", () => {
  const full: IgdbGameDetails = {
    ...witcher,
    summary: "  Geralt of Rivia.  ",
    rating: 93.44,
    aggregated_rating: 91.03,
    involved_companies: [
      { company: { name: "CD PROJEKT RED" }, developer: true, publisher: true },
      { company: { name: "Bandai Namco" }, developer: false, publisher: true },
      { company: null, developer: true },
    ],
    screenshots: [{ url: "//images.igdb.com/igdb/image/upload/t_thumb/sc1.jpg" }],
    videos: [{ video_id: "c0i88t0Kacs", name: "Launch Trailer" }, { video_id: null, name: "broken" }],
    similar_games: [{ id: 1, name: "Skyrim ", cover: { url: "//images.igdb.com/igdb/image/upload/t_thumb/co2.jpg" } }, { id: 2, name: "Dragon Age" }],
    franchises: [{ name: "The Witcher" }],
    collection: { name: "The Witcher" },
    external_games: [{ url: "https://store.steampowered.com/app/292030" }, { url: "https://www.youtube.com/watch?v=x" }],
  };

  it("maps media, ratings, companies, links and recommendations", () => {
    const details = mapIgdbDetails(full, new Date("2026-11-04T12:00:00Z"));
    expect(details).toEqual({
      summary: "Geralt of Rivia.",
      platforms: ["PC", "PS4", "Nintendo Switch"],
      userRating: 93.4,
      criticRating: 91,
      developers: ["CD PROJEKT RED"],
      publishers: ["CD PROJEKT RED", "Bandai Namco"],
      screenshots: ["https://images.igdb.com/igdb/image/upload/t_screenshot_med/sc1.jpg"],
      videos: [{ id: "c0i88t0Kacs", name: "Launch Trailer" }],
      similarGames: [
        { igdbId: 1, title: "Skyrim", coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co2.jpg" },
        { igdbId: 2, title: "Dragon Age", coverUrl: null },
      ],
      franchises: ["The Witcher"],
      collection: "The Witcher",
      storeLinks: [{ store: "Steam", url: "https://store.steampowered.com/app/292030" }],
      keywords: [],
      fetchedAt: "2026-11-04T12:00:00.000Z",
    });
    const meta = mapIgdbGame(full, null, new Date("2026-11-04T12:00:00Z"));
    expect(meta.seriesHint).toBe("The Witcher");
    expect(meta.details?.criticRating).toBe(91);
  });

  it("gives empty details for a bare game", () => {
    const details = mapIgdbDetails({ id: 9, name: "Bare" });
    expect(details).toMatchObject({ summary: null, platforms: [], userRating: null, developers: [], screenshots: [], videos: [], similarGames: [], storeLinks: [] });
    expect(mapIgdbGame({ id: 9, name: "Bare" }).seriesHint).toBeNull();
  });
});

describe("rankSearchHits", () => {
  const hit = (title: string, kind: string | null = "main") => ({ title, kind });

  it("puts exact matches first, then prefix matches, main games before add-ons, keeping IGDB order otherwise", () => {
    const hits = [
      hit("Forest Survival Simulator"),
      hit("The Forest: Soundtrack", "dlc"),
      hit("Sons of the Forest"),
      hit("The Forest"),
      hit("The Forest 2 Preview Pack", "pack"),
      hit("The Forest VR"),
    ];
    expect(rankSearchHits(hits, "the forest").map((h) => h.title)).toEqual([
      "The Forest",
      "The Forest VR",
      "The Forest: Soundtrack",
      "The Forest 2 Preview Pack",
      "Forest Survival Simulator",
      "Sons of the Forest",
    ]);
  });

  it("ignores case and punctuation when comparing titles", () => {
    expect(normaliseTitle("Resident Evil 4: Remake!")).toBe("resident evil 4 remake");
    expect(rankSearchHits([hit("resident evil 4"), hit("Resident Evil 4")], "RESIDENT EVIL 4").map((h) => h.title)).toEqual([
      "resident evil 4",
      "Resident Evil 4",
    ]);
  });
});
