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
import { useRef, type CSSProperties, type ReactNode } from "react";
import { formatDate } from "../domain/dates";
import { formatHours } from "../domain/format";
import { progressOf } from "../domain/sessions";
import type { ScheduleRow } from "../domain/schedule";
import type { Game, GameStatus } from "../domain/types";
import { platformLabels, t } from "../i18n/en";
import { GenreChip } from "./GenreChip";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";
import { PlatformChip } from "./PlatformChip";
import { RowMenu, type RowMenuItem } from "./RowMenu";
import { StatusBadge } from "./StatusBadge";
import { TitleCell } from "./TitleCell";
import { TypeChip } from "./TypeChip";
import { useRovingGroup } from "./useRoving";

/** The row's controls form one Tab stop; the title is where Tab lands. */
const ROW_ROVING = { selector: 'button, [role="button"]', entry: ".title-cell-link", exclude: '[role="menu"]' };

/** One row of a plan: the PC plan carries schedule numbers, a queue or the Together list does not. */
export interface PlanRowView {
  game: Game;
  index: number;
  schedule: ScheduleRow | null;
}

interface Props {
  rows: PlanRowView[];
  /** Show hours, weeks, cumulative hours and dates (the PC plan). */
  showSchedule: boolean;
  /** Show each game's platform (the Together list mixes platforms). */
  showPlatform?: boolean;
  /** Id of the game whose planned span contains today, if any. */
  todayGameId?: number | null;
  /** The game the Now playing card shows; its row menu skips the actions the card already offers. */
  cardGameId?: number | null;
  /** Warning text per game id, shown as an icon with a tooltip on the row. */
  warnings?: ReadonlyMap<number, string>;
  /** False while a filter hides rows: dragging a partial list would scramble positions. */
  canReorder?: boolean;
  /** Shown instead of the table when there are no rows. */
  empty: ReactNode;
  onEdit(game: Game): void;
  onDelete(game: Game): void;
  onFinish(game: Game): void;
  onDrop(game: Game): void;
  onLog(game: Game): void;
  onOpen(game: Game): void;
  onStatus(game: Game, status: PlanStatus): void;
  /** Move a game into the Together list (true) or back to its platform's plan (false). */
  onTogether(game: Game, together: boolean): void;
  onMove(activeId: number, overId: number): void;
}

export type PlanStatus = Extract<GameStatus, "in_progress" | "pending" | "paused">;

export function PlanTable({
  rows,
  showSchedule,
  showPlatform = false,
  empty,
  todayGameId = null,
  cardGameId = null,
  warnings,
  canReorder = true,
  onEdit,
  onDelete,
  onFinish,
  onDrop,
  onLog,
  onOpen,
  onStatus,
  onTogether,
  onMove,
}: Props) {
  const sensors = useSensors(
    // A small distance threshold keeps plain clicks on buttons from starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (rows.length === 0) {
    return <>{empty}</>;
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (canReorder && over && active.id !== over.id) onMove(Number(active.id), Number(over.id));
  }

  const ids = rows.map((row) => row.game.id);

  return (
    <div className="table-wrap">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        {/* Explicit roles throughout: on a phone the rows become flex boxes, and browsers then stop exposing a table. */}
        <table role="table" className="table plan-table" aria-label={t.plan}>
          <thead role="rowgroup">
            <tr role="row">
              <th scope="col" role="columnheader" className="drag-col" aria-label={t.actions.drag} />
              <th scope="col" role="columnheader" className="num">
                {t.columns.index}
              </th>
              <th scope="col" role="columnheader">{t.columns.title}</th>
              <th scope="col" role="columnheader" title={t.columns.typeHint}>
                {t.columns.type}
              </th>
              <th scope="col" role="columnheader" className="col-opt-2">
                {t.columns.genre}
              </th>
              {showPlatform && (
                <th scope="col" role="columnheader">
                  {t.columns.platform}
                </th>
              )}
              <th scope="col" role="columnheader">{t.columns.status}</th>
              {showSchedule && (
                <>
                  <th scope="col" role="columnheader" className="num">
                    {t.columns.hours}
                  </th>
                  <th scope="col" role="columnheader" className="num col-opt">
                    {t.columns.cumulative}
                  </th>
                  <th scope="col" role="columnheader" className="date">
                    {t.columns.start}
                  </th>
                  <th scope="col" role="columnheader" className="date">
                    {t.columns.end}
                  </th>
                </>
              )}
              <th scope="col" role="columnheader" className="col-opt-2">
                {t.columns.note}
              </th>
              <th scope="col" role="columnheader" className="actions-col" aria-label={t.actions.more} />
            </tr>
          </thead>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <tbody role="rowgroup">
              {rows.map((row) => (
                <SortableRow
                  key={row.game.id}
                  row={row}
                  showSchedule={showSchedule}
                  showPlatform={showPlatform}
                  isToday={row.game.id === todayGameId}
                  onCard={row.game.id === cardGameId}
                  warning={warnings?.get(row.game.id) ?? null}
                  canReorder={canReorder}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onFinish={onFinish}
                  onDrop={onDrop}
                  onLog={onLog}
                  onOpen={onOpen}
                  onStatus={onStatus}
                  onTogether={onTogether}
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
  showPlatform: boolean;
  isToday: boolean;
  onCard: boolean;
  warning: string | null;
  canReorder: boolean;
  onEdit(game: Game): void;
  onDelete(game: Game): void;
  onFinish(game: Game): void;
  onDrop(game: Game): void;
  onLog(game: Game): void;
  onOpen(game: Game): void;
  onStatus(game: Game, status: PlanStatus): void;
  onTogether(game: Game, together: boolean): void;
}

function SortableRow({
  row,
  showSchedule,
  showPlatform,
  isToday,
  onCard,
  warning,
  canReorder,
  onEdit,
  onDelete,
  onFinish,
  onDrop,
  onLog,
  onOpen,
  onStatus,
  onTogether,
}: RowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: row.game.id,
    disabled: !canReorder,
  });
  const rowRef = useRef<HTMLTableRowElement | null>(null);
  const roving = useRovingGroup(rowRef, ROW_ROVING);
  const setRowRef = (node: HTMLTableRowElement | null) => {
    rowRef.current = node;
    setNodeRef(node);
  };
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

  // The row shows one status action and Edit; everything else sits in the menu. The card's own
  // game skips Finish and Pause here, since the card shows them as buttons.
  const menu: RowMenuItem[] = [
    ...(game.status === "in_progress" && !onCard
      ? [
          { label: t.actions.finish, onSelect: () => onFinish(game) },
          { label: t.actions.pause, onSelect: () => onStatus(game, "paused") },
        ]
      : []),
    ...(game.status === "paused" ? [{ label: t.actions.logHours, onSelect: () => onLog(game) }] : []),
    { label: t.actions.details, onSelect: () => onOpen(game) },
    game.together
      ? { label: t.actions.moveToPlan.replace("{platform}", platformLabels[game.platform]), onSelect: () => onTogether(game, false) }
      : { label: t.actions.moveToTogether, onSelect: () => onTogether(game, true) },
    ...(active ? [{ label: t.actions.drop, danger: true, onSelect: () => onDrop(game) }] : []),
    { label: t.actions.delete, danger: true, onSelect: () => onDelete(game) },
  ];

  return (
    <tr role="row" ref={setRowRef} style={style} className={classes || undefined} onFocus={roving.onFocus} onKeyDown={roving.onKeyDown}>
      <td role="cell" className="drag-col">
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
          <Icon name="grip" />
        </button>
      </td>
      <td role="cell" className="num muted index">{row.index}</td>
      <td role="cell" className="title">
        <TitleCell game={game} onOpen={onOpen} />
        {warning && (
          <span className="warning-icon" title={warning} role="img" aria-label={warning}>
            <Icon name="alert" size={15} />
          </span>
        )}
      </td>
      <td role="cell" className="design">
        <TypeChip type={game.type} />
      </td>
      <td role="cell" className="col-opt-2">
        <GenreChip genre={game.genre} />
      </td>
      {showPlatform && (
        <td role="cell" className="platform">
          <PlatformChip platform={game.platform} />
        </td>
      )}
      <td role="cell" className="status">
        <StatusBadge status={game.status} />
      </td>
      {showSchedule && schedule && (
        <>
          <td role="cell" className="num hours">
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
          <td role="cell" className="num col-opt">{formatHours(schedule.cumulativeHours)}</td>
          <td role="cell" className="date">{formatDate(schedule.startMs)}</td>
          <td role="cell" className="date">
            {formatDate(schedule.endMs)}
            {isToday && (
              <>
                {" "}
                <span className="today-marker">{t.today.marker}</span>
              </>
            )}
          </td>
        </>
      )}
      <td role="cell" className="note col-opt-2">
        {game.note && (
          <span className="clamp-2" title={game.note}>
            {game.note}
          </span>
        )}
      </td>
      <td role="cell" className="actions-col">
        <div className="row-actions">
          {game.status === "pending" && <IconButton label={t.actions.start} icon="play" onClick={() => onStatus(game, "in_progress")} />}
          {game.status === "paused" && <IconButton label={t.actions.resume} icon="play" onClick={() => onStatus(game, "in_progress")} />}
          {game.status === "in_progress" && <IconButton label={t.actions.logHours} icon="clock" onClick={() => onLog(game)} />}
          <IconButton label={t.actions.edit} icon="pencil" onClick={() => onEdit(game)} />
          <RowMenu items={menu} />
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
