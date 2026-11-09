/**
 * Fixtures are real achievements (names, descriptions, unlock days) from a
 * Steam library, so the rules are held to the games they were tuned on.
 */
import { describe, expect, it } from "vitest";
import { finishHint, isEndingAchievement, unlockedNewestFirst, type SteamAchievement } from "./achievements";

/** Noon UTC on a day, so the local day is the same in every time zone the tests run in. */
const at = (day: string) => Date.parse(`${day}T12:00:00Z`) / 1000;
const ach = (name: string, description: string, unlockedOn: string | null): SteamAchievement => ({
  apiname: name.toUpperCase().replace(/\W+/g, "_"),
  achieved: unlockedOn ? 1 : 0,
  unlocktime: unlockedOn ? at(unlockedOn) : 0,
  name,
  description,
});

describe("isEndingAchievement", () => {
  it("knows plain story endings", () => {
    for (const [name, description] of [
      ["Heal the World", "Finish the main story"],
      ["The Journey Ends", "Complete the game"],
      ["A Peaceful Blue Hole", "Watched the ending credits."],
      ["To Live or Die", "Completed the final mission of the story."],
      ["Credits", "Roll the credits"],
    ]) {
      expect(isEndingAchievement(ach(name, description, null)), `${name}: ${description}`).toBe(true);
    }
  });

  it("skips harder or longer variants, and other progress", () => {
    for (const [name, description] of [
      ["Once More, With Feeling", "Finish the main story in New Game+ mode"],
      ["Formidable", " Complete the game on Hard Difficulty"],
      ["Unhinged", "Complete the game on One Life Difficulty"],
      ["Supersonic", "Finish the game in under 3 hours"],
      ["Immortal", "Complete whole game without dying"],
      ["Completionist", "Complete 100% of the game"],
      ["The Journey Begins", "Complete the Prologue"],
      ["First Day on the Job", 'Complete "Luigi\'s Girls".'],
      ["Last Wish", ""],
    ]) {
      expect(isEndingAchievement(ach(name, description, null)), `${name}: ${description}`).toBe(false);
    }
  });

  it("allows a plain ending on any difficulty", () => {
    expect(isEndingAchievement(ach("Done", "Complete the story on any difficulty", null))).toBe(true);
  });
});

describe("finishHint", () => {
  it("dates the finish by the ending achievement (Spider-Man 2)", () => {
    const hint = finishHint([
      ach("Kitted Out", "Purchase all available Suits", "2026-08-31"),
      ach("Heal the World", "Finish the main story", "2026-08-31"),
      ach("Once More, With Feeling", "Finish the main story in New Game+ mode", null),
    ]);
    expect(hint).toMatchObject({ kind: "ending", achievement: { name: "Heal the World", day: "2026-08-31" } });
  });

  it("takes the earliest of several unlocked endings", () => {
    const hint = finishHint([ach("Bad Ending", "Reach the bad ending", "2026-05-02"), ach("Good Ending", "Reach the good ending", "2026-04-20")]);
    expect(hint).toMatchObject({ kind: "ending", achievement: { name: "Good Ending", day: "2026-04-20" } });
  });

  it("says when the ending is still locked (Dave the Diver, paused)", () => {
    const hint = finishHint([
      ach("Bancho Sushi is Back!", "Fixed the Sushi Restaurant.", "2026-02-11"),
      ach("A Peaceful Blue Hole", "Watched the ending credits.", null),
    ]);
    expect(hint).toEqual({ kind: "endingLocked", name: "A Peaceful Blue Hole", description: "Watched the ending credits." });
  });

  it("falls back to the latest unlock when story achievements are hidden (God of War)", () => {
    const hint = finishHint([
      ach("Trilingual", "Learn the languages of Muspelheim and Niflheim", "2026-10-27"),
      ach("Last Wish", "", "2026-10-28"),
      ach("Dragon Slayer", "", "2026-10-12"),
      ach("Give Me God of War", "Complete the game on Give Me God of War difficulty", null),
    ]);
    expect(hint).toMatchObject({ kind: "latest", achievement: { name: "Last Wish", day: "2026-10-28" } });
  });

  it("has nothing to say without unlocked achievements (Rayman Legends)", () => {
    expect(finishHint([ach("Teensy Sized", "Collect 1 Teensy", null)])).toEqual({ kind: "none" });
    expect(finishHint([])).toEqual({ kind: "none" });
  });
});

describe("unlockedNewestFirst", () => {
  it("lists unlocked achievements, newest first, with their local day", () => {
    const list = unlockedNewestFirst([ach("A", "first", "2026-01-01"), ach("B", "locked", null), ach("C", "", "2026-03-01")]);
    expect(list.map((a) => [a.name, a.day])).toEqual([
      ["C", "2026-03-01"],
      ["A", "2026-01-01"],
    ]);
  });
});
