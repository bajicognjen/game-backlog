import type { Game, GameType, Genre, Settings } from "./types";

/** Settings loaded on the first run. */
export const SEED_SETTINGS: Settings = {
  startDate: "2026-11-02",
  hoursPerWeek: 13,
  theme: "system",
  igdbClientId: "",
  igdbClientSecret: "",
  igdbAccessToken: "",
  igdbTokenExpiresAt: 0,
};

export interface SeedPlanEntry {
  title: string;
  type: GameType;
  genre: Genre;
  hours: number;
  note?: string;
  series?: [name: string, order: number];
}

export interface SeedCompletedEntry {
  title: string;
  type: GameType;
  genre: Genre;
  completedAt?: string;
  note?: string;
  series?: [name: string, order: number];
}

/** The plan, in order. The first game is the one in progress. */
export const SEED_PLAN: readonly SeedPlanEntry[] = [
  { title: "Batman: Arkham Knight", type: "open_world", genre: "action_adventure", hours: 25 },
  { title: "Resident Evil 4 Remake", type: "linear", genre: "horror", hours: 18 },
  { title: "Assassin's Creed Shadows", type: "open_world", genre: "action_adventure", hours: 55, note: "Main story ~35–40h, don't clear the whole map" },
  { title: "Detroit: Become Human", type: "linear", genre: "narrative", hours: 13 },
  { title: "GTA Vice City", type: "open_world", genre: "action_adventure", series: ["GTA", 2], hours: 18, note: "Play the GTA series in order: VC → SA → IV" },
  { title: "The Forest", type: "sandbox", genre: "survival", hours: 20, note: "Best in co-op with friends" },
  { title: "Ori and the Will of the Wisps", type: "metroidvania", genre: "metroidvania", series: ["Ori", 2], hours: 14 },
  { title: "The Witcher 3", type: "open_world", genre: "rpg", hours: 100, note: "+~40h if you have both expansions" },
  { title: "Mafia: Definitive Edition", type: "linear", genre: "action_adventure", series: ["Mafia", 1], hours: 15, note: "Play the Mafia games in order: 1 → 2 → 3" },
  { title: "Dying Light Essentials", type: "open_world", genre: "survival", series: ["Dying Light", 1], hours: 40, note: "Includes The Following" },
  { title: "Dave the Diver", type: "linear", genre: "adventure", hours: 25, note: "Good for short weekday sessions" },
  { title: "Watch Dogs 2", type: "open_world", genre: "action_adventure", series: ["Watch Dogs", 2], hours: 27 },
  { title: "Control", type: "linear", genre: "action_adventure", hours: 17, note: "+~8h DLC if you have Ultimate" },
  { title: "Red Dead Redemption 2", type: "open_world", genre: "action_adventure", hours: 75, note: "Best on weekends" },
  { title: "Mafia II: Definitive Edition", type: "linear", genre: "action_adventure", series: ["Mafia", 2], hours: 15, note: "DLCs are optional" },
  { title: "GTA San Andreas", type: "open_world", genre: "action_adventure", series: ["GTA", 3], hours: 40 },
  { title: "Life is Strange", type: "linear", genre: "narrative", hours: 15, note: "5 episodes, good for weekdays" },
  { title: "Far Cry 6", type: "open_world", genre: "shooter", series: ["Far Cry", 5], hours: 33, note: "Don't clear the whole map" },
  { title: "Mafia 3", type: "open_world", genre: "action_adventure", series: ["Mafia", 3], hours: 27, note: "The most repetitive one on the list" },
  { title: "Rise of the Tomb Raider", type: "semi_open", genre: "action_adventure", series: ["Tomb Raider", 1], hours: 20 },
  { title: "GTA IV", type: "open_world", genre: "action_adventure", series: ["GTA", 4], hours: 38, note: "Base game; the DLCs come later in the list" },
  { title: "Devil May Cry 5", type: "linear", genre: "hack_and_slash", hours: 13 },
  { title: "Cyberpunk 2077", type: "open_world", genre: "rpg", hours: 60, note: "+~20h if you have Phantom Liberty" },
  { title: "Shadow of the Tomb Raider DE", type: "semi_open", genre: "action_adventure", series: ["Tomb Raider", 2], hours: 22, note: "+~7h if you play the DLC tombs" },
  { title: "Dying Light 2: Stay Human Reloaded", type: "open_world", genre: "survival", series: ["Dying Light", 2], hours: 45, note: "Includes Bloody Ties" },
  { title: "GTA IV: Episodes from Liberty City", type: "open_world", genre: "action_adventure", series: ["GTA", 5], hours: 21, note: "The Lost and Damned + The Ballad of Gay Tony" },
  { title: "Skyrim", type: "open_world", genre: "rpg", hours: 90, note: "Endless, play as long as you enjoy it" },
];

/**
 * Games finished before the app existed, in finish order. The spec gives only
 * titles and (sometimes) dates, so the types are sensible guesses and the
 * hours are 0; both can be edited in the app.
 */
export const SEED_COMPLETED: readonly SeedCompletedEntry[] = [
  { title: "Marvel's Spider-Man", type: "open_world", genre: "action_adventure", series: ["Spider-Man", 1] },
  { title: "Marvel's Spider-Man: Miles Morales", type: "open_world", genre: "action_adventure", series: ["Spider-Man", 2] },
  { title: "Far Cry 4", type: "open_world", genre: "shooter", series: ["Far Cry", 1] },
  { title: "Far Cry 5", type: "open_world", genre: "shooter", series: ["Far Cry", 3] },
  { title: "Far Cry New Dawn", type: "open_world", genre: "shooter", series: ["Far Cry", 4] },
  { title: "Far Cry Primal", type: "open_world", genre: "shooter", series: ["Far Cry", 2] },
  { title: "Spider-Man 2", type: "open_world", genre: "action_adventure", series: ["Spider-Man", 3] },
  { title: "GTA 3", type: "open_world", genre: "action_adventure", series: ["GTA", 1], note: "story finished, October 2026" },
  { title: "God of War (2018)", type: "semi_open", genre: "action_adventure", completedAt: "2026-10-28" },
  { title: "Ori and the Blind Forest DE", type: "metroidvania", genre: "metroidvania", series: ["Ori", 1], completedAt: "2026-11-01" },
];

/**
 * Materialise the seed as `Game` objects. Ids are only placeholders (the
 * database assigns real ones); tests and the first-run seed both use this.
 */
export function buildSeedGames(): Game[] {
  const planned: Game[] = SEED_PLAN.map((entry, i) => ({
    id: i + 1,
    title: entry.title,
    type: entry.type,
    genre: entry.genre,
    platform: "pc",
    status: i === 0 ? "in_progress" : "pending",
    casualHours: entry.hours,
    hoursPlayed: 0,
    series: entry.series?.[0] ?? null,
    seriesOrder: entry.series?.[1] ?? null,
    note: entry.note ?? null,
    position: i + 1,
    completedOrder: null,
    completedAt: null,
    rating: null,
    review: null,
    ...NO_METADATA,
  }));
  const completed: Game[] = SEED_COMPLETED.map((entry, i) => ({
    id: planned.length + i + 1,
    title: entry.title,
    type: entry.type,
    genre: entry.genre,
    platform: "pc",
    status: "completed",
    casualHours: 0,
    hoursPlayed: 0,
    series: entry.series?.[0] ?? null,
    seriesOrder: entry.series?.[1] ?? null,
    note: entry.note ?? null,
    position: null,
    completedOrder: i + 1,
    completedAt: entry.completedAt ?? null,
    rating: null,
    review: null,
    ...NO_METADATA,
  }));
  return [...planned, ...completed];
}

/** Metadata fields of a game that was not picked from the game database. */
export const NO_METADATA = {
  source: null,
  externalId: null,
  coverUrl: null,
  releaseDate: null,
  providerGenres: [] as string[],
  providerTags: [] as string[],
  details: null,
} as const;
