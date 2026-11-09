import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { isValidIsoDate } from "../domain/dates";
import { parseSteamIdInput, steamConfigured } from "../domain/steam";
import { autoBackupFolder } from "../platform/autoBackup";
import { ProviderError } from "../platform/http";
import { openExternal } from "../platform/links";
import { appVersion } from "../platform/updates";
import { fetchDesignRefresh } from "../state/designs";
import { useStore } from "../state/store";
import { useUpdates } from "../state/updates";
import { t } from "../i18n/en";
import { DateField } from "./DateField";
import { failureMessage } from "./GameSearch";
import { Icon } from "./Icon";
import { SteamAccount } from "./SteamAccount";
import { SteamImportDialog } from "./SteamImportDialog";

/**
 * Plan settings, IGDB credentials, maintenance and app info. Each field keeps
 * its own draft while you type; valid values reach the store when you leave
 * the field (or press Enter), and the plan recalculates then.
 */
interface Props {
  onClose(): void;
  /** Changes when a dialog sends the user here for IGDB; the Client ID field takes focus. */
  focusIgdb?: number;
}

const TWITCH_CONSOLE_URL = "https://dev.twitch.tv/console";
const STEAM_KEY_URL = "https://steamcommunity.com/dev/apikey";

export function SettingsPanel({ onClose, focusIgdb = 0 }: Props) {
  const settings = useStore((s) => s.settings);
  const clientIdRef = useRef<HTMLInputElement>(null);
  /** A connection that is set up folds to one status line; its form opens again with "Change". */
  const [igdbEditing, setIgdbEditing] = useState(false);
  const [steamEditing, setSteamEditing] = useState(false);
  const igdbReady = settings.igdbClientId !== "" && settings.igdbClientSecret !== "";
  const steamSaved = steamConfigured(settings);
  const showIgdbForm = !igdbReady || igdbEditing;
  const showSteamForm = !steamSaved || steamEditing;
  useEffect(() => {
    if (focusIgdb <= 0) return;
    // A dialog sent the user here for IGDB: open the form and put them in the Client ID field.
    setIgdbEditing(true);
    requestAnimationFrame(() => clientIdRef.current?.focus());
  }, [focusIgdb]);
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
  const [steamApiKey, setSteamApiKey] = useState(settings.steamApiKey);
  const [steamId, setSteamId] = useState(settings.steamId);
  const [steamImportOpen, setSteamImportOpen] = useState(false);
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
  useEffect(() => setSteamApiKey(settings.steamApiKey), [settings.steamApiKey]);
  useEffect(() => setSteamId(settings.steamId), [settings.steamId]);

  /** Save a credential on blur; a changed credential also forgets the cached token. */
  function commitCredential(field: "igdbClientId" | "igdbClientSecret", value: string) {
    const next = value.trim();
    if (next === settings[field]) return;
    void updateSettings({ [field]: next, igdbAccessToken: "", igdbTokenExpiresAt: 0 });
  }

  /** Save a Steam field on blur, trimmed. */
  function commitSteam(field: "steamApiKey" | "steamId", value: string) {
    const next = value.trim();
    if (next !== settings[field]) void updateSettings({ [field]: next });
  }

  const steamIdInvalid = steamId.trim() !== "" && parseSteamIdInput(steamId) === null;
  // From what is typed, not what is saved: the fields save on blur, which the
  // click on the button causes, and the save reaches the store at once.
  const steamReady = steamConfigured({ steamApiKey, steamId });

  const startDateValid = isValidIsoDate(startDate);
  const hoursNumber = Number(hours.replace(",", "."));
  const hoursValid = hours.trim() !== "" && Number.isFinite(hoursNumber) && hoursNumber >= 0.5 && hoursNumber <= 168;

  function commitStartDate(value = startDate) {
    if (isValidIsoDate(value) && value !== settings.startDate) void updateSettings({ startDate: value });
  }

  function onStartDateChange(value: string, source: "typed" | "picked") {
    setStartDate(value);
    // The picker hands over whole dates; typed ones commit when the field is left.
    if (source === "picked") commitStartDate(value);
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
          <div className="field">
            <span className="field-label">{t.settings.startDate}</span>
            <DateField
              value={startDate}
              onChange={onStartDateChange}
              onBlurOutside={() => commitStartDate()}
              onKeyDown={commitOnEnter(() => commitStartDate())}
              ariaLabel={t.settings.startDate}
              invalid={!startDateValid}
            />
            {!startDateValid && <span className="field-error">{t.settings.invalidDate}</span>}
          </div>
          <label className="field">
            <span className="field-label">{t.settings.hoursPerWeek}</span>
            <input
              type="number"
              inputMode="decimal"
              min={0.5}
              max={168}
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
          {showIgdbForm ? (
            // Focus inside keeps the form open, so it does not fold away the moment both fields are saved.
            <div className="settings-form" onFocus={() => setIgdbEditing(true)}>
              <ol className="settings-steps">
                {t.settings.igdbSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <div className="settings-form-fields">
                <label className="field">
                  <span className="field-label">{t.search.igdbClientId}</span>
                  <input
                    ref={clientIdRef}
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
              </div>
              <p className="field-hint">{t.search.igdbHint}</p>
              <div className="field-actions">
                <button type="button" className="button button-small" onClick={() => void openExternal(TWITCH_CONSOLE_URL)}>
                  {t.settings.igdbConsole} <Icon name="external" size={14} />
                </button>
                {igdbReady && (
                  <button type="button" className="button button-small" onClick={() => setIgdbEditing(false)}>
                    {t.settings.done}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="settings-status">
              <Icon name="check" size={16} className="settings-status-icon" />
              <span>
                {t.settings.igdbSaved}
                <span className="muted"> · {t.settings.igdbIdTail.replace("{tail}", settings.igdbClientId.slice(-4))}</span>
              </span>
              <button type="button" className="button button-small button-ghost" onClick={() => setIgdbEditing(true)} aria-label={t.settings.changeIgdb}>
                <Icon name="pencil" size={14} /> {t.settings.change}
              </button>
            </div>
          )}
          {/* An IGDB action, so it waits until IGDB is set up. */}
          {igdbReady && (
            <div className="settings-action">
              <div className="field-actions">
                <button type="button" className="button" onClick={() => void refreshDesigns()} disabled={refresh !== null}>
                  <Icon name="refresh" />
                  {refresh === null
                    ? t.settings.designsRefresh
                    : t.settings.designsProgress.replace("{done}", String(refresh.done)).replace("{total}", String(refresh.total))}
                </button>
              </div>
              {refreshError && <span className="field-error">{refreshError}</span>}
              <p className="field-hint">{t.settings.designsHint}</p>
            </div>
          )}
        </div>
      </div>

      <div className="settings-group">
        <h3>{t.steam.title}</h3>
        <p className="settings-group-note">{t.steam.note}</p>
        <div className="settings-group-body">
          {showSteamForm ? (
            <div className="settings-form" onFocus={() => setSteamEditing(true)}>
              <ol className="settings-steps">
                {t.steam.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <div className="settings-form-fields">
                <label className="field">
                  <span className="field-label">{t.steam.apiKey}</span>
                  <input
                    type="password"
                    value={steamApiKey}
                    autoComplete="off"
                    onChange={(e) => setSteamApiKey(e.target.value)}
                    onBlur={() => commitSteam("steamApiKey", steamApiKey)}
                  />
                </label>
                <label className="field">
                  <span className="field-label">{t.steam.account}</span>
                  <input
                    type="text"
                    value={steamId}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(e) => setSteamId(e.target.value)}
                    onBlur={() => commitSteam("steamId", steamId)}
                    aria-invalid={steamIdInvalid}
                  />
                  {steamIdInvalid && <span className="field-error">{t.steam.accountInvalid}</span>}
                </label>
              </div>
              <SteamAccount />
              <p className="field-hint">{t.steam.hint}</p>
              <div className="field-actions">
                <button type="button" className="button button-small" onClick={() => void openExternal(STEAM_KEY_URL)}>
                  {t.steam.openKeyPage} <Icon name="external" size={14} />
                </button>
                {steamSaved && (
                  <button type="button" className="button button-small" onClick={() => setSteamEditing(false)}>
                    {t.settings.done}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="settings-status">
              <SteamAccount />
              <button type="button" className="button button-small button-ghost" onClick={() => setSteamEditing(true)} aria-label={t.settings.changeSteam}>
                <Icon name="pencil" size={14} /> {t.settings.change}
              </button>
            </div>
          )}
          <div className="settings-action">
            <div className="field-actions">
              <button type="button" className="button" onClick={() => setSteamImportOpen(true)} disabled={!steamReady}>
                <Icon name="download" /> {t.steam.import}
              </button>
              {!steamReady && <span className="muted">{t.steam.setupFirst}</span>}
            </div>
          </div>
        </div>
      </div>

      {(version || backupFolder) && (
        <div className="settings-group">
          <h3>{t.settings.appTitle}</h3>
          <p className="settings-group-note">{t.settings.appNote}</p>
          <div className="settings-group-body">
            {version && (
              <div className="settings-action">
                <div className="field-actions">
                  <span className="settings-version">{t.updates.version.replace("{version}", version)}</span>
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
                <p className="field-hint">{t.updates.hint}</p>
              </div>
            )}
            {backupFolder && (
              <div className="settings-action">
                <span className="field-label">{t.backup.autoTitle}</span>
                <code className="path">{backupFolder}</code>
                <p className="field-hint">{t.backup.autoHint}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {steamImportOpen && <SteamImportDialog onClose={() => setSteamImportOpen(false)} />}
    </section>
  );
}
