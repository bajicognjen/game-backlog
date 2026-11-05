/**
 * App updates without an update server: ask GitHub for the latest published
 * release of the repository, and when it is newer than this build, download
 * its Windows installer to the temp folder, start it and quit so it can
 * replace the program. The installer keeps the data folder as it is.
 * Outside the desktop app there is nothing to update.
 */
import { getVersion } from "@tauri-apps/api/app";
import { isTauri } from "@tauri-apps/api/core";
import { join, tempDir } from "@tauri-apps/api/path";
import { writeFile } from "@tauri-apps/plugin-fs";
import { openPath } from "@tauri-apps/plugin-opener";
import { exit } from "@tauri-apps/plugin-process";
import { updateFrom, type AvailableUpdate, type GithubRelease } from "../domain/release";
import { fetchWithTimeout, httpFetch } from "./http";

export type { AvailableUpdate };

/** The version this build was made from; same as the installed version in the desktop app. */
export const APP_VERSION: string = __APP_VERSION__;

const LATEST_RELEASE_URL = "https://api.github.com/repos/bajicognjen/game-backlog/releases/latest";
/** GitHub's API refuses requests without a User-Agent. */
const HEADERS = { Accept: "application/vnd.github+json", "User-Agent": "game-backlog-app" };

/** The installed version; null in the browser preview. */
export async function appVersion(): Promise<string | null> {
  return isTauri() ? getVersion() : null;
}

/** A newer published release with an installer, or null when up to date (and always in the browser preview). */
export async function checkForUpdate(): Promise<AvailableUpdate | null> {
  if (!isTauri()) return null;
  const response = await fetchWithTimeout(LATEST_RELEASE_URL, { method: "GET", headers: HEADERS });
  if (response.status === 404) return null; // nothing published yet
  if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
  return updateFrom((await response.json()) as GithubRelease, await getVersion());
}

/** Download the installer (reporting the share done, null while the size is unknown), start it and quit. */
export async function installUpdate(update: AvailableUpdate, onProgress: (share: number | null) => void): Promise<void> {
  const response = await httpFetch(update.installerUrl, { method: "GET", headers: { "User-Agent": HEADERS["User-Agent"] } });
  if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
  const total = Number(response.headers.get("content-length")) || update.installerSize || 0;
  const bytes = await readAll(response, (received) => onProgress(total > 0 ? Math.min(1, received / total) : null));

  const path = await join(await tempDir(), update.installerName);
  await writeFile(path, bytes);
  await openPath(path);
  await exit(0);
}

async function readAll(response: Response, onReceived: (bytes: number) => void): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array(await response.arrayBuffer());
  const chunks: Uint8Array[] = [];
  let received = 0;
  onReceived(0);
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onReceived(received);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
