import { isTauri } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

export interface PickedFile {
  name: string;
  text: string;
}

const JSON_FILTER = [{ name: "JSON", extensions: ["json"] }];

/** Ask where to save and write the text. Resolves false when the user cancels. */
export async function saveTextFile(defaultName: string, text: string): Promise<boolean> {
  if (isTauri()) {
    const path = await save({ defaultPath: defaultName, filters: JSON_FILTER });
    if (!path) return false;
    await writeTextFile(path, text);
    return true;
  }
  // Plain browser preview: trigger a download.
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = defaultName;
  anchor.click();
  URL.revokeObjectURL(url);
  return true;
}

/** Ask for a file and read it as text. Resolves null when the user cancels. */
export async function openTextFile(): Promise<PickedFile | null> {
  if (isTauri()) {
    const path = await open({ multiple: false, directory: false, filters: JSON_FILTER });
    if (!path) return null;
    return { name: baseName(path), text: await readTextFile(path) };
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? { name: file.name, text: await file.text() } : null);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

function baseName(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}
