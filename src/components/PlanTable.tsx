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
import { progressOf } from "../domain/sessions";
import type { ScheduleRow } from "../domain/schedule";
import type { Game, GameStatus } from "../domain/types";
import { t } from "../i18n/en";
import { GenreChip } from "./GenreChip";
import { IconButton } from "./IconButton";
import { RowMenu } from "./RowMenu";
import { StatusBadge } from "./StatusBadge";
import { TitleCell } from "./TitleCell";
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
  /** Id of the game whose planned span contains today, if any. */
  todayGameId?: number | null;
  /** Warning text per game id, shown as an icon with a tooltip on the row. */
  warnings?: ReadonlyMap<number, string>;
  /** False while a filter hides rows: dragging a partial list would scramble positions. */
  canReorder?: boolean;
  emptyText: string;
  onEdit(game: Game): void;
  onDelete(game: Game): void;
  onFinish(game: Game): void;
  onDrop(game: Game): void;
  onLog(game: Game): void;
  onOpen(game: Game): void;
  onStatus(game: Game, status: PlanStatus): void;
  onMove(activeId: number, overId: number): void;
}

export type PlanStatus = Extract<GameStatus, "in_progress" | "pending" | "paused">;

export function PlanTable({
  rows,
  showSchedule,
  emptyText,
  todayGameId = null,
  warnings,
  canReorder = true,
  onEdit,
  onDelete,
  onFinish,
  onDrop,
  onLog,
  onOpen,
  onStatus,
  onMove,
}: Props) {
  const sensors = useSensors(
    // A small distance threshold keeps plain clicks on buttons from starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (rows.length === 0) {
    return <p className="empty">{emptyText}</p>;
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (canReorder && over && active.id !== over.id) onMove(Number(active.id), Number(over.id));
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
              <th>{t.columns.genre}</th>
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
                  isToday={row.game.id === todayGameId}
                  warning={warnings?.get(row.game.id) ?? null}
                  canReorder={canReorder}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onFinish={onFinish}
                  onDrop={onDrop}
                  onLog={onLog}
                  onOpen={onOpen}
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
  isToday: boolean;
  warning: string | null;
  canReorder: boolean;
  onEdit(game: Game): void;
  onDelete(game: Game): void;
  onFinish(game: Game): void;
  onDrop(game: Game): void;
  onLog(game: Game): void;
  onOpen(game: Game): void;
  onStatus(game: Game, status: PlanStatus): void;
}

function SortableRow({ row, showSchedule, isToday, warning, canReorder, onEdit, onDelete, onFinish, onDrop, onLog, onOpen, onStatus }: RowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: row.game.id,
    disabled: !canReorder,
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
  const progress = progressOf(game);

  return (
    <tr ref={setNodeRef} style={style} className={classes || undefined}>
      <td className="drag-col">
        <button
          ref={setActivatorNodeRef}
          type="button"
          className="drag-handle"
          aria-label={t.actions.drag}
          title={canReorder ? t.actions.drag : t.filters.noReorder}
          disabled={!canReorder}
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </button>
      </td>
      <td className="num muted">{row.index}</td>
      <td className="title">
        <TitleCell game={game} onOpen={onOpen} />
        {warning && (
          <span className="warning-icon" title={warning} aria-label={warning}>
            !
          </span>
        )}
      </td>
      <td>
        <TypeChip type={game.type} />
      </td>
      <td>
        <GenreChip genre={game.genre} />
      </td>
      <td>
        <StatusBadge status={game.status} />
      </td>
      {showSchedule && schedule && (
        <>
          <td className="num">
            {game.hoursPlayed > 0 ? (
              <span className="hours-cell" title={hoursTitle(game, schedule.hours)}>
                <span>
                  {formatHours(game.hoursPlayed)}
                  {progress !== null && <span className="muted hours-of"> / {formatHours(game.casualHours)}</span>}
                </span>
                {progress !== null && (
                  <span className="progress" aria-hidden="true">
                    <span className="progress-bar" style={{ width: `${Math.round(progress * 100)}%` }} />
                  </span>
                )}
              </span>
            ) : (
              formatHours(schedule.hours)
            )}
          </td>
          <td className="num">{formatWeeks(schedule.weeks)}</td>
          <td className="num">{formatHours(schedule.cumulativeHours)}</td>
          <td className="date">{formatDate(schedule.startMs)}</td>
          <td className="date">
            {formatDate(schedule.endMs)}
            {isToday && <span className="today-marker">{t.today.marker}</span>}
          </td>
        </>
      )}
      <td className="note">{game.note}</td>
      <td className="actions-col">
        <div className={`row-actions ${active ? "row-actions-visible" : ""}`}>
          {game.status === "pending" && (
            <IconButton label={t.actions.start} icon={"\u25B6\uFE0E"} onClick={() => onStatus(game, "in_progress")} />
          )}
          {game.status === "paused" && (
            <IconButton label={t.actions.resume} icon={"\u25B6\uFE0E"} onClick={() => onStatus(game, "in_progress")} />
          )}
          {game.status === "in_progress" && (
            <>
              <IconButton label={t.actions.finish} icon="✓" variant="success" onClick={() => onFinish(game)} />
              <IconButton label={t.actions.pause} icon={"\u23F8\uFE0E"} onClick={() => onStatus(game, "paused")} />
            </>
          )}
          {active && <IconButton label={t.actions.logHours} icon="+h" onClick={() => onLog(game)} />}
          <IconButton label={t.actions.edit} icon={"\u270E\uFE0E"} onClick={() => onEdit(game)} />
          <RowMenu
            items={[
              { label: t.actions.details, onSelect: () => onOpen(game) },
              ...(active ? [{ label: t.actions.drop, danger: true, onSelect: () => onDrop(game) }] : []),
              { label: t.actions.delete, danger: true, onSelect: () => onDelete(game) },
            ]}
          />
        </div>
      </td>
    </tr>
  );
}

/** Tooltip for the hours cell: played, estimate and what the plan still counts. */
function hoursTitle(game: Game, remaining: number): string {
  if (game.casualHours <= 0) return t.sessions.summaryNoEstimate.replace("{played}", formatHours(game.hoursPlayed));
  return t.sessions.summary
    .replace("{played}", formatHours(game.hoursPlayed))
    .replace("{estimate}", formatHours(game.casualHours))
    .replace("{remaining}", formatHours(remaining));
}
