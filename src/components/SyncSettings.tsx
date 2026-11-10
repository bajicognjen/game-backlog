import { useState } from "react";
import { formatSyncKey } from "../domain/sync";
import { t } from "../i18n/en";
import { useSync } from "../state/sync";
import { ConfirmDialog } from "./ConfirmDialog";
import { SyncConflictDialog, formatWhen } from "./SyncConflictDialog";

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
  const [keyError, setKeyError] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    setKeyError(null);
    const ok = await connect(keyInput, invite.trim() || undefined);
    if (!ok) setKeyError(t.sync.invalidKey);
    else setJoining(false);
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

  const invitePrompt = state.kind === "invite-required";

  return (
    <div className="settings-group">
      <h3>{t.sync.title}</h3>
      <p className="settings-group-note">{t.sync.note}</p>
      <div className="settings-group-body">
        {(state.kind === "off" || invitePrompt) && (
          <div className="settings-action">
            {invitePrompt && (
              <>
                <span className="field-error">{t.sync.inviteNeeded}</span>
                <input className="input" value={invite} onChange={(e) => setInvite(e.target.value)} placeholder={t.sync.invitePlaceholder} aria-label={t.sync.invitePlaceholder} />
              </>
            )}
            {!joining && (
              <div className="field-actions">
                <button type="button" className="button button-primary" disabled={busy} onClick={() => void run(() => enable(invite.trim() || undefined))}>
                  {invitePrompt ? t.sync.retry : t.sync.turnOn}
                </button>
                {!invitePrompt && (
                  <button type="button" className="button" disabled={busy} onClick={() => setJoining(true)}>
                    {t.sync.haveKey}
                  </button>
                )}
              </div>
            )}
            {joining && (
              <>
                <input
                  className="input"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder={t.sync.keyPlaceholder}
                  aria-label={t.sync.keyLabel}
                  autoComplete="off"
                  spellCheck={false}
                  data-autofocus
                />
                {keyError && <span className="field-error">{keyError}</span>}
                <div className="field-actions">
                  <button type="button" className="button button-primary" disabled={busy || keyInput.trim() === ""} onClick={() => void run(join)}>
                    {t.sync.connect}
                  </button>
                  <button type="button" className="button button-ghost" disabled={busy} onClick={() => setJoining(false)}>
                    {t.cancel}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {state.kind !== "off" && !invitePrompt && (
          <div className="settings-action">
            <span className={state.kind === "pending" || state.kind === "conflict" ? "field-error" : "muted"}>{statusText(state)}</span>
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
              <button type="button" className="button" disabled={busy || state.kind === "syncing"} onClick={() => void run(check)}>
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

        {actionError && <span className="field-error">{t.sync.actionFailed.replace("{detail}", actionError)}</span>}
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
          onClose={() => setConfirmDelete(false)}
        />
      )}
      {conflictOpen && <SyncConflictDialog onClose={() => setConflictOpen(false)} />}
    </div>
  );
}

function statusText(state: ReturnType<typeof useSync.getState>["state"]): string {
  switch (state.kind) {
    case "idle":
      return state.meta.lastSyncedAt ? t.sync.statusIdle.replace("{time}", formatWhen(state.meta.lastSyncedAt)) : t.sync.statusNever;
    case "syncing":
      return t.sync.statusSyncing;
    case "pending":
      return state.reason === "offline" ? t.sync.statusOffline : state.reason === "too-large" ? t.sync.statusTooLarge : t.sync.statusError.replace("{detail}", state.detail ?? "error");
    case "conflict":
      return t.sync.statusConflict;
    default:
      return "";
  }
}
