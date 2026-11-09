import { useEffect, useState } from "react";
import { steamConfigured } from "../domain/steam";
import { t } from "../i18n/en";
import { openExternal } from "../platform/links";
import { fetchPlayerSummary, resolveSteamId, steamFailureOf, type SteamFailure, type SteamPlayerSummary } from "../platform/steam";
import { steamFailureMessage } from "../state/steam";
import { useStore } from "../state/store";
import { Icon } from "./Icon";

type State =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "connected"; player: SteamPlayerSummary }
  | { kind: "unknown" }
  | { kind: "failed"; reason: SteamFailure };

/**
 * Settings → Steam: who the saved key and account read as, so a wrong link
 * or a private profile shows before the first import. Checks the saved
 * values, so it runs when a field is left, not on every keystroke.
 */
export function SteamAccount() {
  const apiKey = useStore((s) => s.settings.steamApiKey);
  const account = useStore((s) => s.settings.steamId);
  const ready = steamConfigured({ steamApiKey: apiKey, steamId: account });
  const [state, setState] = useState<State>({ kind: "idle" });

  useEffect(() => {
    if (!ready) {
      setState({ kind: "idle" });
      return;
    }
    const controller = new AbortController();
    setState({ kind: "checking" });
    void (async () => {
      try {
        const steamId = await resolveSteamId(apiKey.trim(), account, controller.signal);
        const player = await fetchPlayerSummary({ apiKey: apiKey.trim(), steamId }, controller.signal);
        if (!controller.signal.aborted) setState(player ? { kind: "connected", player } : { kind: "unknown" });
      } catch (error) {
        if (!controller.signal.aborted) setState({ kind: "failed", reason: steamFailureOf(error) });
      }
    })();
    return () => controller.abort();
  }, [ready, apiKey, account]);

  switch (state.kind) {
    case "idle":
      return null;
    case "checking":
      return <p className="steam-account muted">{t.steamAccount.checking}</p>;
    case "unknown":
      return <p className="steam-account field-error">{t.steamAccount.unknown}</p>;
    case "failed":
      return <p className="steam-account field-error">{steamFailureMessage(state.reason)}</p>;
    case "connected": {
      const { player } = state;
      return (
        <div className="steam-account" aria-live="polite">
          {player.avatarmedium && <img className="steam-account-avatar" src={player.avatarmedium} alt="" width={32} height={32} />}
          <span>
            {t.steamAccount.connected} <span className="steam-account-name">{player.personaname}</span>
          </span>
          <button type="button" className="button button-small" onClick={() => void openExternal(player.profileurl)}>
            {t.steamAccount.openProfile} <Icon name="external" size={14} />
          </button>
          {player.playing && <p className="steam-account-note">{t.steamAccount.playing.replace("{game}", player.playing)}</p>}
          {!player.isPublic && <p className="steam-account-warn">{t.steamAccount.private}</p>}
        </div>
      );
    }
  }
}
