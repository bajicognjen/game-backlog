/**
 * A game's design (how its world and progression are structured) from the
 * source's metadata. IGDB marks open worlds and sandboxes as themes; the rest
 * comes from its community keywords, which `igdb.ts` turns into tags. The
 * first rule that matches wins.
 */
import {
  TAG_BASE_BUILDING,
  TAG_CHAPTERS,
  TAG_METROIDVANIA,
  TAG_OPEN_WORLD,
  TAG_ROGUELIKE,
  TAG_SANDBOX,
  TAG_SEMI_OPEN,
  TAG_SURVIVAL,
} from "./provider";
import type { Game, GameType } from "./types";

/**
 * Metroidvania and roguelike first (they can be open too), then survival
 * sandboxes, then semi-open before open world (IGDB tags many hub-based
 * games as open world): a semi-open keyword, or an open world told in set
 * chapters (Mafia). Linear otherwise. Null when the game carries no source
 * metadata to go on.
 */
export function gameTypeFrom(meta: Pick<Game, "providerGenres" | "providerTags">): GameType | null {
  const tags = meta.providerTags;
  if (meta.providerGenres.length === 0 && tags.length === 0) return null;
  if (tags.includes(TAG_METROIDVANIA)) return "metroidvania";
  if (tags.includes(TAG_ROGUELIKE)) return "roguelike";
  if (tags.includes(TAG_SURVIVAL) && (tags.includes(TAG_SANDBOX) || tags.includes(TAG_BASE_BUILDING))) return "sandbox";
  if (tags.includes(TAG_SEMI_OPEN) || (tags.includes(TAG_OPEN_WORLD) && tags.includes(TAG_CHAPTERS))) return "semi_open";
  if (tags.includes(TAG_OPEN_WORLD)) return "open_world";
  return "linear";
}
