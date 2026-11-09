import { useEffect, useState } from "react";
import { finishHint, unlockedNewestFirst, type FinishHint, type UnlockedAchievement } from "../domain/achievements";
import { formatDate } from "../domain/dates";
import { steamConfigured } from "../domain/steam";
import { SCHEDULED_PLATFORM, type Game } from "../domain/types";
import { t } from "../i18n/en";
import { loadAchievementsFor } from "../state/steam";
import { useStore } from "../state/store";

interface Props {
  game: Game;
  /** The date in the form now, so the offered one shows as taken once used. */
  value: string;
  onUse(day: string): void;
}

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "failed" }
  | { kind: "ready"; hint: FinishHint; unlocked: UnlockedAchievement[] };

/**
 * Under a finish date: when Steam's achievements say when the game was
 * finished, offer that day. Nothing changes until "Use this date"; a game
 * Steam knows nothing about shows nothing.
 */
export function SteamFinishHint({ game, value, onUse }: Props) {
  const ready = useStore((s) => steamConfigured(s.settings));
  const onSteam = ready && game.platform === SCHEDULED_PLATFORM;
  const [state, setState] = useState<State>({ kind: "idle" });
  const [choosing, setChoosing] = useState(false);

  useEffect(() => {
    if (!onSteam) return;
    const controller = new AbortController();
    setState({ kind: "loading" });
    loadAchievementsFor(game, controller.signal)
      .then((list) => {
        if (controller.signal.aborted) return;
        setState({ kind: "ready", hint: list ? finishHint(list) : { kind: "none" }, unlocked: list ? unlockedNewestFirst(list) : [] });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ kind: "failed" });
      });
    return () => controller.abort();
    // The game object is replaced on every reload; its id is what matters.
  }, [onSteam, game.id]);

  if (!onSteam || state.kind === "idle") return null;
  if (state.kind === "loading") return <p className="steam-hint muted">{t.steamFinish.checking}</p>;
  if (state.kind === "failed") return <p className="steam-hint muted">{t.steamFinish.failed}</p>;
  const { hint, unlocked } = state;
  if (hint.kind === "none" && unlocked.length === 0) return null;

  const useButton = (day: string) =>
    day === value ? (
      <span className="steam-hint-used">{t.steamFinish.used}</span>
    ) : (
      <button type="button" className="button button-small" onClick={() => onUse(day)}>
        {t.steamFinish.use}
      </button>
    );

  return (
    <div className="steam-hint" aria-live="polite">
      {hint.kind === "ending" && (
        <p className="steam-hint-line">
          <span>
            {t.steamFinish.ending.replace("{achievement}", quoted(hint.achievement)).replace("{date}", formatDate(hint.achievement.day))}
          </span>
          {useButton(hint.achievement.day)}
        </p>
      )}
      {hint.kind === "endingLocked" && (
        <p className="steam-hint-line">
          <span>{t.steamFinish.endingLocked.replace("{achievement}", quoted(hint))}</span>
        </p>
      )}
      {hint.kind === "latest" && (
        <p className="steam-hint-line">
          <span>{t.steamFinish.latest.replace("{achievement}", quoted(hint.achievement)).replace("{date}", formatDate(hint.achievement.day))}</span>
          {useButton(hint.achievement.day)}
        </p>
      )}
      {unlocked.length > 0 && (
        <>
          <button type="button" className="link-button link-accent steam-hint-toggle" aria-expanded={choosing} onClick={() => setChoosing((open) => !open)}>
            {(choosing ? t.steamFinish.hideList : t.steamFinish.choose).replace("{count}", String(unlocked.length))}
          </button>
          {choosing && (
            <ul className="steam-achievements" aria-label={t.steamFinish.listLabel}>
              {unlocked.map((a) => (
                <li key={`${a.unlockedAt}-${a.name}`}>
                  <button
                    type="button"
                    className={`steam-achievement ${a.day === value ? "steam-achievement-used" : ""}`}
                    onClick={() => onUse(a.day)}
                    aria-label={t.steamFinish.pickLabel.replace("{achievement}", a.name).replace("{date}", formatDate(a.day))}
                  >
                    <span className="steam-achievement-date">{formatDate(a.day)}</span>
                    <span className="steam-achievement-name">{a.name}</span>
                    {a.description && <span className="steam-achievement-desc">{a.description}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

/** “Name” (description), or just “Name” for a hidden achievement. */
function quoted(a: { name: string; description: string }): string {
  return a.description ? `“${a.name}” (${a.description.replace(/\.$/, "")})` : `“${a.name}”`;
}
