import { useState } from "react";
import { releaseYear, thumbnailUrl, type Metadata } from "../domain/provider";
import { sourceLabels, t } from "../i18n/en";

interface Props {
  meta: Metadata;
  note: string | null;
  onUnlink(): void;
}

/** Strip under the search box showing what came from the game database, with a way to drop the link. */
export function ProviderLinked({ meta, note, onUnlink }: Props) {
  const [broken, setBroken] = useState(false);
  if (meta.externalId === null || meta.source === null) return null;
  const year = releaseYear(meta.releaseDate);
  return (
    <div className="search-linked">
      {meta.coverUrl && !broken && (
        <img className="search-linked-cover" src={thumbnailUrl(meta.coverUrl, 200)} alt="" onError={() => setBroken(true)} />
      )}
      <div className="search-linked-body">
        <div className="search-linked-head">
          <span className="chip chip-platform">
            {t.search.linked} {sourceLabels[meta.source]}
          </span>
          {year && <span className="muted">{year}</span>}
          {meta.providerGenres.length > 0 && <span className="muted">{meta.providerGenres.join(", ")}</span>}
          <button type="button" className="button button-ghost button-small" onClick={onUnlink}>
            {t.search.unlink}
          </button>
        </div>
        {meta.providerTags.length > 0 && (
          <div className="search-tags">
            {meta.providerTags.map((tag) => (
              <span key={tag} className="chip chip-genre">
                {tag}
              </span>
            ))}
          </div>
        )}
        {note && <p className="field-hint">{note}</p>}
      </div>
    </div>
  );
}
