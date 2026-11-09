import { describe, expect, it } from "vitest";
import { buildSeedGames } from "./seed";
import type { SteamAchievement } from "./achievements";
import type { SteamOwnedGame } from "./steam";
import { IDLE_DAYS, dismissHint, parseDismissedHints, statusHints } from "./steamHints";
import type { Game, PlaySession } from "./types";

const TODAY = "2026-11-09";
/** Noon UTC on a day, so the local day is the same in every time zone. */
const at = (day: string) => Date.parse(`${day}T12:00:00Z`) / 1000;

const seed = buildSeedGames();
const byTitle = (title: string) => seed.find((g) => g.title === title) as Game;
const withStatus = (game: Game, status: Game["status"]): Game => ({ ...game, status });

const steam = (appid: number, name: string, recentMinutes: number, lastPlayed: string | null): SteamOwnedGame => ({
  appid,
  name,
  playtime_forever: 600,
  playtime_2weeks: recentMinutes,
  rtime_last_played: lastPlayed ? at(lastPlayed) : 0,
});

describe("statusHints", () => {
  const forest = byTitle("The Forest");
  const control = withStatus(byTitle("Control"), "paused");
  const batman = byTitle("Batman: Arkham Knight"); // in progress in the seed
  const owned = [
    steam(242760, "The Forest", 95, "2026-11-08"),
    steam(870780, "Control", 240, "2026-11-07"),
    steam(208650, "Batman™: Arkham Knight", 0, "2026-09-20"),
  ];

  it("suggests starting or resuming games played lately, most played first", () => {
    const hints = statusHints([forest, control], [], owned, new Map(), TODAY, []);
    expect(hints.map((h) => [h.kind, h.game.title, h.kind === "playing" ? h.hours : null])).toEqual([
      ["playing", "Control", 4],
      ["playing", "The Forest", 1.6],
    ]);
  });

  it("ignores a quick launch, and games already in progress", () => {
    const quick = [steam(242760, "The Forest", 20, "2026-11-08")];
    expect(statusHints([forest], [], quick, new Map(), TODAY, [])).toEqual([]);
    const playing = [steam(208650, "Batman™: Arkham Knight", 300, "2026-11-08")];
    expect(statusHints([batman], [], playing, new Map(), TODAY, [])).toEqual([]);
  });

  it("suggests pausing a game in progress nobody has played for a month", () => {
    const hints = statusHints([batman], [], owned, new Map(), TODAY, []);
    expect(hints).toMatchObject([{ kind: "idle", game: { title: "Batman: Arkham Knight" }, lastPlayed: "2026-09-20", days: 50 }]);
    expect(IDLE_DAYS).toBe(30);
  });

  it("does not call quiet a game made current recently, whatever Steam last saw", () => {
    expect(statusHints([batman], [], owned, new Map(), TODAY, [], "2026-11-02")).toEqual([]);
    expect(statusHints([batman], [], owned, new Map(), TODAY, [], "2026-10-01")).toMatchObject([{ kind: "idle", lastPlayed: "2026-10-01", days: 39 }]);
  });

  it("counts a logged session as play, so a game played elsewhere is not called quiet", () => {
    const sessions: PlaySession[] = [{ id: 1, gameId: batman.id, playedOn: "2026-11-01", hours: 2, note: null }];
    expect(statusHints([batman], sessions, owned, new Map(), TODAY, [])).toEqual([]);
  });

  it("stays quiet about finished games and games Steam does not list", () => {
    const done = withStatus(control, "completed");
    expect(statusHints([done, byTitle("Detroit: Become Human")], [], owned, new Map(), TODAY, [])).toEqual([]);
  });

  it("drops dismissed hints until the game is played again", () => {
    const [hint] = statusHints([forest], [], owned, new Map(), TODAY, []);
    expect(statusHints([forest], [], owned, new Map(), TODAY, [hint.key])).toEqual([]);
    const playedAgain = [steam(242760, "The Forest", 180, "2026-11-09")];
    expect(statusHints([forest], [], playedAgain, new Map(), TODAY, [hint.key])).toHaveLength(1);
  });
});

describe("dismissHint", () => {
  it("keeps only keys of hints still showing, plus the new one", () => {
    const hints = statusHints([byTitle("The Forest")], [], [steam(242760, "The Forest", 95, "2026-11-08")], new Map(), TODAY, []);
    expect(dismissHint(["stale:1:0"], hints, hints[0].key)).toEqual([hints[0].key]);
  });

  it("reads the stored list, dropping anything that is not a key", () => {
    expect(parseDismissedHints('["idle:1:2026-01-01", "", 3, "idle:1:2026-01-01"]')).toEqual(["idle:1:2026-01-01"]);
    expect(parseDismissedHints("nope")).toEqual([]);
    expect(parseDismissedHints(undefined)).toEqual([]);
  });
});

describe("finished hints", () => {
  const ending = (day: string | null): SteamAchievement => ({
    apiname: "END",
    achieved: day ? 1 : 0,
    unlocktime: day ? at(day) : 0,
    name: "Knightfall",
    description: "Complete the main story",
  });
  const hidden = (day: string): SteamAchievement => ({ apiname: "LAST", achieved: 1, unlocktime: at(day), name: "Last Wish", description: "" });
  const batman = byTitle("Batman: Arkham Knight"); // in progress
  const control = withStatus(byTitle("Control"), "paused");
  const forest = byTitle("The Forest"); // not started
  const owned = [
    steam(208650, "Batman™: Arkham Knight", 0, "2026-11-05"),
    steam(870780, "Control", 0, "2026-10-20"),
    steam(242760, "The Forest", 95, "2026-11-08"),
  ];
  const hintsWith = (achievements: Map<number, SteamAchievement[]>, games: Game[] = [batman, control, forest], sessions: PlaySession[] = []) =>
    statusHints(games, sessions, owned, new Map(), TODAY, [], "2026-11-02", achievements);

  it("says a game in progress or paused was finished when its ending unlocked during this run, finished games first", () => {
    const hints = hintsWith(
      new Map([
        [batman.id, [ending("2026-11-05")]],
        [control.id, [ending("2026-10-20")]],
      ]),
    );
    expect(hints.map((h) => [h.kind, h.game.title, h.kind === "finished" ? h.achievement.day : null])).toEqual([
      ["finished", "Batman: Arkham Knight", "2026-11-05"],
      ["finished", "Control", "2026-10-20"],
      ["playing", "The Forest", null],
    ]);
  });

  it("ignores an ending from an earlier run (a replay)", () => {
    expect(hintsWith(new Map([[batman.id, [ending("2019-04-01")]]]), [batman])).toEqual([]);
    const sessions: PlaySession[] = [{ id: 1, gameId: control.id, playedOn: "2026-09-01", hours: 3, note: null }];
    expect(hintsWith(new Map([[control.id, [ending("2021-02-02")]]]), [control], sessions)).toEqual([]);
  });

  it("needs a recognised, unlocked ending: the newest unlock alone is not proof", () => {
    expect(hintsWith(new Map([[batman.id, [hidden("2026-11-05")]]]), [batman])).toEqual([]);
    expect(hintsWith(new Map([[batman.id, [ending(null)]]]), [batman])).toEqual([]);
  });

  it("does not call a game not started finished, whatever Steam has unlocked", () => {
    expect(hintsWith(new Map([[forest.id, [ending("2026-11-07")]]]), [forest]).map((h) => h.kind)).toEqual(["playing"]);
  });

  it("can be put off like the other hints", () => {
    const [hint] = hintsWith(new Map([[batman.id, [ending("2026-11-05")]]]), [batman]);
    expect(statusHints([batman], [], owned, new Map(), TODAY, [hint.key], "2026-11-02", new Map([[batman.id, [ending("2026-11-05")]]]))).toEqual([]);
  });
});
