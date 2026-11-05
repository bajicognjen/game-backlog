import { describe, expect, it } from "vitest";
import { plannedGames } from "./schedule";
import { buildSeedGames } from "./seed";
import type { Game } from "./types";
import { planWarnings, seriesNames } from "./warnings";

describe("planWarnings", () => {
  it("finds nothing wrong with the seed plan", () => {
    expect(planWarnings(plannedGames(buildSeedGames(), "pc"))).toEqual([]);
  });

  it("flags two long games (50 h+) back to back, on the second one", () => {
    const planned = plannedGames(buildSeedGames(), "pc");
    const witcher = planned.findIndex((g) => g.title === "The Witcher 3");
    const rdr = planned.findIndex((g) => g.title === "Red Dead Redemption 2");
    const reordered = planned.slice();
    const [moved] = reordered.splice(rdr, 1);
    reordered.splice(witcher + 1, 0, moved);
    const warnings = planWarnings(reordered);
    expect(warnings).toEqual([{ kind: "adjacent_long", gameId: moved.id, previousTitle: "The Witcher 3" }]);
  });

  it("flags a series entry placed after a later one", () => {
    const planned = plannedGames(buildSeedGames(), "pc");
    const vc = planned.findIndex((g) => g.title === "GTA Vice City");
    const iv = planned.findIndex((g) => g.title === "GTA IV");
    const reordered = planned.slice();
    const [gtaIv] = reordered.splice(iv, 1);
    reordered.splice(vc, 0, gtaIv); // GTA IV now before Vice City and San Andreas
    const warnings = planWarnings(reordered);
    expect(warnings.map((w) => w.kind)).toEqual(["series_order", "series_order"]);
    expect(warnings[0]).toMatchObject({ series: "GTA", afterTitle: "GTA IV" });
    expect(reordered.find((g) => g.id === (warnings[0] as { gameId: number }).gameId)?.title).toBe("GTA Vice City");
  });

  it("ignores games without a series number and compares series names case-insensitively", () => {
    const base = buildSeedGames()[1];
    const games: Game[] = [
      { ...base, id: 1, title: "B", series: "Mafia", seriesOrder: 2, position: 1 },
      { ...base, id: 2, title: "A", series: "mafia", seriesOrder: 1, position: 2 },
      { ...base, id: 3, title: "C", series: "Mafia", seriesOrder: null, position: 3 },
    ];
    expect(planWarnings(games)).toEqual([{ kind: "series_order", gameId: 2, series: "mafia", afterTitle: "B" }]);
  });

  it("lists the series names in use", () => {
    expect(seriesNames(buildSeedGames())).toEqual(["Dying Light", "Far Cry", "GTA", "Mafia", "Ori", "Spider-Man", "Tomb Raider", "Watch Dogs"]);
  });
});
