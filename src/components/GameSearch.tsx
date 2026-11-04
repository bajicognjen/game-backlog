import { useMemo, useState } from "react";
import { releaseYear, thumbnailUrl, type GameMetadata, type SearchHit } from "../domain/provider";
import type { Game } from "../domain/types";
import { platformLabels, sourceLabels, t } from "../i18n/sr";
import { ProviderError } from "../platform/http";
import { providers } from "../state/providers";
import { useStore } from "../state/store";
import { useGameSearch } from "../state/useGameSearch";

export type SearchPick = { kind: "provider"; meta: GameMetadata } | { kind: "library"; game: Game };

interface Props {
  onPick(pick: SearchPick): void;
}

/**
 * Search box with a dropdown: matching games already in the library first
 * (read locally, no request), then IGDB results. Picking a result that is
 * already in the library hands back the library row instead of fetching.
 */
export function GameSearch({ onPick }: Props) {
  const games = useStore((s) => s.games);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [fetching, setFetching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const search = useGameSearch(query);

  const needle = query.trim().toLowerCase();
  const local = useMemo(
    () => (needle.length >= 2 ? games.filter((g) => g.title.toLowerCase().includes(needle)).slice(0, 5) : []),
    [games, needle],
  );

  function close() {
    setOpen(false);
    setQuery("");
    setError(null);
  }

  async function pickHit(hit: SearchHit) {
    const existing = games.find((g) => g.source === hit.source && g.externalId === hit.externalId);
    if (existing) {
      onPick({ kind: "library", game: existing });
      close();
      return;
    }
    const key = `${hit.source}:${hit.externalId}`;
    setFetching(key);
    setError(null);
    try {
      onPick({ kind: "provider", meta: await providers[hit.source].details(hit.externalId) });
      close();
    } catch (err) {
      setError(failureMessage(err instanceof ProviderError ? err.reason : "other"));
    } finally {
      setFetching(null);
    }
  }

  const hits = search.status === "ready" || search.status === "loading" ? search.hits : [];
  const source = search.status === "ready" || search.status === "loading" ? search.source : null;
  const status = (() => {
    if (error) return error;
    switch (search.status) {
      case "short":
        return t.search.short;
      case "loading":
        return t.search.loading;
      case "error":
        return failureMessage(search.reason);
      case "ready":
        return search.hits.length === 0 && local.length === 0 ? t.search.noResults : null;
      default:
        return null;
    }
  })();

  return (
    <div className="search-search">
      <label className="field">
        <span className="field-label">{t.search.label}</span>
        <input
          type="search"
          value={query}
          placeholder={t.search.placeholder}
          autoComplete="off"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setError(null);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
          }}
        />
      </label>

      {open && query.trim() !== "" && (
        <div className="search-dropdown" onMouseDown={(e) => e.preventDefault()}>
          {local.length > 0 && (
            <>
              <div className="search-section">{t.search.inLibrary}</div>
              {local.map((game) => (
                <button
                  key={`lib-${game.id}`}
                  type="button"
                  className="search-item"
                  onClick={() => {
                    onPick({ kind: "library", game });
                    close();
                  }}
                >
                  <Thumb url={game.coverUrl} />
                  <span className="search-item-text">
                    <span className="search-item-title">{game.title}</span>
                    <span className="muted">
                      {platformLabels[game.platform]}
                      {game.releaseDate ? ` · ${releaseYear(game.releaseDate)}` : ""}
                    </span>
                  </span>
                </button>
              ))}
            </>
          )}
          {hits.length > 0 && source && <div className="search-section">{sourceLabels[source]}</div>}
          {hits.map((hit) => {
            const key = `${hit.source}:${hit.externalId}`;
            return (
              <button key={key} type="button" className="search-item" disabled={fetching !== null} onClick={() => void pickHit(hit)}>
                <Thumb url={hit.coverUrl} />
                <span className="search-item-text">
                  <span className="search-item-title">
                    {hit.title}
                    {hit.releaseDate ? <span className="muted"> ({releaseYear(hit.releaseDate)})</span> : null}
                  </span>
                  <span className="muted">{hit.platforms.slice(0, 4).join(", ")}</span>
                </span>
                {fetching === key && <span className="muted search-item-note">{t.search.loadingDetails}</span>}
              </button>
            );
          })}
          {status && <div className={`search-status ${error ? "field-error" : "muted"}`}>{status}</div>}
        </div>
      )}
    </div>
  );
}

function Thumb({ url }: { url: string | null }) {
  const [broken, setBroken] = useState(false);
  if (!url || broken) return <span className="search-thumb search-thumb-empty" aria-hidden="true" />;
  return <img className="search-thumb" src={thumbnailUrl(url, 120)} alt="" loading="lazy" onError={() => setBroken(true)} />;
}

export function failureMessage(reason: ProviderError["reason"]): string {
  switch (reason) {
    case "no-credentials":
      return t.search.noCredentials;
    case "unauthorized":
      return t.search.unauthorized;
    case "network":
      return t.search.network;
    default:
      return t.search.error;
  }
}
