import { describe, expect, it } from "vitest";
import { gameTypeFrom } from "./gameType";

/** Builds the stored metadata shape: genres as IGDB names, tags from themes, modes and keywords. */
const meta = (providerTags: string[], providerGenres: string[] = ["Action", "Adventure"]) => ({ providerGenres, providerTags });

describe("gameTypeFrom", () => {
  it("puts metroidvania and roguelike keywords first, even on open games", () => {
    expect(gameTypeFrom(meta(["Singleplayer", "Fantasy", "Open World", "Metroidvania"]))).toBe("metroidvania");
    expect(gameTypeFrom(meta(["Singleplayer", "Roguelike", "Open World"]))).toBe("roguelike");
  });

  it("calls survival games with a sandbox theme or base building a sandbox", () => {
    // Terraria: Sandbox and Survival themes.
    expect(gameTypeFrom(meta(["Singleplayer", "Survival", "Sandbox", "Open World"]))).toBe("sandbox");
    // The Forest: Survival theme and a base building keyword.
    expect(gameTypeFrom(meta(["Singleplayer", "Survival", "Open World", "Base Building"]))).toBe("sandbox");
    // Far Cry 5: survival theme alone stays open world; GTA V: sandbox theme alone too.
    expect(gameTypeFrom(meta(["Singleplayer", "Survival", "Open World"]))).toBe("open_world");
    expect(gameTypeFrom(meta(["Singleplayer", "Sandbox", "Open World"]))).toBe("open_world");
  });

  it("prefers semi-open over IGDB's open world tag", () => {
    expect(gameTypeFrom(meta(["Singleplayer", "Drama", "Open World", "Semi-open"]))).toBe("semi_open");
    expect(gameTypeFrom(meta(["Singleplayer", "Semi-open"]))).toBe("semi_open");
  });

  it("calls an open world told in chapters semi-open, and chapters alone linear", () => {
    // Mafia: Definitive Edition: open world theme and a "game with chapters" keyword.
    expect(gameTypeFrom(meta(["Singleplayer", "Drama", "Open World", "Chapters"]))).toBe("semi_open");
    expect(gameTypeFrom(meta(["Singleplayer", "Chapters"]))).toBe("linear");
  });

  it("falls back to open world by tag, then linear", () => {
    expect(gameTypeFrom(meta(["Singleplayer", "Stealth", "Open World"]))).toBe("open_world");
    expect(gameTypeFrom(meta(["Singleplayer", "Horror"]))).toBe("linear");
    expect(gameTypeFrom(meta([], ["Adventure"]))).toBe("linear");
  });

  it("gives no design without source metadata", () => {
    expect(gameTypeFrom(meta([], []))).toBeNull();
  });
});
