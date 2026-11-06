import { useState } from "react";
import { releaseYear, thumbnailUrl } from "../domain/provider";
import type { Game } from "../domain/types";
import { statusLabels, t } from "../i18n/en";

/** Title with the cover (when there is one and it loads) and the release year; a real button when it opens the details. */
export function TitleCell({ game, onOpen }: { game: Game; onOpen?(game: Game): void }) {
  const [broken, setBroken] = useState(false);
  const year = releaseYear(game.releaseDate);
  const content = (
    <>
      {game.coverUrl && !broken && (
        <img className="cover" src={thumbnailUrl(game.coverUrl, 120)} alt="" loading="lazy" onError={() => setBroken(true)} />
      )}
      <span>
        <span className="title-text">{game.title}</span>
        {year && <span className="muted year"> ({year})</span>}
        {game.status === "dropped" && <span className="status status-dropped">{statusLabels.dropped}</span>}
      </span>
    </>
  );
  if (!onOpen) return <div className="title-cell">{content}</div>;
  return (
    <button type="button" className="title-cell title-cell-link" onClick={() => onOpen(game)} title={t.actions.details}>
      {content}
    </button>
  );
}
