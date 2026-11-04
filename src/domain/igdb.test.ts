import { describe, expect, it } from "vitest";
import {
  gameByIdQuery,
  igdbImageUrl,
  mapIgdbGame,
  mapIgdbSearchResult,
  searchQuery,
  timeToBeatQuery,
  unixToIsoDate,
  type IgdbGame,
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
      'search "zelda"; fields id,name,first_release_date,cover.url,genres.name,themes.name,game_modes.name,platforms.abbreviation,platforms.name,summary,total_rating; limit 10;',
    );
    expect(searchQuery('he said "hi"', 5)).toContain('search "he said \\"hi\\""; ');
    expect(searchQuery("x", 5)).toContain("limit 5;");
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

  it("tolerates missing fields", () => {
    const meta = mapIgdbGame({ id: 9, name: " Bare " });
    expect(meta).toMatchObject({ title: "Bare", coverUrl: null, releaseDate: null, providerGenres: [], providerTags: [], playtimeHours: null, genre: null });
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
    });
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
