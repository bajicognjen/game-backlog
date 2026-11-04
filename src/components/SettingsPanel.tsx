import { useEffect, useState } from "react";
import { isValidIsoDate } from "../domain/dates";
import { useStore } from "../state/store";
import { t } from "../i18n/sr";

/**
 * Start date and weekly hours. Each field keeps its own draft so the user can
 * type freely; only valid values reach the store (and recalculate the plan).
 */
export function SettingsPanel() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);

  const [startDate, setStartDate] = useState(settings.startDate);
  const [hours, setHours] = useState(String(settings.hoursPerWeek));

  // Keep drafts in sync when the store changes from elsewhere (e.g. finishing a game).
  useEffect(() => setStartDate(settings.startDate), [settings.startDate]);
  useEffect(() => setHours(String(settings.hoursPerWeek)), [settings.hoursPerWeek]);

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
    </section>
  );
}
