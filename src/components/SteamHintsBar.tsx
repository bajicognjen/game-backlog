import { useMemo } from "react";
import { formatDate, todayIso } from "../domain/dates";
import { formatHours } from "../domain/format";
import { dismissHint, statusHints, type StatusHint } from "../domain/steamHints";
import { SCHEDULED_PLATFORM, type Game } from "../domain/types";
import { t } from "../i18n/en";
import { useRecentSteam, useSteamAchievements } from "../state/steam";
import { useStore } from "../state/store";
import { Icon } from "./Icon";

interface Props {
  /** Open the Finish dialog for a game, with the finish date set to `day`. */
  onFinish(game: Game, day: string): void;
}

/**
 * Above the PC plan: what Steam suggests about a game's status (finished,
 * being played, gone quiet), each with the change one click away and
 * "Not now". Hidden without hints.
 */
export function SteamHintsBar({ onFinish }: Props) {
  const snapshot = useRecentSteam();
  const games = useStore((s) => s.games);
  const sessions = useStore((s) => s.sessions);
  const dismissed = useStore((s) => s.settings.steamDismissedHints);
  /** When the current game started; it is not quiet before a month of that has passed. */
  const currentSince = useStore((s) => s.settings.startDate);
  const setGameStatus = useStore((s) => s.setGameStatus);
  const updateSettings = useStore((s) => s.updateSettings);

  // Only games being played or paused can turn out finished; a handful of requests at most.
  const unfinished = useMemo(
    () => games.filter((g) => g.platform === SCHEDULED_PLATFORM && (g.status === "in_progress" || g.status === "paused")),
    [games],
  );
  const achievements = useSteamAchievements(unfinished);

  const hints = useMemo(
    () =>
      snapshot ? statusHints(games, sessions, snapshot.owned, snapshot.baseApps, todayIso(), dismissed, currentSince, achievements) : [],
    [snapshot, games, sessions, dismissed, currentSince, achievements],
  );
  if (hints.length === 0) return null;

  function notNow(hint: StatusHint) {
    void updateSettings({ steamDismissedHints: dismissHint(dismissed, hints, hint.key) });
  }

  function act(hint: StatusHint) {
    if (hint.kind === "finished") onFinish(hint.game, hint.achievement.day);
    else void setGameStatus(hint.game.id, hint.kind === "playing" ? "in_progress" : "paused");
  }

  return (
    <div className="steam-hints" role="status">
      <Icon name="info" size={18} className="steam-hints-icon" />
      <div className="steam-hints-body">
        <strong>{t.steamHints.title}</strong>
        <ul>
          {hints.map((hint) => (
            <li key={hint.key}>
              <span>{describe(hint)}</span>
              <span className="steam-hints-actions">
                <button
                  type="button"
                  className={`button button-small ${hint.kind === "finished" ? "button-success" : ""}`}
                  onClick={() => act(hint)}
                >
                  {actionLabel(hint)}
                </button>
                <button
                  type="button"
                  className="button button-small button-ghost"
                  onClick={() => notNow(hint)}
                  aria-label={t.steamHints.notNowLabel.replace("{title}", hint.game.title)}
                >
                  {t.steamHints.notNow}
                </button>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function describe(hint: StatusHint): string {
  switch (hint.kind) {
    case "finished": {
      const { name, description, day } = hint.achievement;
      return t.steamHints.finished
        .replace("{title}", hint.game.title)
        .replace("{date}", formatDate(day))
        .replace("{achievement}", description ? `“${name}”: ${description.replace(/\.$/, "")}` : `“${name}”`);
    }
    case "playing":
      return (hint.game.status === "paused" ? t.steamHints.playingPaused : t.steamHints.playing)
        .replace("{title}", hint.game.title)
        .replace("{hours}", formatHours(hint.hours));
    case "idle":
      return t.steamHints.idle
        .replace("{title}", hint.game.title)
        .replace("{date}", formatDate(hint.lastPlayed))
        .replace("{weeks}", String(Math.floor(hint.days / 7)));
  }
}

function actionLabel(hint: StatusHint): string {
  switch (hint.kind) {
    case "finished":
      return t.steamHints.finish;
    case "idle":
      return t.steamHints.pause;
    case "playing":
      return hint.game.status === "paused" ? t.steamHints.resume : t.steamHints.start;
  }
}
