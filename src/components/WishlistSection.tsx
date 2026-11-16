import { useEffect, useMemo, useState } from "react";
import { formatDate } from "../domain/dates";
import { onSaleCount, steamConfigured, wishlistRows, type SteamWishlistEntry, type WishlistRow } from "../domain/steam";
import type { SteamStoreItem } from "../domain/steamStore";
import { t } from "../i18n/en";
import { openExternal } from "../platform/links";
import { steamFailureOf, type SteamFailure } from "../platform/steam";
import { loadWishlist, steamFailureMessage } from "../state/steam";
import { useStore } from "../state/store";
import { Icon } from "./Icon";

interface Props {
  /** Open the Add game form for this Steam game; its name goes into the IGDB search. */
  onAdd(steamName: string): void;
  /** Steam is not set up yet: take the user to Settings. */
  onSetUpSteam(): void;
}

type Stage = { kind: "idle" } | { kind: "loading" } | { kind: "failed"; reason: SteamFailure } | { kind: "ready"; entries: SteamWishlistEntry[] };

/**
 * The Steam wishlist with the store's current prices, collapsed by default.
 * Steam is asked the first time the section opens and on Refresh, not on
 * every start: the store answers per 50 games, and prices change slowly.
 * The list stays as loaded while the section is closed and reopened.
 */
export function WishlistSection({ onAdd, onSetUpSteam }: Props) {
  const games = useStore((s) => s.games);
  const configured = useStore((s) => steamConfigured(s.settings));
  const country = useStore((s) => s.settings.steamCountry);
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  /** Bumped by the first opening and by Refresh; the effect asks Steam once per value. */
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (attempt === 0 || !configured) return;
    const controller = new AbortController();
    setStage({ kind: "loading" });
    loadWishlist(controller.signal).then(
      (entries) => !controller.signal.aborted && setStage({ kind: "ready", entries }),
      (error) => !controller.signal.aborted && setStage({ kind: "failed", reason: steamFailureOf(error) }),
    );
    return () => controller.abort();
    // A new store country means new prices.
  }, [attempt, configured, country]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && stage.kind === "idle") setAttempt((n) => n + 1);
  }

  // Recomputed from the live games, so a game just added shows as in the app at once.
  const rows = useMemo(() => (stage.kind === "ready" ? wishlistRows(games, stage.entries) : []), [stage, games]);
  const onSale = onSaleCount(rows);
  const summary =
    stage.kind === "ready"
      ? `${t.wishlist.count.replace("{count}", String(rows.length))} · ${onSale > 0 ? t.wishlist.onSale.replace("{count}", String(onSale)) : t.wishlist.noneOnSale}`
      : null;

  return (
    <section className="section" aria-labelledby="wishlist-heading">
      <div className="section-head">
        <div className="section-title">
          <h2 id="wishlist-heading" tabIndex={-1}>
            {t.wishlist.title}
          </h2>
          <button type="button" className="button" onClick={toggle} aria-expanded={open} aria-controls="wishlist-panel">
            <Icon name={open ? "chevron-up" : "chevron-down"} /> {open ? t.wishlist.hide : t.wishlist.show}
          </button>
          {open && configured && stage.kind !== "idle" && (
            <button type="button" className="button" onClick={() => setAttempt((n) => n + 1)} disabled={stage.kind === "loading"}>
              <Icon name="refresh" /> {t.wishlist.refresh}
            </button>
          )}
        </div>
        {summary && <span className="wishlist-summary muted">{summary}</span>}
      </div>

      {open && (
        <div id="wishlist-panel">
          {!configured ? (
            <p className="wishlist-status muted">
              {t.wishlist.setUp}
              <button type="button" className="button button-small" onClick={onSetUpSteam}>
                {t.wishlist.openSettings}
              </button>
            </p>
          ) : stage.kind === "failed" ? (
            <p className="wishlist-status" role="alert">
              {steamFailureMessage(stage.reason)}
            </p>
          ) : stage.kind !== "ready" ? (
            <p className="wishlist-status muted" aria-busy="true">
              {t.steamLibrary.wishlistLoading}
            </p>
          ) : rows.length === 0 ? (
            <p className="wishlist-status muted">{t.wishlist.empty}</p>
          ) : (
            <>
              <div className="table-wrap wishlist-wrap">
                <table className="table wishlist-table">
                  <thead>
                    <tr>
                      <th scope="col">{t.steamLibrary.colGame}</th>
                      <th scope="col" className="num">
                        {t.wishlist.colPrice}
                      </th>
                      <th scope="col" className="num">
                        {t.wishlist.colDiscount}
                      </th>
                      <th scope="col" className="date">
                        {t.wishlist.colEnds}
                      </th>
                      <th scope="col">{t.steamLibrary.colReviews}</th>
                      <th scope="col" aria-label={t.steamLibrary.colActions} />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <WishlistLine key={row.entry.appid} row={row} onAdd={onAdd} />
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="wishlist-hint muted">{t.wishlist.hint.replace("{country}", country)}</p>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function WishlistLine({ row, onAdd }: { row: WishlistRow; onAdd(steamName: string): void }) {
  const { entry, inApp, discountPct } = row;
  const store = entry.store;
  const price = store?.price ?? null;
  const dash = <span className="muted">—</span>;
  return (
    <tr className={discountPct > 0 ? "row-sale" : undefined}>
      <td className="title">{entry.name}</td>
      <td className="num">
        <PriceCell store={store} />
      </td>
      <td className="num">{discountPct > 0 ? <span className="sale-badge">−{discountPct}%</span> : dash}</td>
      <td className="date">{price?.discountEndsAt ? formatDate(price.discountEndsAt) : dash}</td>
      <td>
        {store?.reviewLabel ? (
          <>
            {store.reviewLabel}
            {store.reviewPercent !== null && <span className="muted"> · {store.reviewPercent}%</span>}
          </>
        ) : (
          dash
        )}
      </td>
      <td className="wishlist-actions">
        {store && (
          <button
            type="button"
            className="button button-small button-ghost"
            onClick={() => void openExternal(store.storeUrl)}
            aria-label={t.wishlist.openStoreLabel.replace("{title}", entry.name)}
          >
            {t.wishlist.openStore} <Icon name="external" size={14} />
          </button>
        )}
        {inApp ? (
          <span className="muted">{t.wishlist.inApp}</span>
        ) : (
          <button type="button" className="button button-small" onClick={() => onAdd(entry.name)} aria-label={t.steamLibrary.addLabel.replace("{title}", entry.name)}>
            <Icon name="plus" size={14} /> {t.steamLibrary.add}
          </button>
        )}
      </td>
    </tr>
  );
}

/** The store's price: the current one, with the old one struck through on sale; "Free"; or a dash when the store does not sell the game on its own. */
function PriceCell({ store }: { store: SteamStoreItem | null }) {
  if (!store) return <span className="muted">—</span>;
  if (store.free) return <>{t.wishlist.free}</>;
  if (!store.price) return <span className="muted">{store.comingSoon ? t.steamStore.comingSoon : "—"}</span>;
  const { price } = store;
  return (
    <>
      {price.discountPct > 0 && <s className="muted price-was">{price.originalText}</s>}
      {price.finalText}
    </>
  );
}
