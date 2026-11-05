import type { Platform } from "../domain/types";
import { platformLabels } from "../i18n/en";

export function PlatformChip({ platform }: { platform: Platform }) {
  return <span className={`chip chip-platform chip-platform-${platform}`}>{platformLabels[platform]}</span>;
}
