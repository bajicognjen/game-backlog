import { useMemo, useState, type FormEvent } from "react";
import { formatDate, isValidIsoDate, todayIso } from "../domain/dates";
import { formatHours } from "../domain/format";
import { planHours } from "../domain/schedule";
import { sessionsOf } from "../domain/sessions";
import type { Game } from "../domain/types";
import { t } from "../i18n/en";
import { useStore } from "../state/store";
import { DateField } from "./DateField";
import { Icon } from "./Icon";
import { Modal } from "./Modal";

interface Props {
  game: Game;
  onClose(): void;
}

/** Log a play session and see the ones already logged for this game. */
export function SessionDialog({ game: initial, onClose }: Props) {
  // Follow the store so the list and totals refresh after each write.
  const game = useStore((s) => s.games.find((g) => g.id === initial.id)) ?? initial;
  const all = useStore((s) => s.sessions);
  const logSession = useStore((s) => s.logSession);
  const removeSession = useStore((s) => s.removeSession);
  const sessions = useMemo(() => sessionsOf(all, game.id), [all, game.id]);

  const [playedOn, setPlayedOn] = useState(todayIso());
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Session whose delete is waiting for a second click. */
  const [confirmId, setConfirmId] = useState<number | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = Number(hours.replace(",", "."));
    if (!isValidIsoDate(playedOn)) return setError(t.sessions.invalidDate);
    if (hours.trim() === "" || !Number.isFinite(value) || value <= 0) return setError(t.sessions.invalidHours);
    setError(null);
    setBusy(true);
    const ok = await logSession({ gameId: game.id, playedOn, hours: value, note: note.trim() === "" ? null : note.trim() });
    setBusy(false);
    if (ok) {
      setHours("");
      setNote("");
    }
  }

  const remaining = planHours(game);
  const summary =
    game.casualHours > 0
      ? t.sessions.summary
          .replace("{played}", formatHours(game.hoursPlayed))
          .replace("{estimate}", formatHours(game.casualHours))
          .replace("{remaining}", formatHours(remaining))
      : t.sessions.summaryNoEstimate.replace("{played}", formatHours(game.hoursPlayed));

  return (
    <Modal title={`${t.sessions.title}: ${game.title}`} onClose={onClose}>
      <p className="modal-text">{summary}</p>

      <form className="form session-form" onSubmit={(event) => void submit(event)} noValidate>
        <div className="form-row form-row-session">
          <div className="field">
            <span className="field-label">{t.sessions.playedOn}</span>
            <DateField value={playedOn} onChange={setPlayedOn} ariaLabel={t.sessions.playedOn} invalid={error === t.sessions.invalidDate} />
          </div>
          <label className="field">
            <span className="field-label">{t.sessions.hours}</span>
            <input
              type="number"
              inputMode="decimal"
              min={0.25}
              step={0.25}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              aria-invalid={error === t.sessions.invalidHours}
              data-autofocus="true"
            />
          </label>
          <label className="field">
            <span className="field-label">{t.sessions.note}</span>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <button type="submit" className="button button-primary" disabled={busy}>
            <Icon name="plus" /> {t.sessions.add}
          </button>
        </div>
        {error && (
          <span className="field-error" role="alert">
            {error}
          </span>
        )}
      </form>

      {sessions.length === 0 ? (
        <p className="modal-text muted session-empty">{t.sessions.empty}</p>
      ) : (
        <table className="table session-table">
          <tbody>
            {sessions.map((session) => (
              <tr key={session.id}>
                <td className="date">{formatDate(session.playedOn)}</td>
                <td className="num">{formatHours(session.hours)} h</td>
                <td className="note">{session.note}</td>
                <td className="actions-col">
                  {confirmId === session.id ? (
                    <span className="session-confirm">
                      <span className="muted">{t.sessions.confirmDelete}</span>
                      <button
                        type="button"
                        className="button button-danger button-small"
                        onClick={() => {
                          setConfirmId(null);
                          void removeSession(session.id);
                        }}
                      >
                        {t.actions.delete}
                      </button>
                      <button type="button" className="button button-small" onClick={() => setConfirmId(null)}>
                        {t.sessions.keep}
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="button button-icon-sm"
                      title={t.actions.delete}
                      aria-label={t.actions.delete}
                      onClick={() => setConfirmId(session.id)}
                    >
                      <Icon name="trash" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <footer className="modal-actions">
        <button type="button" className="button" onClick={onClose}>
          {t.close}
        </button>
      </footer>
    </Modal>
  );
}
