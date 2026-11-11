import { useEffect, useId, useRef, useState } from "react";
import { formatDateTime } from "../domain/dates";
import { formatSyncKey } from "../domain/sync";
import { t } from "../i18n/en";
import { useSync } from "../state/sync";
import { ConfirmDialog } from "./ConfirmDialog";
import { SyncConflictDialog } from "./SyncConflictDialog";

/** The Settings group for sync (web build only): turn it on, join a key, see the state, turn it off. */
export function SyncSettings() {
  const state = useSync((s) => s.state);
  const actionError = useSync((s) => s.actionError);
  const enable = useSync((s) => s.enable);
  const connect = useSync((s) => s.connect);
  const disable = useSync((s) => s.disable);
  const deleteServerCopy = useSync((s) => s.deleteServerCopy);
  const check = useSync((s) => s.check);

  const [busy, setBusy] = useState(false);
  const [joining, setJoining] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [invite, setInvite] = useState("");
  /** The invite code sent with the last "Turn on sync", to tell a missing code from a refused one. */
  const [sentInvite, setSentInvite] = useState<string | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);
  const keyRef = useRef<HTMLInputElement>(null);
  const haveKeyRef = useRef<HTMLButtonElement>(null);
  const inviteNoteId = useId();
  const keyErrorId = useId();
  /** Set by Cancel on the key form, so focus goes back to the button that opened it. */
  const refocusHaveKey = useRef(false);
  // Opening the key form puts the cursor in it; cancelling it returns focus to "Use an existing key".
  useEffect(() => {
    if (joining) keyRef.current?.focus();
    else if (refocusHaveKey.current) haveKeyRef.current?.focus();
    refocusHaveKey.current = false;
  }, [joining]);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);

  const groupRef = useRef<HTMLDivElement>(null);
  const inviteRef = useRef<HTMLInputElement>(null);
  /** Set when an action starts here (or the delete dialog closes): where focus was, to give it back afterwards. */
  const returnFocus = useRef<{ to: Element | null } | null>(null);

  async function run(action: () => Promise<unknown>) {
    returnFocus.current = { to: document.activeElement };
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  // Buttons are disabled while an action runs, and turning sync on or off replaces them, which drops focus
  // to the page. Give it back: to the refused invite field, the control that was used, or the group's first button.
  useEffect(() => {
    const pending = returnFocus.current;
    if (!pending || busy || confirmDelete) return;
    returnFocus.current = null;
    const active = document.activeElement;
    if (active && active !== document.body) return; // focus went somewhere on purpose: a field, a dialog, a notice
    const used = pending.to instanceof HTMLElement && pending.to.isConnected && !pending.to.matches(":disabled") ? pending.to : null;
    const target = state.kind === "invite-required" ? inviteRef.current : (used ?? groupRef.current?.querySelector<HTMLElement>("button:not(:disabled)"));
    target?.focus();
  }, [busy, confirmDelete, state.kind]);

  async function turnOn() {
    const code = invite.trim();
    setSentInvite(code);
    await enable(code || undefined);
    // Accepted (or not needed): the code has done its job and should not linger in the field.
    if (useSync.getState().state.kind !== "invite-required") setInvite("");
  }

  async function join() {
    setKeyError(null);
    const result = await connect(keyInput);
    if (result === "invalid") setKeyError(t.sync.invalidKey);
    else if (result === "not-found") setKeyError(t.sync.keyNotFound);
    else if (result === "connected") {
      setJoining(false);
      setKeyInput("");
    }
    // "failed": actionError below says why, and the form stays open to try again.
  }

  function closeJoin() {
    refocusHaveKey.current = true;
    setJoining(false);
    setKeyError(null);
  }

  async function copyKey(key: string) {
    try {
      await navigator.clipboard.writeText(formatSyncKey(key));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setShowKey(true); // no clipboard access: show it to copy by hand
    }
  }

  // The server refused a new key: say whether a code is missing or was not accepted, until the user types another.
  const refused = state.kind === "invite-required";
  const typedInvite = invite.trim();
  const inviteError = !refused ? null : typedInvite === "" ? t.sync.inviteNeeded : typedInvite === sentInvite ? t.sync.inviteWrong : null;

  return (
    <div className="settings-group" ref={groupRef}>
      <h3>{t.sync.title}</h3>
      <p className="settings-group-note">{t.sync.note}</p>
      <div className="settings-group-body">
        {(state.kind === "off" || refused) && !joining && (
          <div className="settings-action">
            <label className="field sync-field">
              <span className="field-label">{t.sync.inviteLabel}</span>
              <input
                ref={inviteRef}
                type="text"
                value={invite}
                onChange={(e) => setInvite(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={inviteError !== null}
                aria-describedby={inviteNoteId}
              />
              {inviteError ? (
                <span className="field-error" id={inviteNoteId}>
                  {inviteError}
                </span>
              ) : (
                <span className="field-hint" id={inviteNoteId}>
                  {t.sync.inviteHint}
                </span>
              )}
            </label>
            <div className="field-actions">
              <button type="button" className="button button-primary" disabled={busy || (refused && typedInvite === "")} onClick={() => void run(turnOn)}>
                {t.sync.turnOn}
              </button>
              {refused ? (
                // Give up on the new key: back to "off", where "Use an existing key" is offered again.
                <button type="button" className="button" disabled={busy} onClick={() => void run(disable)}>
                  {t.cancel}
                </button>
              ) : (
                <button ref={haveKeyRef} type="button" className="button" disabled={busy} onClick={() => setJoining(true)}>
                  {t.sync.haveKey}
                </button>
              )}
            </div>
          </div>
        )}

        {state.kind === "off" && joining && (
          <div className="settings-action">
            <label className="field sync-field">
              <span className="field-label">{t.sync.keyLabel}</span>
              <input
                ref={keyRef}
                type="text"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder={t.sync.keyPlaceholder}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={keyError !== null}
                aria-describedby={keyError ? keyErrorId : undefined}
              />
              {keyError && (
                <span className="field-error" id={keyErrorId}>
                  {keyError}
                </span>
              )}
            </label>
            <div className="field-actions">
              <button type="button" className="button button-primary" disabled={busy || keyInput.trim() === ""} onClick={() => void run(join)}>
                {t.sync.connect}
              </button>
              <button type="button" className="button button-ghost" disabled={busy} onClick={closeJoin}>
                {t.cancel}
              </button>
            </div>
          </div>
        )}

        {state.kind !== "off" && !refused && (
          <div className="settings-action">
            {/* Read out as it changes (synced, waiting, failed, a conflict) while Settings is open. */}
            <span className={state.kind === "pending" || state.kind === "conflict" ? "field-error" : "muted"} role="status">
              {statusText(state)}
            </span>
            {state.kind === "conflict" && (
              <div className="field-actions">
                <button type="button" className="button button-primary" onClick={() => setConflictOpen(true)}>
                  {t.sync.resolve}
                </button>
              </div>
            )}
            <span className="field-label">{t.sync.keyLabel}</span>
            <div className="field-actions">
              <code className="path">{showKey ? formatSyncKey(state.meta.key) : "••••-••••-••••-••••-••••-••••-••••-••••"}</code>
              <button type="button" className="button button-small" onClick={() => setShowKey((v) => !v)}>
                {showKey ? t.sync.hide : t.sync.show}
              </button>
              <button type="button" className="button button-small" onClick={() => void copyKey(state.meta.key)}>
                {copied ? t.sync.copied : t.sync.copy}
              </button>
            </div>
            <p className="field-hint">{t.sync.keyHint}</p>
            <div className="field-actions">
              {/* In a conflict nothing syncs until a side is chosen, so a check would do nothing. */}
              <button type="button" className="button" disabled={busy || state.kind === "syncing" || state.kind === "conflict"} onClick={() => void run(check)}>
                {t.sync.checkNow}
              </button>
              <button type="button" className="button" disabled={busy} onClick={() => void run(disable)}>
                {t.sync.turnOff}
              </button>
              <button type="button" className="button button-ghost" disabled={busy} onClick={() => setConfirmDelete(true)}>
                {t.sync.deleteServer}
              </button>
            </div>
            <p className="field-hint">{t.sync.turnOffHint}</p>
          </div>
        )}

        {actionError && (
          <span className="field-error" role="alert">
            {t.sync.actionFailed.replace("{detail}", actionError)}
          </span>
        )}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title={t.sync.deleteTitle}
          question={t.sync.deleteQuestion}
          warning={t.sync.deleteWarning}
          confirmLabel={t.sync.deleteConfirm}
          onConfirm={async () => {
            await deleteServerCopy();
            return useSync.getState().actionError === null;
          }}
          onClose={() => {
            // After a delete its button is gone with the "on" controls; focus goes to what replaced them.
            returnFocus.current = { to: null };
            setConfirmDelete(false);
          }}
        />
      )}
      {conflictOpen && <SyncConflictDialog onClose={() => setConflictOpen(false)} />}
    </div>
  );
}

function statusText(state: ReturnType<typeof useSync.getState>["state"]): string {
  switch (state.kind) {
    case "idle":
      return state.meta.lastSyncedAt ? t.sync.statusIdle.replace("{time}", formatDateTime(state.meta.lastSyncedAt)) : t.sync.statusNever;
    case "syncing":
      return t.sync.statusSyncing;
    case "pending":
      if (state.reason === "offline") return t.sync.statusOffline;
      if (state.reason === "too-large") return t.sync.statusTooLarge;
      return state.detail ? t.sync.statusError.replace("{detail}", state.detail) : t.sync.statusErrorPlain;
    case "conflict":
      return t.sync.statusConflict;
    default:
      return "";
  }
}
