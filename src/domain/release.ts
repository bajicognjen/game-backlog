/**
 * Reading GitHub's "latest release" answer: is it newer than this build, and
 * which asset is the Windows installer. No network code here; see
 * `platform/updates.ts`.
 */

/** The fields the app reads from `GET /repos/{owner}/{repo}/releases/latest`. */
export interface GithubRelease {
  tag_name?: string | null;
  draft?: boolean | null;
  prerelease?: boolean | null;
  html_url?: string | null;
  assets?: { name?: string | null; size?: number | null; browser_download_url?: string | null }[] | null;
}

export interface AvailableUpdate {
  /** Without the leading "v", e.g. "0.4.0". */
  version: string;
  installerName: string;
  installerUrl: string;
  /** Bytes, when GitHub says. */
  installerSize: number | null;
  releaseUrl: string | null;
}

/** "v0.4.0" → [0, 4, 0]; anything after a "-" or "+" (pre-release, build) is ignored. Null when not a version. */
export function parseVersion(text: string): number[] | null {
  const core = text.trim().replace(/^v/i, "").split(/[-+]/)[0];
  if (!/^\d+(\.\d+)*$/.test(core)) return null;
  return core.split(".").map(Number);
}

/** True when `candidate` is a higher version than `current`; missing parts count as 0 (1.2 = 1.2.0). */
export function isNewer(candidate: string, current: string): boolean {
  const a = parseVersion(candidate);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

/** The update a release offers over `currentVersion`, or null when it is not newer or has no Windows installer. */
export function updateFrom(release: GithubRelease, currentVersion: string): AvailableUpdate | null {
  if (release.draft || release.prerelease || !release.tag_name) return null;
  if (!isNewer(release.tag_name, currentVersion)) return null;
  const installer = (release.assets ?? []).find((a) => a.name?.toLowerCase().endsWith("-setup.exe") && a.browser_download_url);
  if (!installer?.name || !installer.browser_download_url) return null;
  return {
    version: release.tag_name.trim().replace(/^v/i, ""),
    installerName: installer.name,
    installerUrl: installer.browser_download_url,
    installerSize: typeof installer.size === "number" ? installer.size : null,
    releaseUrl: release.html_url ?? null,
  };
}
