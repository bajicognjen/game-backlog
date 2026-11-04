import { describe, expect, it } from "vitest";
import { availablePlatforms, isFilterActive, matchesFilter, NO_FILTER, toggleMode } from "./filters";
import { buildSeedGames } from "./seed";
import type { Game } from "./types";

function withDetails(game: Game, platforms: string[], tags: string[]): Game {
  return {
    ...game,
    providerTags: tags,
    details: {
      summary: null,
      platforms,
      userRating: null,
      criticRating: null,
      developers: [],
      publishers: [],
      screenshots: [],
      videos: [],
      similarGames: [],
      franchises: [],
      collection: null,
      storeLinks: [],
      fetchedAt: "2026-11-04T00:00:00.000Z",
    },
  };
}

describe("filters", () => {
  const [a, b, c] = buildSeedGames();
  const coop = withDetails(a, ["PC (Microsoft Windows)", "PlayStation 5"], ["Singleplayer", "Co-op"]);
  const solo = withDetails(b, ["PC (Microsoft Windows)"], ["Singleplayer"]);
  const unknown = c; // no IGDB data at all

  it("matches any selected mode and the chosen platform", () => {
    expect(matchesFilter(coop, NO_FILTER)).toBe(true);
    expect(matchesFilter(coop, { modes: ["Co-op"], platform: null })).toBe(true);
    expect(matchesFilter(solo, { modes: ["Co-op"], platform: null })).toBe(false);
    expect(matchesFilter(solo, { modes: ["Co-op", "Singleplayer"], platform: null })).toBe(true);
    expect(matchesFilter(coop, { modes: [], platform: "PlayStation 5" })).toBe(true);
    expect(matchesFilter(solo, { modes: [], platform: "PlayStation 5" })).toBe(false);
    expect(matchesFilter(unknown, { modes: ["Singleplayer"], platform: null })).toBe(false);
    expect(matchesFilter(unknown, NO_FILTER)).toBe(true);
  });

  it("lists the platforms the library knows and toggles modes", () => {
    expect(availablePlatforms([coop, solo, unknown])).toEqual(["PC (Microsoft Windows)", "PlayStation 5"]);
    const once = toggleMode(NO_FILTER, "Multiplayer");
    expect(once.modes).toEqual(["Multiplayer"]);
    expect(toggleMode(once, "Multiplayer").modes).toEqual([]);
    expect(isFilterActive(NO_FILTER)).toBe(false);
    expect(isFilterActive(once)).toBe(true);
  });
});
