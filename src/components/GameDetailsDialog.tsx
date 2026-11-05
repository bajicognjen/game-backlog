import { useMemo, useState } from "react";
import { formatDate } from "../domain/dates";
import { youtubeEmbedUrl, youtubeThumbnailUrl, type SimilarGame } from "../domain/details";
import { formatHours } from "../domain/format";
import { igdbImageUrl } from "../domain/igdb";
import { releaseYear, thumbnailUrl, toMetadata } from "../domain/provider";
import { plannedIds } from "../domain/plan";
import type { Game } from "../domain/types";
import { genreLabels, platformLabels, statusLabels, t } from "../i18n/en";
import { ProviderError } from "../platform/http";
import { openExternal } from "../platform/links";
import { providers } from "../state/providers";
import { useStore } from "../state/store";
import { Modal } from "./Modal";
import { PlatformChip } from "./PlatformChip";
import { TypeChip } from "./TypeChip";

interface Props {
  gameId: number;
  onClose(): void;
}

/**
 * Everything cached about a game: cover, ratings, companies, platforms,
 * summary, store links, screenshots, trailers, similar games and the rest
 * of its series or franchise in the library. Linked games can refresh from IGDB.
 */
export function GameDetailsDialog({ gameId, onClose }: Props) {
  const games = useStore((s) => s.games);
  const editGame = useStore((s) => s.editGame);
  const addGame = useStore((s) => s.addGame);
  const game = games.find((g) => g.id === gameId);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  const related = useMemo(() => (game ? relatedGames(games, game) : []), [games, game]);

  if (!game) return null;
  const d = game.details;
  const linked = game.source === "igdb" && game.externalId !== null;

  async function refresh() {
    if (!game || !linked) return;
    setBusy("refresh");
    setError(null);
    try {
      const meta = await providers.igdb.details(game.externalId as number);
      await editGame(game.id, { ...toMetadata(meta), type: meta.typeHint ?? game.type });
    } catch (err) {
      setError(failure(err));
    } finally {
      setBusy(null);
    }
  }

  async function addSimilar(similar: SimilarGame) {
    if (!game) return;
    setBusy(`add-${similar.igdbId}`);
    setError(null);
    try {
      const meta = await providers.igdb.details(similar.igdbId);
      await addGame(
        {
          title: meta.title,
          type: meta.typeHint ?? "linear",
          genre: meta.genre,
          platform: game.platform === "ps4" ? "pc" : game.platform,
          casualHours: meta.playtimeHours ?? 0,
          series: meta.seriesHint,
          seriesOrder: null,
          note: null,
          ...toMetadata(meta),
        },
        plannedIds(useStore.getState().games, game.platform === "ps4" ? "pc" : game.platform).length,
      );
    } catch (err) {
      setError(failure(err));
    } finally {
      setBusy(null);
    }
  }

  const year = releaseYear(game.releaseDate);

  return (
    <Modal title={game.title} onClose={onClose} wide>
      <div className="details">
        <header className="details-head">
          {game.coverUrl && <img className="details-cover" src={thumbnailUrl(game.coverUrl, 200)} alt="" />}
          <div className="details-summary">
            <div className="details-chips">
              <TypeChip type={game.type} />
              {game.genre && <span className="chip chip-genre">{genreLabels[game.genre]}</span>}
              <PlatformChip platform={game.platform} />
              <span className={`status status-${game.status}`}>{statusLabels[game.status]}</span>
              {year && <span className="muted">{year}</span>}
            </div>
            {d && (d.developers.length > 0 || d.publishers.length > 0) && (
              <p className="details-line">
                {d.developers.length > 0 && (
                  <span>
                    <span className="muted">{t.details.developer}:</span> {d.developers.join(", ")}
                  </span>
                )}
                {d.publishers.length > 0 && (
                  <span>
                    <span className="muted">{t.details.publisher}:</span> {d.publishers.join(", ")}
                  </span>
                )}
              </p>
            )}
            {d && (d.userRating !== null || d.criticRating !== null) && (
              <p className="details-line">
                {d.userRating !== null && (
                  <span className="rating-pill" title={t.details.userRating}>
                    {t.details.users} {Math.round(d.userRating)}/100
                  </span>
                )}
                {d.criticRating !== null && (
                  <span className="rating-pill" title={t.details.criticRating}>
                    {t.details.critics} {Math.round(d.criticRating)}/100
                  </span>
                )}
                {game.rating !== null && (
                  <span className="rating-pill rating-pill-own" title={t.columns.rating}>
                    {t.details.yours} {game.rating}/10
                  </span>
                )}
              </p>
            )}
            {d && d.platforms.length > 0 && (
              <p className="details-line">
                <span className="muted">{t.details.platforms}:</span> {d.platforms.join(", ")}
              </p>
            )}
            <p className="details-line">
              {game.casualHours > 0 && (
                <span>
                  <span className="muted">{t.columns.hours}:</span> {formatHours(game.casualHours)} h
                </span>
              )}
              {game.hoursPlayed > 0 && (
                <span>
                  <span className="muted">{t.totals.played}:</span> {formatHours(game.hoursPlayed)} h
                </span>
              )}
              {game.completedAt && (
                <span>
                  <span className="muted">{t.columns.completedAt}:</span> {formatDate(game.completedAt)}
                </span>
              )}
            </p>
            {d && d.storeLinks.length > 0 && (
              <div className="details-links">
                {d.storeLinks.map((link) => (
                  <button key={link.store} type="button" className="button button-small" onClick={() => void openExternal(link.url)}>
                    {link.store} ↗
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        {d?.summary && <p className="details-text">{d.summary}</p>}
        {game.note && (
          <p className="details-text muted">
            {t.columns.note}: {game.note}
          </p>
        )}
        {game.review && (
          <p className="details-text">
            <span className="muted">{t.columns.review}:</span> {game.review}
          </p>
        )}

        {d && d.screenshots.length > 0 && (
          <section className="details-section">
            <h3>{t.details.screenshots}</h3>
            {screenshot ? (
              <button type="button" className="details-lightbox" onClick={() => setScreenshot(null)} aria-label={t.close}>
                <img src={igdbImageUrl(screenshot, "t_screenshot_big")} alt="" />
              </button>
            ) : (
              <div className="details-strip">
                {d.screenshots.map((url) => (
                  <button key={url} type="button" className="details-thumb" onClick={() => setScreenshot(url)}>
                    <img src={url} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {d && d.videos.length > 0 && (
          <section className="details-section">
            <h3>{t.details.videos}</h3>
            {playing ? (
              <div className="details-video">
                <iframe
                  src={`${youtubeEmbedUrl(playing)}?autoplay=1`}
                  title={d.videos.find((v) => v.id === playing)?.name ?? "Video"}
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
                <button type="button" className="button button-small" onClick={() => setPlaying(null)}>
                  {t.close}
                </button>
              </div>
            ) : (
              <div className="details-strip">
                {d.videos.map((video) => (
                  <button key={video.id} type="button" className="details-thumb details-thumb-video" onClick={() => setPlaying(video.id)} title={video.name}>
                    <img src={youtubeThumbnailUrl(video.id)} alt="" loading="lazy" />
                    <span className="play-badge" aria-hidden="true">
                      ▶
                    </span>
                    <span className="details-thumb-label">{video.name}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {(related.length > 0 || (d && (d.collection || d.franchises.length > 0))) && (
          <section className="details-section">
            <h3>{t.details.series}</h3>
            {d && (d.collection || d.franchises.length > 0) && (
              <p className="details-line muted">
                {d.collection && (
                  <span>
                    {t.details.collection}: {d.collection}
                  </span>
                )}
                {d.franchises.length > 0 && (
                  <span>
                    {t.details.franchise}: {d.franchises.join(", ")}
                  </span>
                )}
              </p>
            )}
            {related.length > 0 ? (
              <ul className="details-related">
                {related.map((g) => (
                  <li key={g.id}>
                    <span className="title-text">{g.title}</span>
                    {g.seriesOrder !== null && <span className="muted"> #{g.seriesOrder}</span>}
                    <span className={`status status-${g.status}`}>{statusLabels[g.status]}</span>
                    <span className="muted">{platformLabels[g.platform]}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">{t.details.noRelated}</p>
            )}
          </section>
        )}

        {d && d.similarGames.length > 0 && (
          <section className="details-section">
            <h3>{t.details.similar}</h3>
            <div className="similar-grid">
              {d.similarGames.map((similar) => {
                const inLibrary = games.find((g) => g.source === "igdb" && g.externalId === similar.igdbId);
                return (
                  <div key={similar.igdbId} className="similar-card">
                    {similar.coverUrl ? (
                      <img src={thumbnailUrl(similar.coverUrl, 120)} alt="" loading="lazy" />
                    ) : (
                      <span className="similar-cover-empty" aria-hidden="true" />
                    )}
                    <span className="similar-title">{similar.title}</span>
                    {inLibrary ? (
                      <span className="muted">{t.search.inLibrary}</span>
                    ) : (
                      <button
                        type="button"
                        className="button button-small"
                        disabled={busy !== null}
                        onClick={() => void addSimilar(similar)}
                      >
                        {busy === `add-${similar.igdbId}` ? t.search.loadingDetails : `+ ${t.details.addToPlan}`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {error && <p className="field-error">{error}</p>}

        <footer className="modal-actions details-footer">
          {linked && (
            <span className="muted details-fetched">
              {d ? t.details.fetchedAt.replace("{date}", formatDate(d.fetchedAt.slice(0, 10))) : t.details.noDetails}
            </span>
          )}
          {linked && (
            <button type="button" className="button" onClick={() => void refresh()} disabled={busy !== null}>
              {busy === "refresh" ? t.search.loadingDetails : t.details.refresh}
            </button>
          )}
          {!linked && <span className="muted details-fetched">{t.details.notLinked}</span>}
          <button type="button" className="button button-primary" onClick={onClose}>
            {t.close}
          </button>
        </footer>
      </div>
    </Modal>
  );
}

/** Other library games in the same series, collection or franchise. */
function relatedGames(games: readonly Game[], game: Game): Game[] {
  const keys = new Set<string>();
  if (game.series) keys.add(`s:${game.series.trim().toLowerCase()}`);
  if (game.details?.collection) keys.add(`c:${game.details.collection.toLowerCase()}`);
  for (const f of game.details?.franchises ?? []) keys.add(`f:${f.toLowerCase()}`);
  if (keys.size === 0) return [];
  return games
    .filter((g) => g.id !== game.id)
    .filter(
      (g) =>
        (g.series && keys.has(`s:${g.series.trim().toLowerCase()}`)) ||
        (g.details?.collection && keys.has(`c:${g.details.collection.toLowerCase()}`)) ||
        (g.details?.franchises ?? []).some((f) => keys.has(`f:${f.toLowerCase()}`)),
    )
    .sort((a, b) => (a.seriesOrder ?? 999) - (b.seriesOrder ?? 999) || a.title.localeCompare(b.title));
}

function failure(error: unknown): string {
  if (error instanceof ProviderError) {
    if (error.reason === "no-credentials") return t.search.noCredentials;
    if (error.reason === "unauthorized") return t.search.unauthorized;
    if (error.reason === "network") return t.search.network;
  }
  return t.search.error;
}
