import type { Game, GameType, Settings } from "./types";

/** Settings loaded on the first run. */
export const SEED_SETTINGS: Settings = {
  startDate: "2026-11-02",
  hoursPerWeek: 13,
  theme: "system",
};

export interface SeedPlanEntry {
  title: string;
  type: GameType;
  hours: number;
  note?: string;
}

export interface SeedCompletedEntry {
  title: string;
  type: GameType;
  completedAt?: string;
  note?: string;
}

/** The plan, in order. The first game is the one in progress. */
export const SEED_PLAN: readonly SeedPlanEntry[] = [
  { title: "Batman: Arkham Knight", type: "open_world", hours: 25 },
  { title: "Resident Evil 4 Remake", type: "linear", hours: 18 },
  { title: "Assassin's Creed Shadows", type: "giant", hours: 55, note: "Glavna priča ~35–40h, ne čisti celu mapu" },
  { title: "Detroit: Become Human", type: "linear", hours: 13 },
  { title: "GTA Vice City", type: "open_world", hours: 18, note: "GTA serijal igraj redom: VC → SA → IV" },
  { title: "The Forest", type: "open_world", hours: 20, note: "Najbolja u co-opu sa ekipom" },
  { title: "Ori and the Will of the Wisps", type: "linear", hours: 14 },
  { title: "The Witcher 3", type: "giant", hours: 100, note: "+~40h ako imaš obe ekspanzije" },
  { title: "Mafia: Definitive Edition", type: "linear", hours: 15, note: "Mafije igraj redom: 1 → 2 → 3" },
  { title: "Dying Light Essentials", type: "open_world", hours: 40, note: "Uključuje The Following" },
  { title: "Dave the Diver", type: "relaxed", hours: 25, note: "Zgodna za kraće sesije radnim danima" },
  { title: "Watch Dogs 2", type: "open_world", hours: 27 },
  { title: "Control", type: "linear", hours: 17, note: "+~8h DLC ako imaš Ultimate" },
  { title: "Red Dead Redemption 2", type: "giant", hours: 75, note: "Najbolja vikendom" },
  { title: "Mafia II: Definitive Edition", type: "linear", hours: 15, note: "DLC-ovi su opcioni" },
  { title: "GTA San Andreas", type: "open_world", hours: 40 },
  { title: "Life is Strange", type: "linear", hours: 15, note: "5 epizoda, zgodno za radne dane" },
  { title: "Far Cry 6", type: "open_world", hours: 33, note: "Ne čisti celu mapu" },
  { title: "Mafia 3", type: "open_world", hours: 27, note: "Najrepetitivnija na spisku" },
  { title: "Rise of the Tomb Raider", type: "linear", hours: 20 },
  { title: "GTA IV", type: "open_world", hours: 38, note: "Osnovna igra, DLC-ovi su kasnije na listi" },
  { title: "Devil May Cry 5", type: "linear", hours: 13 },
  { title: "Cyberpunk 2077", type: "giant", hours: 60, note: "+~20h ako imaš Phantom Liberty" },
  { title: "Shadow of the Tomb Raider DE", type: "linear", hours: 22, note: "+~7h ako igraš DLC grobnice" },
  { title: "Dying Light 2: Stay Human Reloaded", type: "open_world", hours: 45, note: "Uključuje Bloody Ties" },
  { title: "GTA IV: Episodes from Liberty City", type: "open_world", hours: 21, note: "The Lost and Damned + The Ballad of Gay Tony" },
  { title: "Skyrim", type: "giant", hours: 90, note: "Bez kraja, igraj koliko ti prija" },
];

/**
 * Games finished before the app existed, in finish order. The spec gives only
 * titles and (sometimes) dates, so the types are sensible guesses and the
 * hours are 0; both can be edited in the app.
 */
export const SEED_COMPLETED: readonly SeedCompletedEntry[] = [
  { title: "Marvel's Spider-Man", type: "open_world" },
  { title: "Marvel's Spider-Man: Miles Morales", type: "open_world" },
  { title: "Far Cry 4", type: "open_world" },
  { title: "Far Cry 5", type: "open_world" },
  { title: "Far Cry New Dawn", type: "open_world" },
  { title: "Far Cry Primal", type: "open_world" },
  { title: "Spider-Man 2", type: "open_world" },
  { title: "GTA 3", type: "open_world", note: "priča gotova, oktobar 2026" },
  { title: "God of War (2018)", type: "linear", completedAt: "2026-10-28" },
  { title: "Ori and the Blind Forest DE", type: "linear", completedAt: "2026-11-01" },
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
    platform: "pc",
    status: i === 0 ? "in_progress" : "pending",
    casualHours: entry.hours,
    note: entry.note ?? null,
    position: i + 1,
    completedOrder: null,
    completedAt: null,
    rating: null,
    review: null,
  }));
  const completed: Game[] = SEED_COMPLETED.map((entry, i) => ({
    id: planned.length + i + 1,
    title: entry.title,
    type: entry.type,
    platform: "pc",
    status: "completed",
    casualHours: 0,
    note: entry.note ?? null,
    position: null,
    completedOrder: i + 1,
    completedAt: entry.completedAt ?? null,
    rating: null,
    review: null,
  }));
  return [...planned, ...completed];
}
