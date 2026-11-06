import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type Ref } from "react";
import { formatDate, isValidIsoDate, parseDisplayDate } from "../domain/dates";
import { t } from "../i18n/en";
import { Icon } from "./Icon";

interface Props {
  /** ISO date, "" when empty, or whatever the user typed while it does not parse. */
  value: string;
  /** ISO when the text parses, "" when cleared, else the raw text so the parent's validation fails. */
  onChange(value: string, source: "typed" | "picked"): void;
  ariaLabel?: string;
  invalid?: boolean;
  /** Take the dialog's first focus. */
  autoFocus?: boolean;
  /** The small in-place variant used on the Now playing card. */
  compact?: boolean;
  onKeyDown?(event: KeyboardEvent<HTMLInputElement>): void;
  /** Focus left the whole field (text and picker button). */
  onBlurOutside?(): void;
  inputRef?: Ref<HTMLInputElement>;
}

/**
 * A date typed the way the app shows it, dd.mm.yyyy, with the native picker
 * one click away. Native date inputs format by the browser's own language,
 * which does not match the dates printed everywhere else, so the visible
 * field is text and the picker is only a helper.
 */
export function DateField({ value, onChange, ariaLabel, invalid = false, autoFocus = false, compact = false, onKeyDown, onBlurOutside, inputRef }: Props) {
  const [text, setText] = useState(() => (isValidIsoDate(value) ? formatDate(value) : value));
  const pickerRef = useRef<HTMLInputElement>(null);

  // Follow outside changes (a picker pick, a parent reset) without fighting the user's typing.
  useEffect(() => {
    if (value === "" && text.trim() !== "" && parseDisplayDate(text) === null) return;
    if (isValidIsoDate(value)) {
      if (parseDisplayDate(text) !== value) setText(formatDate(value));
    } else if (value === "" && parseDisplayDate(text) !== null) {
      setText("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function onTextChange(next: string) {
    setText(next);
    const iso = parseDisplayDate(next);
    onChange(next.trim() === "" ? "" : (iso ?? next), "typed");
  }

  function openPicker() {
    const picker = pickerRef.current;
    if (!picker) return;
    try {
      picker.showPicker();
    } catch {
      picker.focus();
      picker.click();
    }
  }

  function onBlur(event: FocusEvent<HTMLSpanElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onBlurOutside?.();
  }

  return (
    <span className={`date-field ${compact ? "date-field-compact" : ""}`} onBlur={onBlur}>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        className={compact ? "inline-edit-input" : undefined}
        placeholder={t.dateField.placeholder}
        value={text}
        aria-label={ariaLabel}
        aria-invalid={invalid}
        autoComplete="off"
        spellCheck={false}
        data-autofocus={autoFocus ? "true" : undefined}
        onChange={(event) => onTextChange(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <button type="button" className="button button-icon-sm date-field-pick" onClick={openPicker} aria-label={t.dateField.pick} title={t.dateField.pick}>
        <Icon name="calendar" size={compact ? 14 : 16} />
      </button>
      <input
        ref={pickerRef}
        type="date"
        className="date-picker-native"
        tabIndex={-1}
        aria-hidden="true"
        value={isValidIsoDate(value) ? value : ""}
        onChange={(event) => {
          const iso = event.target.value;
          if (iso === "") return;
          setText(formatDate(iso));
          onChange(iso, "picked");
        }}
      />
    </span>
  );
}
