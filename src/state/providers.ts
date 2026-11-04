import { createProviders } from "../platform/providers";
import { useStore } from "./store";

/** The app-wide provider instances, reading credentials from the store and persisting the Twitch token through it. */
export const providers = createProviders({
  getSettings: () => useStore.getState().settings,
  rememberIgdbToken: (token) =>
    useStore.getState().updateSettings({ igdbAccessToken: token.accessToken, igdbTokenExpiresAt: token.expiresAt }),
});
