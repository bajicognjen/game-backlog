import { describe, expect, it } from "vitest";
import { parseDetails, storeLinksFrom, youtubeEmbedUrl, youtubeThumbnailUrl, type GameDetails } from "./details";

describe("storeLinksFrom", () => {
  it("recognises stores from IGDB's urls, one per store, in a fixed order", () => {
    const links = storeLinksFrom([
      { url: "https://www.youtube.com/watch?v=abc" },
      { url: "https://store.playstation.com/en-us/product/UP9000-CUSA00411_00-THEWITCHER3GOTY" },
      { url: "https://store.steampowered.com/app/292030" },
      { url: "https://store.steampowered.com/app/292030-duplicate" },
      { url: "https://www.gog.com/game/the_witcher_3_wild_hunt" },
      { url: "https://store.epicgames.com/p/the-witcher-3" },
      { url: "not a url" },
      { url: null },
      {},
    ]);
    expect(links.map((l) => l.store)).toEqual(["Steam", "Epic Games", "GOG", "PlayStation Store"]);
    expect(links[0].url).toBe("https://store.steampowered.com/app/292030");
  });

  it("builds privacy-friendly YouTube urls", () => {
    expect(youtubeEmbedUrl("dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(youtubeThumbnailUrl("dQw4w9WgXcQ")).toBe("https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  });
});

describe("parseDetails", () => {
  const full: GameDetails = {
    summary: "Geralt.",
    platforms: ["PC (Microsoft Windows)", "PlayStation 4"],
    userRating: 93.4,
    criticRating: 91,
    developers: ["CD PROJEKT RED"],
    publishers: ["CD PROJEKT RED", "Bandai Namco"],
    screenshots: ["https://images.igdb.com/igdb/image/upload/t_screenshot_med/a.jpg"],
    videos: [{ id: "c0i88t0Kacs", name: "Trailer" }],
    similarGames: [{ igdbId: 1, title: "Skyrim", coverUrl: null }],
    franchises: ["The Witcher"],
    collection: "The Witcher",
    storeLinks: [{ store: "Steam", url: "https://store.steampowered.com/app/292030" }],
    keywords: ["open world", "monster hunting"],
    fetchedAt: "2026-11-04T12:00:00.000Z",
  };

  it("round-trips a full record", () => {
    expect(parseDetails(JSON.stringify(full))).toEqual(full);
  });

  it("tolerates missing, wrong-typed and junk input", () => {
    expect(parseDetails(null)).toBeNull();
    expect(parseDetails("not json")).toBeNull();
    expect(parseDetails("[]")).toBeNull();
    const partial = parseDetails(JSON.stringify({ platforms: ["PC", 3], videos: [{ id: 1 }, { id: "x", name: "n" }], userRating: "90" }));
    expect(partial).toMatchObject({ platforms: ["PC"], videos: [{ id: "x", name: "n" }], userRating: null, screenshots: [], collection: null });
  });
});
