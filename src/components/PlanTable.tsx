import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CSSProperties } from "react";
import { formatDate } from "../domain/dates";
import { formatHours, formatWeeks } from "../domain/format";
import type { ScheduleRow } from "../domain/schedule";
import type { Game, GameStatus } from "../domain/types";
import { t } from "../i18n/sr";
import { StatusBadge } from "./StatusBadge";
import { TypeChip } from "./TypeChip";

/** One row of a plan: the PC plan carries schedule numbers, a plain queue does not. */
export interface PlanRowView {
  game: Game;
  index: number;
  schedule: ScheduleRow | null;
}

interface Props {
  rows: PlanRowView[];
  /** Show hours, weeks, cumulative hours and dates (the PC plan). */
  showSchedule: boolean;
  emptyText: string;
  onEdit(game: Game): void;
  onDelete(game: Game): void;
  onFinish(game: Game): void;
  onStatus(game: Game, status: Exclude<GameStatus, "completed">): void;
  onMove(activeId: number, overId: number): void;
}

export function PlanTable({ rows, showSchedule, emptyText, onEdit, onDelete, onFinish, onStatus, onMove }: Props) {
  const sensors = useSensors(
    // A small distance threshold keeps plain clicks on buttons from starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (rows.length === 0) {
    return <p className="empty">{emptyText}</p>;
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (over && active.id !== over.id) onMove(Number(active.id), Number(over.id));
  }

  const ids = rows.map((row) => row.game.id);

  return (
    <div className="table-wrap">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <table className="table plan-table">
          <thead>
            <tr>
              <th className="drag-col" aria-label={t.actions.drag} />
              <th className="num">{t.columns.index}</th>
              <th>{t.columns.title}</th>
              <th>{t.columns.type}</th>
              <th>{t.columns.status}</th>
              {showSchedule && (
                <>
                  <th className="num">{t.columns.hours}</th>
                  <th className="num">{t.columns.weeks}</th>
                  <th className="num">{t.columns.cumulative}</th>
                  <th className="date">{t.columns.start}</th>
                  <th className="date">{t.columns.end}</th>
                </>
              )}
              <th>{t.columns.note}</th>
              <th className="actions-col" />
            </tr>
          </thead>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <tbody>
              {rows.map((row) => (
                <SortableRow
                  key={row.game.id}
                  row={row}
                  showSchedule={showSchedule}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onFinish={onFinish}
                  onStatus={onStatus}
                />
              ))}
            </tbody>
          </SortableContext>
        </table>
      </DndContext>
    </div>
  );
}

interface RowProps {
  row: PlanRowView;
  showSchedule: boolean;
  onEdit(game: Game): void;
  onDelete(game: Game): void;
  onFinish(game: Game): void;
  onStatus(game: Game, status: Exclude<GameStatus, "completed">): void;
}

function SortableRow({ row, showSchedule, onEdit, onDelete, onFinish, onStatus }: RowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: row.game.id,
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    position: "relative",
    zIndex: isDragging ? 2 : undefined,
  };
  const { game, schedule } = row;
  const classes = [
    game.status === "in_progress" ? "row-current" : "",
    game.status === "paused" ? "row-paused" : "",
    isDragging ? "row-dragging" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const active = game.status === "in_progress" || game.status === "paused";

  return (
    <tr ref={setNodeRef} style={style} className={classes || undefined}>
      <td className="drag-col">
        <button
          ref={setActivatorNodeRef}
          type="button"
          className="drag-handle"
          aria-label={t.actions.drag}
          title={t.actions.drag}
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </button>
      </td>
      <td className="num muted">{row.index}</td>
      <td className="title">{game.title}</td>
      <td>
        <TypeChip type={game.type} />
      </td>
      <td>
        <StatusBadge status={game.status} />
      </td>
      {showSchedule && schedule && (
        <>
          <td className="num">{formatHours(schedule.hours)}</td>
          <td className="num">{formatWeeks(schedule.weeks)}</td>
          <td className="num">{formatHours(schedule.cumulativeHours)}</td>
          <td className="date">{formatDate(schedule.startMs)}</td>
          <td className="date">{formatDate(schedule.endMs)}</td>
        </>
      )}
      <td className="note">{game.note}</td>
      <td className="actions-col">
        <div className={`row-actions ${active ? "row-actions-visible" : ""}`}>
          {game.status === "pending" && (
            <button type="button" className="button button-small" onClick={() => onStatus(game, "in_progress")}>
              ▶ {t.actions.start}
            </button>
          )}
          {game.status === "paused" && (
            <button type="button" className="button button-small" onClick={() => onStatus(game, "in_progress")}>
              ▶ {t.actions.resume}
            </button>
          )}
          {game.status === "in_progress" && (
            <>
              <button type="button" className="button button-small button-success" onClick={() => onFinish(game)}>
                ✓ {t.actions.finish}
              </button>
              <button type="button" className="button button-small" onClick={() => onStatus(game, "paused")}>
                ⏸ {t.actions.pause}
              </button>
            </>
          )}
          <button type="button" className="button button-small" onClick={() => onEdit(game)}>
            {t.actions.edit}
          </button>
          <button type="button" className="button button-small button-danger-ghost" onClick={() => onDelete(game)}>
            {t.actions.delete}
          </button>
        </div>
      </td>
    </tr>
  );
}
