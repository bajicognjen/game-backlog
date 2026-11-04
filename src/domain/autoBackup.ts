/** Rules for the automatic local backups; the file I/O lives in `platform/autoBackup.ts`. */

export const AUTO_BACKUP_DIR = "backups";
export const AUTO_BACKUP_KEEP = 7;
const PATTERN = /^auto-(\d{4}-\d{2}-\d{2})\.json$/;

/** One file per day, overwritten through the day. */
export function autoBackupFileName(now: Date = new Date()): string {
  const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return `auto-${iso}.json`;
}

export function isAutoBackupFile(name: string): boolean {
  return PATTERN.test(name);
}

/** Which of the automatic backup files to delete so that only the newest `keep` remain. */
export function filesToPrune(names: readonly string[], keep = AUTO_BACKUP_KEEP): string[] {
  return names
    .filter(isAutoBackupFile)
    .sort()
    .reverse()
    .slice(keep);
}
