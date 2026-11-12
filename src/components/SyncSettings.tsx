import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { elapsedSince, formatDateTime } from "../domain/dates";
import { formatSyncKey, joinLink, readSyncKey } from "../domain/sync";
import { t } from "../i18n/en";
import { useStore } from "../state/store";
import { useSync } from "../state/sync";
import { ConfirmDialog } from "./ConfirmDialog";
import { Icon } from "./Icon";
import { SyncConflictDialog } from "./SyncConflictDialog";
import { SyncQrCode } from "./SyncQrCode";

/** Sent from outside (a join link, the empty plan): open the join form, with the key from the link when there is one. */
export interface SyncJoinRequest {
  /** Changes with every request, so the same link opened twice is handled twice. */
  n: number;
  /** The key as it came in, not yet checked; null to open an empty form. */
  key: string | null;
}

/** Off: a question first. "start" turns sync on here (with an invite code, if any); "connect" joins a plan from another device. */
type OffStep = "choose" | "start" | "connect";

/** The Settings group for sync (web build only): start or join, see the state, add another device, turn it off. */
export function SyncSettings({ request = null }: { request?: SyncJoinRequest | null }) {
  const state = useSync((s) => s.state);
  const actionError = useSync((s) => s.actionError);
  const enable = useSync((s) => s.enable);
  const connect = useSync((s) => s.connect);
  const disable = useSync((s) => s.disable);
  const deleteServerCopy = useSync((s) => s.deleteServerCopy);
  const check = useSync((s) => s.check);
  /** A device with no games is most likely the second one: joining is its main action. */
  const emptyPlan = useStore((s) => s.games.length === 0);

  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<OffStep>("choose");
  /** The step as of the last render, for the join request that arrives a frame later. */
  const stepRef = useRef(step);
  stepRef.current = step;
  const [keyInput, setKeyInput] = useState("");
  const [invite, setInvite] = useState("");
  /** The invite code sent with the last "Turn on sync", to tell a missing code from a refused one. */
  const [sentInvite, setSentInvite] = useState<string | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);
  /** What happened to a join link opened while this device already syncs. */
  const [requestNote, setRequestNote] = useState<string | null>(null);
  const keyRef = useRef<HTMLInputElement>(null);
  const connectRef = useRef<HTMLButtonElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const joinRef = useRef<HTMLButtonElement>(null);
  const inviteNoteId = useId();
  const keyNoteId = useId();
  /** Where focus goes when the step changes: into the new form, or back to the button that opened it. */
  const focusAfterStep = useRef<"field" | "connect" | "opener" | null>(null);
  const opener = useRef<"start" | "connect">("start");

  function goTo(next: OffStep, focus: "field" | "connect" | "opener") {
    if (next !== "choose") opener.current = next;
    focusAfterStep.current = focus;
    setStep(next);
  }

  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState<"key" | "link" | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);
  /** Change is open: Turn off and Delete server copy are shown. Folded again whenever sync goes off. */
  const [managing, setManaging] = useState(false);
  const manageId = useId();
  const qrId = useId();
  useEffect(() => {
    if (state.kind === "off") {
      setManaging(false);
      setShowQr(false);
    }
  }, [state.kind]);
  // "5 min ago" keeps up while Settings stays open.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const status = statusOf(state);

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

  // A step opens with the cursor in its field (or on Connect when a link filled the key); Cancel returns to its opener.
  useEffect(() => {
    const focus = focusAfterStep.current;
    focusAfterStep.current = null;
    if (focus === "field") (step === "start" ? inviteRef : keyRef).current?.focus();
    else if (focus === "connect") connectRef.current?.focus();
    else if (focus === "opener") (opener.current === "start" ? startRef : joinRef).current?.focus();
  }, [step]);

  // A join link, or the empty plan's button, sends the user here: open the join form, filled when the link had a key.
  useEffect(() => {
    if (!request) return;
    const current = useSync.getState().state;
    if (current.kind !== "off") {
      // Already syncing: say whether the link is this plan or another one, and change nothing.
      const key = request.key === null ? null : readSyncKey(request.key);
      setRequestNote(key !== null && key === current.meta.key ? t.sync.joinSame : t.sync.joinOtherPlan);
      requestAnimationFrame(() => groupRef.current?.scrollIntoView({ block: "start" }));
      return;
    }
    setRequestNote(null);
    setKeyError(null);
    setKeyInput(request.key ?? "");
    opener.current = "connect";
    // After Settings has opened and scrolled itself into view, bring this group up and put focus where the next step is.
    requestAnimationFrame(() => {
      groupRef.current?.scrollIntoView({ block: "start" });
      if (stepRef.current === "connect") (request.key ? connectRef : keyRef).current?.focus();
      else goTo("connect", request.key ? "connect" : "field");
    });
    // Only a new request counts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.n]);

  async function turnOn() {
    const code = invite.trim();
    setSentInvite(code);
    await enable(code || undefined);
    // Accepted (or not needed): the code has done its job and should not linger in the field.
    if (useSync.getState().state.kind !== "invite-required") {
      setInvite("");
      setStep("choose");
    }
  }

  async function join() {
    setKeyError(null);
    const result = await connect(keyInput);
    if (result === "invalid") setKeyError(t.sync.invalidKey);
    else if (result === "not-found") setKeyError(t.sync.keyNotFound);
    else if (result === "connected") {
      setStep("choose");
      setKeyInput("");
      // Both devices have a plan: the choice is the next step, so ask it now rather than showing a red state.
      if (useSync.getState().state.kind === "conflict") setConflictOpen(true);
    }
    // "failed": actionError below says why, and the form stays open to try again.
  }

  function cancelStep() {
    setKeyError(null);
    setKeyInput("");
    setInvite("");
    goTo("choose", "opener");
  }

  /** Enter in a field does what its form's main button does. */
  const submitOnEnter = (submit: () => void, ready: boolean) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && ready && !busy) {
      event.preventDefault();
      submit();
    }
  };

  async function copyText(text: string, what: "key" | "link") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied((c) => (c === what ? null : c)), 2000);
    } catch {
      // No clipboard access: show what was meant to be copied, to copy by hand.
      if (what === "key") setShowKey(true);
      else setShowQr(true);
    }
  }

  // The server refused a new key: say whether a code is missing or was not accepted, until the user types another.
  const refused = state.kind === "invite-required";
  const typedInvite = invite.trim();
  const inviteError = !refused ? null : typedInvite === "" ? t.sync.inviteNeeded : typedInvite === sentInvite ? t.sync.inviteWrong : null;
  const offStep: OffStep = refused ? "start" : step;
  const link = state.kind !== "off" ? joinLink(window.location.origin, state.meta.key) : null;

  return (
    <div className="settings-group" ref={groupRef} id="sync-settings">
      <h3>{t.sync.title}</h3>
      <p className="settings-group-note">{t.sync.note}</p>
      <div className="settings-group-body">
        {state.kind === "off" && offStep === "choose" && (
          <div className="settings-action">
            <div className="field-actions">
              {/* The likely path is the primary one: joining on a device with no games, starting on one with a plan. */}
              <button ref={startRef} type="button" className={`button ${emptyPlan ? "" : "button-primary"}`} disabled={busy} onClick={() => goTo("start", "field")}>
                {t.sync.startHere}
              </button>
              <button ref={joinRef} type="button" className={`button ${emptyPlan ? "button-primary" : ""}`} disabled={busy} onClick={() => goTo("connect", "field")}>
                {t.sync.joinOther}
              </button>
            </div>
            <p className="field-hint">{t.sync.chooseHint}</p>
          </div>
        )}

        {(state.kind === "off" || refused) && offStep === "start" && (
          <div className="settings-action">
            <div className="field sync-field">
              <label className="field-label" htmlFor={`${inviteNoteId}-input`}>
                {t.sync.inviteLabel}
              </label>
              <input
                id={`${inviteNoteId}-input`}
                ref={inviteRef}
                type="text"
                value={invite}
                onChange={(e) => setInvite(e.target.value)}
                onKeyDown={submitOnEnter(() => void run(turnOn), !(refused && typedInvite === ""))}
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
            </div>
            <div className="field-actions">
              <button type="button" className="button button-primary" disabled={busy || (refused && typedInvite === "")} onClick={() => void run(turnOn)}>
                {t.sync.turnOn}
              </button>
              <button
                type="button"
                className="button button-ghost"
                disabled={busy}
                // A refused new key is given up (back to off); otherwise this only steps back to the question.
                onClick={() => (refused ? void run(disable).then(cancelStep) : cancelStep())}
              >
                {t.cancel}
              </button>
            </div>
          </div>
        )}

        {state.kind === "off" && offStep === "connect" && (
          <div className="settings-action">
            <div className="field sync-field">
              <label className="field-label" htmlFor={`${keyNoteId}-input`}>
                {t.sync.keyOrLinkLabel}
              </label>
              <input
                id={`${keyNoteId}-input`}
                ref={keyRef}
                type="text"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                onKeyDown={submitOnEnter(() => void run(join), keyInput.trim() !== "")}
                placeholder={t.sync.keyPlaceholder}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                aria-invalid={keyError !== null}
                aria-describedby={keyNoteId}
              />
              {keyError ? (
                <span className="field-error" id={keyNoteId} role="alert">
                  {keyError}
                </span>
              ) : (
                <span className="field-hint" id={keyNoteId}>
                  {t.sync.connectHint}
                </span>
              )}
            </div>
            <div className="field-actions">
              <button ref={connectRef} type="button" className="button button-primary" disabled={busy || keyInput.trim() === ""} onClick={() => void run(join)}>
                {t.sync.connect}
              </button>
              <button type="button" className="button button-ghost" disabled={busy} onClick={cancelStep}>
                {t.cancel}
              </button>
            </div>
          </div>
        )}

        {state.kind !== "off" && !refused && (
          <>
            {/* Folded like IGDB and Steam once set up: the state, the one action it calls for, and Change. */}
            <div className="settings-status">
              {/* Read out as it changes (synced, waiting, failed, a conflict) while Settings is open. */}
              <div className="sync-status" role="status">
                <span className="sync-status-line">
                  <span className={`sync-state sync-state-${status.tone}`}>{status.word}</span>
                  {status.when && (
                    <time className="muted" dateTime={status.when} title={formatDateTime(status.when)}>
                      {sinceText(status.when, now)}
                    </time>
                  )}
                </span>
                {status.detail && <span className="sync-status-detail">{status.detail}</span>}
              </div>
              <span className="field-actions">
                {state.kind === "conflict" ? (
                  <button type="button" className="button button-primary button-small" onClick={() => setConflictOpen(true)}>
                    {t.sync.resolve}
                  </button>
                ) : (
                  <button type="button" className="button button-small" disabled={busy || state.kind === "syncing"} onClick={() => void run(check)}>
                    {t.sync.checkNow}
                  </button>
                )}
                <button
                  type="button"
                  className="button button-small button-ghost"
                  aria-expanded={managing}
                  aria-controls={managing ? manageId : undefined}
                  aria-label={managing ? undefined : t.sync.changeSync}
                  onClick={() => setManaging((open) => !open)}
                >
                  {managing ? (
                    t.settings.done
                  ) : (
                    <>
                      <Icon name="pencil" size={14} /> {t.settings.change}
                    </>
                  )}
                </button>
              </span>
            </div>
            {requestNote && <p className="field-hint sync-request-note">{requestNote}</p>}

            {/* The key and the join link stay in view: setting up another device is what people come back here for. */}
            <div className="settings-action">
              <span className="field-label">{t.sync.keyLabel}</span>
              <div className="field-actions">
                <code className="path sync-key">{showKey ? formatSyncKey(state.meta.key) : "••••-••••-••••-••••-••••-••••-••••-••••"}</code>
                <button type="button" className="button button-small" onClick={() => setShowKey((v) => !v)}>
                  {showKey ? t.sync.hide : t.sync.show}
                </button>
                <button type="button" className="button button-small" onClick={() => void copyText(formatSyncKey(state.meta.key), "key")}>
                  {copied === "key" ? t.sync.copied : t.sync.copy}
                </button>
              </div>
              <div className="field-actions">
                <button type="button" className="button button-small" onClick={() => link && void copyText(link, "link")}>
                  <Icon name="link" size={14} /> {copied === "link" ? t.sync.linkCopied : t.sync.copyLink}
                </button>
                <button
                  type="button"
                  className="button button-small"
                  aria-expanded={showQr}
                  aria-controls={showQr ? qrId : undefined}
                  onClick={() => setShowQr((v) => !v)}
                >
                  <Icon name="qr" size={14} /> {showQr ? t.sync.hideQr : t.sync.showQr}
                </button>
              </div>
              {showQr && link && <SyncQrCode id={qrId} text={link} label={t.sync.qrLabel} />}
              <p className="field-hint">{t.sync.keyHint}</p>
            </div>

            {/* Behind Change: the two ways to stop, each with what it does right under it. */}
            {managing && (
              <div className="sync-manage" id={manageId}>
                <div className="settings-action">
                  <button type="button" className="button" disabled={busy} onClick={() => void run(disable)}>
                    {t.sync.turnOff}
                  </button>
                  <p className="field-hint">{t.sync.turnOffHint}</p>
                </div>
                <div className="settings-action">
                  <button type="button" className="button button-ghost button-danger-ghost" disabled={busy} onClick={() => setConfirmDelete(true)}>
                    {t.sync.deleteServer}
                  </button>
                  <p className="field-hint">{t.sync.deleteHint}</p>
                </div>
              </div>
            )}
          </>
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

interface SyncStatus {
  /** The state as a word with a dot (The Dot Not Pill Rule). */
  word: string;
  /** Green when synced, amber while a change waits for the connection, red when sync stopped or needs a choice, a hollow ring while nothing is settled. */
  tone: "ok" | "warn" | "bad" | "quiet";
  /** When the server last confirmed this device's plan, shown as time since. */
  when: string | null;
  /** What the state means, when there is more to say than the word. */
  detail: string | null;
}

function statusOf(state: ReturnType<typeof useSync.getState>["state"]): SyncStatus {
  const status = (word: string, tone: SyncStatus["tone"], detail: string | null = null, when: string | null = null): SyncStatus => ({ word, tone, detail, when });
  switch (state.kind) {
    case "idle":
      return state.meta.lastSyncedAt ? status(t.sync.stateSynced, "ok", null, state.meta.lastSyncedAt) : status(t.sync.stateOn, "quiet", t.sync.detailNever);
    case "syncing":
      return status(t.sync.stateSyncing, "quiet");
    case "pending":
      if (state.reason === "offline") return status(t.sync.stateWaiting, "warn", t.sync.detailOffline);
      if (state.reason === "too-large") return status(t.sync.stateStopped, "bad", t.sync.detailTooLarge);
      return status(t.sync.stateFailed, "bad", state.detail ? t.sync.detailError.replace("{detail}", state.detail) : t.sync.detailErrorPlain);
    case "conflict":
      return status(t.sync.stateConflict, "bad", t.sync.detailConflict);
    default:
      return status("", "quiet");
  }
}

/** "just now", "5 min ago", "3 h ago", then the date and time. */
function sinceText(iso: string, now: Date): string {
  const elapsed = elapsedSince(iso, now);
  if (!elapsed) return formatDateTime(iso);
  if (elapsed.unit === "now") return t.sync.justNow;
  return (elapsed.unit === "min" ? t.sync.minutesAgo : t.sync.hoursAgo).replace("{n}", String(elapsed.n));
}
