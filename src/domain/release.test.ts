import { describe, expect, it } from "vitest";
import { isNewer, parseVersion, updateFrom, type GithubRelease } from "./release";

/** Shaped like GitHub's answer for v0.3.0 of this repo. */
const release = (tag: string, assets: GithubRelease["assets"] = [installer(tag)]): GithubRelease => ({
  tag_name: tag,
  draft: false,
  prerelease: false,
  html_url: `https://github.com/bajicognjen/game-backlog/releases/tag/${tag}`,
  assets,
});
const installer = (tag: string) => ({
  name: `Game.Backlog_${tag.slice(1)}_x64-setup.exe`,
  size: 3789661,
  browser_download_url: `https://github.com/bajicognjen/game-backlog/releases/download/${tag}/Game.Backlog_${tag.slice(1)}_x64-setup.exe`,
});

describe("versions", () => {
  it("parses tags with or without a v and ignores pre-release suffixes", () => {
    expect(parseVersion("v0.4.0")).toEqual([0, 4, 0]);
    expect(parseVersion(" 1.2 ")).toEqual([1, 2]);
    expect(parseVersion("v1.0.0-beta.1")).toEqual([1, 0, 0]);
    expect(parseVersion("latest")).toBeNull();
  });

  it("compares part by part, numerically", () => {
    expect(isNewer("v0.4.0", "0.3.0")).toBe(true);
    expect(isNewer("v0.10.0", "0.9.9")).toBe(true);
    expect(isNewer("v1.0", "0.99.99")).toBe(true);
    expect(isNewer("v0.3.0", "0.3.0")).toBe(false);
    expect(isNewer("v0.3", "0.3.0")).toBe(false);
    expect(isNewer("v0.2.9", "0.3.0")).toBe(false);
    expect(isNewer("nonsense", "0.3.0")).toBe(false);
  });
});

describe("updateFrom", () => {
  it("offers a newer release's setup.exe", () => {
    expect(updateFrom(release("v0.4.0"), "0.3.0")).toEqual({
      version: "0.4.0",
      installerName: "Game.Backlog_0.4.0_x64-setup.exe",
      installerUrl: "https://github.com/bajicognjen/game-backlog/releases/download/v0.4.0/Game.Backlog_0.4.0_x64-setup.exe",
      installerSize: 3789661,
      releaseUrl: "https://github.com/bajicognjen/game-backlog/releases/tag/v0.4.0",
    });
  });

  it("offers nothing for the same or an older version", () => {
    expect(updateFrom(release("v0.3.0"), "0.3.0")).toBeNull();
    expect(updateFrom(release("v0.2.0"), "0.3.0")).toBeNull();
  });

  it("skips drafts, pre-releases and releases without a Windows installer", () => {
    expect(updateFrom({ ...release("v0.4.0"), draft: true }, "0.3.0")).toBeNull();
    expect(updateFrom({ ...release("v0.4.0"), prerelease: true }, "0.3.0")).toBeNull();
    expect(updateFrom(release("v0.4.0", [{ name: "latest.json", browser_download_url: "https://example.invalid/latest.json" }]), "0.3.0")).toBeNull();
    expect(updateFrom({ tag_name: null }, "0.3.0")).toBeNull();
  });
});
