import { useEffect, useState } from "react";
import { isValidIsoDate } from "../domain/dates";
import { autoBackupFolder } from "../platform/autoBackup";
import { ProviderError } from "../platform/http";
import { appVersion } from "../platform/updates";
import { fetchDesignRefresh } from "../state/designs";
import { useStore } from "../state/store";
import { useUpdates } from "../state/updates";
import { t } from "../i18n/en";
import { failureMessage } from "./GameSearch";

/**
 * Start date and weekly hours. Each field keeps its own draft so the user can
 * type freely; only valid values reach the store (and recalculate the plan).
 */
export function SettingsPanel() {
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
  const [igdbClientSecret, setIgdbClientSecret] = useState(settings.igdbClientSecret);

  // Keep drafts in sync when the store changes from elsewhere (e.g. finishing a game).
  useEffect(() => setStartDate(settings.startDate), [settings.startDate]);
  useEffect(() => setHours(String(settings.hoursPerWeek)), [settings.hoursPerWeek]);
  useEffect(() => setIgdbClientId(settings.igdbClientId), [settings.igdbClientId]);
  useEffect(() => setIgdbClientSecret(settings.igdbClientSecret), [settings.igdbClientSecret]);

  /** Save a credential on blur; a changed credential also forgets the cached token. */
  function commit(field: "igdbClientId" | "igdbClientSecret", value: string) {
    const next = value.trim();
    if (next === settings[field]) return;
    void updateSettings({ [field]: next, igdbAccessToken: "", igdbTokenExpiresAt: 0 });
  }

  const startDateValid = isValidIsoDate(startDate);
  const hoursNumber = Number(hours.replace(",", "."));
  const hoursValid = hours.trim() !== "" && Number.isFinite(hoursNumber) && hoursNumber > 0;

  function onStartDateChange(value: string) {
    setStartDate(value);
    if (isValidIsoDate(value) && value !== settings.startDate) void updateSettings({ startDate: value });
  }

  function onHoursChange(value: string) {
    setHours(value);
    const parsed = Number(value.replace(",", "."));
    if (value.trim() !== "" && Number.isFinite(parsed) && parsed > 0 && parsed !== settings.hoursPerWeek) {
      void updateSettings({ hoursPerWeek: parsed });
    }
  }

  return (
    <section className="card settings" id="settings-panel" aria-label={t.settings.title}>
      <div className="settings-fields">
        <label className="field">
          <span className="field-label">{t.settings.startDate}</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
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
            onChange={(e) => onHoursChange(e.target.value)}
            aria-invalid={!hoursValid}
            required
          />
          {!hoursValid && <span className="field-error">{t.settings.invalidHours}</span>}
        </label>
      </div>
      <p className="hint">{t.settings.hint}</p>

      <div className="settings-fields settings-fields-secondary">
        <label className="field">
          <span className="field-label">{t.search.igdbClientId}</span>
          <input
            type="text"
            value={igdbClientId}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setIgdbClientId(e.target.value)}
            onBlur={() => commit("igdbClientId", igdbClientId)}
          />
        </label>
        <label className="field">
          <span className="field-label">{t.search.igdbClientSecret}</span>
          <input
            type="password"
            value={igdbClientSecret}
            autoComplete="off"
            onChange={(e) => setIgdbClientSecret(e.target.value)}
            onBlur={() => commit("igdbClientSecret", igdbClientSecret)}
          />
        </label>
        <p className="field-hint settings-hint-wide">{t.search.igdbHint}</p>
      </div>
      <div className="settings-fields settings-fields-secondary">
        <div className="field field-wide">
          <span className="field-label">{t.settings.designsTitle}</span>
          <div>
            <button type="button" className="button" onClick={() => void refreshDesigns()} disabled={refresh !== null}>
              {refresh === null
                ? t.settings.designsRefresh
                : t.settings.designsProgress.replace("{done}", String(refresh.done)).replace("{total}", String(refresh.total))}
            </button>
          </div>
          {refreshError && <span className="field-error">{refreshError}</span>}
          <span className="field-hint">{t.settings.designsHint}</span>
        </div>
      </div>
      {backupFolder && (
        <div className="settings-fields settings-fields-secondary">
          <div className="field field-wide">
            <span className="field-label">{t.backup.autoTitle}</span>
            <code className="path">{backupFolder}</code>
            <span className="field-hint">{t.backup.autoHint}</span>
          </div>
        </div>
      )}
      {version && (
        <div className="settings-fields settings-fields-secondary">
          <div className="field field-wide">
            <span className="field-label">{t.updates.title}</span>
            <div>
              {t.updates.version.replace("{version}", version)}{" "}
              <button type="button" className="button" onClick={() => void checkUpdates()} disabled={updateStatus === "checking" || updateStatus === "installing"}>
                {updateStatus === "checking" ? t.updates.checking : t.updates.check}
              </button>
            </div>
            {updateStatus === "upToDate" && <span className="field-hint">{t.updates.upToDate}</span>}
            {updateStatus === "checkFailed" && <span className="field-error">{t.updates.checkFailed}</span>}
            <span className="field-hint">{t.updates.hint}</span>
          </div>
        </div>
      )}
    </section>
  );
}
