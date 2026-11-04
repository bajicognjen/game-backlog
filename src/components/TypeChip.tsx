import type { GameType } from "../domain/types";
import { typeLabels } from "../i18n/sr";

export function TypeChip({ type }: { type: GameType }) {
  return <span className={`chip chip-${type}`}>{typeLabels[type]}</span>;
}
