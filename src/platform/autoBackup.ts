import { isTauri } from "@tauri-apps/api/core";
import { appConfigDir, join } from "@tauri-apps/api/path";
import { BaseDirectory, mkdir, readDir, remove, writeTextFile } from "@tauri-apps/plugin-fs";
import { deleteDocument, hasIndexedDb, listDocumentKeys, putDocument } from "../db/webStorage";
import { AUTO_BACKUP_DIR, autoBackupFileName, filesToPrune } from "../domain/autoBackup";

const baseDir = BaseDirectory.AppConfig;

/**
 * Write today's automatic backup and drop the oldest ones beyond the last
 * seven days. The desktop app writes files into `<app config>/backups/`;
 * the web build keeps them as `backups/<file>` documents in IndexedDB,
 * next to the app state. Does nothing where there is neither.
 */
export async function writeAutoBackup(text: string, now: Date = new Date()): Promise<void> {
  if (isTauri()) {
    await mkdir(AUTO_BACKUP_DIR, { baseDir, recursive: true });
    await writeTextFile(`${AUTO_BACKUP_DIR}/${autoBackupFileName(now)}`, text, { baseDir });
    const entries = await readDir(AUTO_BACKUP_DIR, { baseDir });
    for (const name of filesToPrune(entries.filter((e) => e.isFile).map((e) => e.name))) {
      await remove(`${AUTO_BACKUP_DIR}/${name}`, { baseDir });
    }
    return;
  }
  if (!hasIndexedDb()) return;
  const prefix = `${AUTO_BACKUP_DIR}/`;
  await putDocument(`${prefix}${autoBackupFileName(now)}`, text);
  const names = (await listDocumentKeys(prefix)).map((key) => key.slice(prefix.length));
  for (const name of filesToPrune(names)) await deleteDocument(`${prefix}${name}`);
}

/** Where the automatic backups live, for the settings panel; null outside the desktop app. */
export async function autoBackupFolder(): Promise<string | null> {
  if (!isTauri()) return null;
  return join(await appConfigDir(), AUTO_BACKUP_DIR);
}
