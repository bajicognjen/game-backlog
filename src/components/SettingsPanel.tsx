import { useEffect, useState, type KeyboardEvent } from "react";
import { isValidIsoDate } from "../domain/dates";
import { autoBackupFolder } from "../platform/autoBackup";
import { ProviderError } from "../platform/http";
import { appVersion } from "../platform/updates";
import { fetchDesignRefresh } from "../state/designs";
import { useStore } from "../state/store";
import { useUpdates } from "../state/updates";
import { t } from "../i18n/en";
import { failureMessage } from "./GameSearch";
import { Icon } from "./Icon";

/**
 * Plan settings, IGDB credentials, maintenance and app info. Each field keeps
 * its own draft while you type; valid values reach the store when you leave
 * the field (or press Enter), and the plan recalculates then.
 */
export function SettingsPanel({ onClose }: { onClose(): void }) {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const updateGames = useStore((s) => s.updateGames);
  /** Progress of the design refresh while it runs; null when idle. */
  const [refresh, setRefresh] = useState<{ done: number; total: number } | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  async function refreshDesigns() {
    setRefreshError(null);
    setRefresh({ done: 0, total: 0 });
    try {
      const result = await fetchDesignRefresh(useStore.getState().games, (done, total) => setRefresh({ done, total }));
      const notice =
        t.settings.designsRefreshed.replace("{refreshed}", String(result.updates.length)).replace("{changed}", String(result.changed)) +
        (result.failed > 0 ? ` ${t.settings.designsFailed.replace("{failed}", String(result.failed))}` : "");
      await updateGames(result.updates, notice);
    } catch (error) {
      setRefreshError(failureMessage(error instanceof ProviderError ? error.reason : "other"));
    } finally {
      setRefresh(null);
    }
  }

  const [startDate, setStartDate] = useState(settings.startDate);
  const [hours, setHours] = useState(String(settings.hoursPerWeek));
  const [igdbClientId, setIgdbClientId] = useState(settings.igdbClientId);
  const [igdbClientSecret, setIgdbClientSecret] = useState(settings.igdbClientSecret);
  const [backupFolder, setBackupFolder] = useState<string | null>(null);
  useEffect(() => {
    void autoBackupFolder().then(setBackupFolder);
  }, []);
  /** Installed app version; null in the browser preview, which hides the update row. */
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    void appVersion().then(setVersion);
  }, []);
  const updateStatus = useUpdates((s) => s.status);
  const checkUpdates = useUpdates((s) => s.check);

  // Keep drafts in sync when the store changes from elsewhere (e.g. finishing a game).
  useEffect(() => setStartDate(settings.startDate), [settings.startDate]);
  useEffect(() => setHours(String(settings.hoursPerWeek)), [settings.hoursPerWeek]);
  useEffect(() => setIgdbClientId(settings.igdbClientId), [settings.igdbClientId]);
  useEffect(() => setIgdbClientSecret(settings.igdbClientSecret), [settings.igdbClientSecret]);

  /** Save a credential on blur; a changed credential also forgets the cached token. */
  function commitCredential(field: "igdbClientId" | "igdbClientSecret", value: string) {
    const next = value.trim();
    if (next === settings[field]) return;
    void updateSettings({ [field]: next, igdbAccessToken: "", igdbTokenExpiresAt: 0 });
  }

  const startDateValid = isValidIsoDate(startDate);
  const hoursNumber = Number(hours.replace(",", "."));
  const hoursValid = hours.trim() !== "" && Number.isFinite(hoursNumber) && hoursNumber > 0;

  function commitStartDate(value = startDate) {
    if (isValidIsoDate(value) && value !== settings.startDate) void updateSettings({ startDate: value });
  }

  function onStartDateChange(value: string) {
    setStartDate(value);
    // The picker hands over whole dates; typed ones commit on blur, so a half-typed year never reaches the plan.
    if (Number(value.slice(0, 4)) >= 1990) commitStartDate(value);
  }

  function commitHours() {
    if (hoursValid && hoursNumber !== settings.hoursPerWeek) void updateSettings({ hoursPerWeek: hoursNumber });
  }

  const commitOnEnter = (commit: () => void) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    }
  };

  return (
    <section className="card settings" id="settings-panel" aria-labelledby="settings-title">
      <header className="settings-head">
        <h2 id="settings-title">{t.settings.title}</h2>
        <button type="button" className="button button-ghost button-icon-sm" onClick={onClose} aria-label={t.settings.close} title={t.settings.close}>
          <Icon name="x" />
        </button>
      </header>

      <div className="settings-group">
        <h3>{t.settings.plan}</h3>
        <p className="settings-group-note">{t.settings.planNote}</p>
        <div className="settings-group-body">
          <label className="field">
            <span className="field-label">{t.settings.startDate}</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              onBlur={() => commitStartDate()}
              onKeyDown={commitOnEnter(() => commitStartDate())}
              aria-invalid={!startDateValid}
              required
            />
            {!startDateValid && <span className="field-error">{t.settings.invalidDate}</span>}
          </label>
          <label className="field">
            <span className="field-label">{t.settings.hoursPerWeek}</span>
            <input
              type="number"
              inputMode="decimal"
              min={0.5}
              step={0.5}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              onBlur={commitHours}
              onKeyDown={commitOnEnter(commitHours)}
              aria-invalid={!hoursValid}
              required
            />
            {!hoursValid && <span className="field-error">{t.settings.invalidHours}</span>}
          </label>
        </div>
      </div>

      <div className="settings-group">
        <h3>{t.settings.igdb}</h3>
        <p className="settings-group-note">{t.settings.igdbNote}</p>
        <div className="settings-group-body">
          <label className="field">
            <span className="field-label">{t.search.igdbClientId}</span>
            <input
              type="text"
              value={igdbClientId}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setIgdbClientId(e.target.value)}
              onBlur={() => commitCredential("igdbClientId", igdbClientId)}
            />
          </label>
          <label className="field">
            <span className="field-label">{t.search.igdbClientSecret}</span>
            <input
              type="password"
              value={igdbClientSecret}
              autoComplete="off"
              onChange={(e) => setIgdbClientSecret(e.target.value)}
              onBlur={() => commitCredential("igdbClientSecret", igdbClientSecret)}
            />
          </label>
          <p className="field-hint">{t.search.igdbHint}</p>
        </div>
      </div>

      <div className="settings-group">
        <h3>{t.settings.designsTitle}</h3>
        <p className="settings-group-note">{t.settings.designsHint}</p>
        <div className="settings-group-body">
          <div className="field">
            <div className="field-actions">
              <button type="button" className="button" onClick={() => void refreshDesigns()} disabled={refresh !== null}>
                <Icon name="refresh" />
                {refresh === null
                  ? t.settings.designsRefresh
                  : t.settings.designsProgress.replace("{done}", String(refresh.done)).replace("{total}", String(refresh.total))}
              </button>
            </div>
            {refreshError && <span className="field-error">{refreshError}</span>}
          </div>
        </div>
      </div>

      {backupFolder && (
        <div className="settings-group">
          <h3>{t.backup.autoTitle}</h3>
          <p className="settings-group-note">{t.backup.autoHint}</p>
          <div className="settings-group-body">
            <code className="path">{backupFolder}</code>
          </div>
        </div>
      )}

      {version && (
        <div className="settings-group">
          <h3>{t.updates.title}</h3>
          <p className="settings-group-note">{t.updates.hint}</p>
          <div className="settings-group-body">
            <div className="field">
              <div className="field-actions">
                <span>{t.updates.version.replace("{version}", version)}</span>
                <button
                  type="button"
                  className="button"
                  onClick={() => void checkUpdates()}
                  disabled={updateStatus === "checking" || updateStatus === "installing"}
                >
                  {updateStatus === "checking" ? t.updates.checking : t.updates.check}
                </button>
              </div>
              {updateStatus === "upToDate" && <span className="field-hint">{t.updates.upToDate}</span>}
              {updateStatus === "checkFailed" && <span className="field-error">{t.updates.checkFailed}</span>}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
