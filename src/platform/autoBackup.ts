import { isTauri } from "@tauri-apps/api/core";
import { appConfigDir, join } from "@tauri-apps/api/path";
import { BaseDirectory, mkdir, readDir, remove, writeTextFile } from "@tauri-apps/plugin-fs";
import { AUTO_BACKUP_DIR, autoBackupFileName, filesToPrune } from "../domain/autoBackup";

const baseDir = BaseDirectory.AppConfig;

/**
 * Write today's automatic backup into `<app config>/backups/` and drop the
 * oldest ones beyond the last seven days. Does nothing in the browser preview.
 */
export async function writeAutoBackup(text: string, now: Date = new Date()): Promise<void> {
  if (!isTauri()) return;
  await mkdir(AUTO_BACKUP_DIR, { baseDir, recursive: true });
  await writeTextFile(`${AUTO_BACKUP_DIR}/${autoBackupFileName(now)}`, text, { baseDir });
  const entries = await readDir(AUTO_BACKUP_DIR, { baseDir });
  for (const name of filesToPrune(entries.filter((e) => e.isFile).map((e) => e.name))) {
    await remove(`${AUTO_BACKUP_DIR}/${name}`, { baseDir });
  }
}

/** Where the automatic backups live, for the settings panel; null in the browser preview. */
export async function autoBackupFolder(): Promise<string | null> {
  if (!isTauri()) return null;
  return join(await appConfigDir(), AUTO_BACKUP_DIR);
}
