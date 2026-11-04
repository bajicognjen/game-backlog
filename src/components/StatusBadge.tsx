import type { GameStatus } from "../domain/types";
import { statusLabels } from "../i18n/sr";

export function StatusBadge({ status }: { status: GameStatus }) {
  return <span className={`status status-${status}`}>{statusLabels[status]}</span>;
}
