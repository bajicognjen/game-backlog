import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { formatDate } from "../domain/dates";
import { formatHours } from "../domain/format";
import { lastPlayedDay, minutesToHours, steamLibrary, steamWishlist, type SteamOwnedGame, type SteamWishlistEntry } from "../domain/steam";
import type { SteamStoreItem } from "../domain/steamStore";
import { t } from "../i18n/en";
import { steamFailureOf, type SteamFailure } from "../platform/steam";
import { loadSteam, loadWishlist, steamFailureMessage, type SteamSnapshot } from "../state/steam";
import { useStore } from "../state/store";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import { useRovingGroup } from "./useRoving";

interface Props {
  /** Open the Add game form for this Steam game; its name goes into the IGDB search. */
  onAdd(steamName: string): void;
  onClose(): void;
}

type Stage<T> = { kind: "loading" } | { kind: "failed"; reason: SteamFailure } | { kind: "ready"; data: T };

type View = "notPlayed" | "played" | "all" | "wishlist" | "hidden";
const VIEWS: View[] = ["notPlayed", "played", "all", "wishlist", "hidden"];

/** One line of the list: a game owned on Steam, or one on the wishlist. */
type Row = { source: "owned"; appid: number; name: string; owned: SteamOwnedGame } | { source: "wishlist"; appid: number; name: string; entry: SteamWishlistEntry };

const ownedRow = (owned: SteamOwnedGame): Row => ({ source: "owned", appid: owned.appid, name: owned.name, owned });
const wishRow = (entry: SteamWishlistEntry): Row => ({ source: "wishlist", appid: entry.appid, name: entry.name, entry });

/**
 * A triage list, not a sync: the Steam games (owned or wishlisted) the app
 * does not have yet, each either added to the plan through the normal Add
 * game form or hidden for good. What is left is only what has not been
 * decided; new purchases and wishes show up the next time it opens.
 */
export function SteamLibraryDialog({ onAdd, onClose }: Props) {
  const games = useStore((s) => s.games);
  const hiddenApps = useStore((s) => s.settings.steamHiddenApps);
  const updateSettings = useStore((s) => s.updateSettings);
  const [stage, setStage] = useState<Stage<SteamSnapshot>>({ kind: "loading" });
  /** The wishlist loads on its own: a private one must not hide the library. */
  const [wishStage, setWishStage] = useState<Stage<SteamWishlistEntry[]>>({ kind: "loading" });
  /** Bumped by "Try again"; the effect fetches once per value. */
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<View>("notPlayed");
  const switchRef = useRef<HTMLDivElement>(null);
  const roving = useRovingGroup(switchRef, { selector: '[role="radio"]', entry: '[aria-checked="true"]', activateOnMove: true });

  useEffect(() => {
    const controller = new AbortController();
    setStage({ kind: "loading" });
    setWishStage({ kind: "loading" });
    const settle = <T,>(load: Promise<T>, set: (stage: Stage<T>) => void) =>
      load.then(
        (data) => !controller.signal.aborted && set({ kind: "ready", data }),
        (error) => !controller.signal.aborted && set({ kind: "failed", reason: steamFailureOf(error) }),
      );
    void settle(loadSteam(controller.signal), setStage);
    void settle(loadWishlist(controller.signal), setWishStage);
    return () => controller.abort();
  }, [attempt]);

  const snapshot = stage.kind === "ready" ? stage.data : null;
  const wishEntries = wishStage.kind === "ready" ? wishStage.data : null;
  // Recomputed from the live library, so a game disappears as soon as it is added.
  const library = useMemo(() => (snapshot ? steamLibrary(games, snapshot.owned, hiddenApps, snapshot.baseApps) : null), [snapshot, games, hiddenApps]);
  const wishlist = useMemo(
    () => (wishEntries ? steamWishlist(games, wishEntries, hiddenApps, snapshot?.baseApps ?? new Map()) : null),
    [wishEntries, games, hiddenApps, snapshot],
  );

  const lists: Record<View, Row[]> = useMemo(() => {
    const notPlayed = (library?.notPlayed ?? []).map(ownedRow);
    const played = (library?.played ?? []).map(ownedRow);
    const hidden = [...(library?.hidden ?? []).map(ownedRow), ...(wishlist?.hidden ?? []).map(wishRow)].sort((a, b) => a.name.localeCompare(b.name));
    return {
      notPlayed,
      played,
      all: [...notPlayed, ...played].sort((a, b) => a.name.localeCompare(b.name)),
      wishlist: (wishlist?.wishlist ?? []).map(wishRow),
      hidden,
    };
  }, [library, wishlist]);
  const undecided = lists.all.length;

  function hide(appId: number) {
    if (!hiddenApps.includes(appId)) void updateSettings({ steamHiddenApps: [...hiddenApps, appId] });
  }

  function unhide(appId: number) {
    void updateSettings({ steamHiddenApps: hiddenApps.filter((id) => id !== appId) });
  }

  const rows = lists[view];
  const counting = (option: View) => option === "wishlist" && wishStage.kind !== "ready";

  return (
    <Modal title={t.steamLibrary.dialogTitle} onClose={onClose} size="xl">
      {stage.kind === "loading" && (
        <p className="modal-text muted" aria-busy="true">
          {t.steam.loading}
        </p>
      )}

      {stage.kind === "failed" && (
        <p className="modal-text" role="alert">
          {steamFailureMessage(stage.reason)}
        </p>
      )}

      {library && (
        <>
          <p className="modal-text">{undecided === 0 ? t.steamLibrary.allSorted : t.steamLibrary.intro.replace("{count}", String(undecided))}</p>

          <div
            ref={switchRef}
            className="tabs steam-views"
            role="radiogroup"
            aria-label={t.steamLibrary.viewLabel}
            onFocus={roving.onFocus}
            onKeyDown={roving.onKeyDown}
          >
            {VIEWS.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={view === option}
                className={`tab ${view === option ? "tab-active" : ""}`}
                onClick={() => setView(option)}
              >
                {t.steamLibrary.views[option]}
                <span className="tab-count">{counting(option) ? "…" : lists[option].length}</span>
              </button>
            ))}
          </div>

          {view === "wishlist" && wishStage.kind !== "ready" ? (
            <p className="modal-text muted steam-library-empty" role={wishStage.kind === "failed" ? "alert" : undefined}>
              {wishStage.kind === "failed" ? steamFailureMessage(wishStage.reason) : t.steamLibrary.wishlistLoading}
            </p>
          ) : rows.length === 0 ? (
            <p className="modal-text muted steam-library-empty">{t.steamLibrary.empty[view]}</p>
          ) : (
            <div className="steam-library-scroll">
              <table className="table steam-library">
                <thead>
                  <tr>
                    <th scope="col">{t.steamLibrary.colGame}</th>
                    {view === "wishlist" ? (
                      <>
                        <th scope="col" className="date">
                          {t.steamLibrary.colReleased}
                        </th>
                        <th scope="col">{t.steamLibrary.colReviews}</th>
                        <th scope="col">{t.steamLibrary.colDeck}</th>
                      </>
                    ) : view === "hidden" ? (
                      <th scope="col">{t.steamLibrary.colWhere}</th>
                    ) : (
                      <>
                        <th scope="col" className="num">
                          {t.steamLibrary.colHours}
                        </th>
                        <th scope="col" className="date">
                          {t.steamLibrary.colLastPlayed}
                        </th>
                      </>
                    )}
                    <th scope="col" aria-label={t.steamLibrary.colActions} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.source}-${row.appid}`}>
                      <td className="title">{row.name}</td>
                      {view === "hidden" ? (
                        <td className="muted">{row.source === "owned" ? t.steamLibrary.inLibrary : t.steamLibrary.onWishlist}</td>
                      ) : row.source === "owned" ? (
                        <OwnedCells owned={row.owned} />
                      ) : (
                        <StoreCells store={row.entry.store} />
                      )}
                      <td className="steam-library-actions">
                        {view === "hidden" ? (
                          <button type="button" className="button button-small" onClick={() => unhide(row.appid)}>
                            {t.steamLibrary.unhide}
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="button button-small"
                              onClick={() => onAdd(row.name)}
                              aria-label={t.steamLibrary.addLabel.replace("{title}", row.name)}
                            >
                              <Icon name="plus" size={14} /> {t.steamLibrary.add}
                            </button>
                            <button
                              type="button"
                              className="button button-small button-ghost"
                              onClick={() => hide(row.appid)}
                              aria-label={t.steamLibrary.hideLabel.replace("{title}", row.name)}
                              title={t.steamLibrary.hideTitle}
                            >
                              {t.steamLibrary.hide}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="steam-library-hint">{view === "wishlist" ? t.steamLibrary.wishlistHint : t.steamLibrary.hint}</p>
        </>
      )}

      <footer className="modal-actions">
        {stage.kind === "failed" && stage.reason !== "no-credentials" && (
          <button type="button" className="button" onClick={() => setAttempt((n) => n + 1)}>
            <Icon name="refresh" /> {t.steam.retry}
          </button>
        )}
        <button type="button" className="button" onClick={onClose}>
          {t.close}
        </button>
      </footer>
    </Modal>
  );
}

/** Hours and last-played day of an owned game. */
function OwnedCells({ owned }: { owned: SteamOwnedGame }) {
  const played = owned.playtime_forever > 0;
  const day = lastPlayedDay(owned);
  return (
    <>
      <td className="num">{played ? `${formatHours(Math.max(0.1, minutesToHours(owned.playtime_forever)))} h` : <span className="muted">—</span>}</td>
      <td className="date">{day ? formatDate(day) : <span className="muted">{played ? "—" : t.steamLibrary.neverPlayed}</span>}</td>
    </>
  );
}

/** Release, reviews and Steam Deck rating of a wishlisted game, from the store. */
function StoreCells({ store }: { store: SteamStoreItem | null }) {
  const muted = (text: ReactNode) => <span className="muted">{text}</span>;
  return (
    <>
      <td className="date">{store?.comingSoon ? muted(t.steamStore.comingSoon) : store?.releaseDate ? formatDate(store.releaseDate) : muted("—")}</td>
      <td>
        {store?.reviewLabel ? (
          <>
            {store.reviewLabel}
            {store.reviewPercent !== null && <span className="muted"> · {store.reviewPercent}%</span>}
          </>
        ) : (
          muted("—")
        )}
      </td>
      <td className={store && (store.deck === "verified" || store.deck === "playable") ? undefined : "muted"}>{t.steamStore.deck[store?.deck ?? "unknown"]}</td>
    </>
  );
}
