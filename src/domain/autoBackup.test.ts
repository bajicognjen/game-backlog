import { describe, expect, it } from "vitest";
import { autoBackupFileName, filesToPrune, isAutoBackupFile } from "./autoBackup";

describe("automatic backups", () => {
  it("names one file per local day", () => {
    expect(autoBackupFileName(new Date(2026, 10, 4, 23, 59))).toBe("auto-2026-11-04.json");
    expect(isAutoBackupFile("auto-2026-11-04.json")).toBe(true);
    expect(isAutoBackupFile("game-backlog-2026-11-04.json")).toBe(false);
  });

  it("keeps the newest seven and ignores other files", () => {
    const names = [
      "auto-2026-10-28.json",
      "auto-2026-11-01.json",
      "notes.txt",
      "auto-2026-10-30.json",
      "auto-2026-11-03.json",
      "auto-2026-10-29.json",
      "auto-2026-11-02.json",
      "auto-2026-10-31.json",
      "auto-2026-11-04.json",
    ];
    expect(filesToPrune(names)).toEqual(["auto-2026-10-28.json"]); // 8 files, keep 7
    expect(filesToPrune(names.slice(0, 3))).toEqual([]);
    expect(filesToPrune(names, 1)).toHaveLength(7);
  });
});
