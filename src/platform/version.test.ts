/// <reference types="node" />
/**
 * The top bar shows package.json's version, the updater compares
 * tauri.conf.json's and Cargo builds with its own: a release must bump all three.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { APP_VERSION } from "./updates";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("app version", () => {
  it("is the same in package.json, tauri.conf.json and Cargo.toml", () => {
    const pkg = (JSON.parse(read("package.json")) as { version: string }).version;
    const tauri = (JSON.parse(read("src-tauri/tauri.conf.json")) as { version: string }).version;
    const cargo = /^version = "([^"]+)"/m.exec(read("src-tauri/Cargo.toml"))?.[1];
    expect(tauri).toBe(pkg);
    expect(cargo).toBe(pkg);
    expect(APP_VERSION).toBe(pkg);
  });
});
