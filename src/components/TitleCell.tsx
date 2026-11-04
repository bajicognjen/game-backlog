import { useState } from "react";
import { releaseYear, thumbnailUrl } from "../domain/provider";
import type { Game } from "../domain/types";
import { statusLabels } from "../i18n/sr";

/** Title with the cover (when there is one and it loads) and the release year; clicking opens the details. */
export function TitleCell({ game, onOpen }: { game: Game; onOpen?(game: Game): void }) {
  const [broken, setBroken] = useState(false);
  const year = releaseYear(game.releaseDate);
  return (
    <div className={`title-cell ${onOpen ? "title-cell-link" : ""}`} onClick={onOpen ? () => onOpen(game) : undefined} role={onOpen ? "button" : undefined}>
      {game.coverUrl && !broken && (
        <img className="cover" src={thumbnailUrl(game.coverUrl, 120)} alt="" loading="lazy" onError={() => setBroken(true)} />
      )}
      <span>
        <span className="title-text">{game.title}</span>
        {year && <span className="muted year"> ({year})</span>}
        {game.status === "dropped" && <span className="status status-dropped">{statusLabels.dropped}</span>}
      </span>
    </div>
  );
}
