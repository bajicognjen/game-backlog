import type { Genre } from "../domain/types";
import { genreLabels, t } from "../i18n/en";

export function GenreChip({ genre }: { genre: Genre | null }) {
  if (genre === null) return <span className="muted">{t.none}</span>;
  return <span className="chip chip-genre">{genreLabels[genre]}</span>;
}
