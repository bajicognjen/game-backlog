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
import type { Game } from "../domain/types";
import { t } from "../i18n/en";
import { GenreChip } from "./GenreChip";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";
import { PlatformChip } from "./PlatformChip";
import { RowMenu } from "./RowMenu";
import { TitleCell } from "./TitleCell";
import { TypeChip } from "./TypeChip";
import { useRovingGroup } from "./useRoving";

/** The row's controls form one Tab stop; the title is where Tab lands. */
const ROW_ROVING = { selector: 'button, [role="button"]', entry: ".title-cell-link", exclude: '[role="menu"]' };

interface Props {
  /** Already sorted and filtered the way the user asked. */
  games: Game[];
  /** Dragging only makes sense when the list shows the full finish order. */
  canReorder: boolean;
  /** Shown instead of the table when there are no rows. */
  empty: ReactNode;
  /** The game finished moments ago; its row arrives with a short highlight. */
  arrivedId?: number | null;
  onRate(game: Game): void;
  onEdit(game: Game): void;
  onDelete(game: Game): void;
  onOpen(game: Game): void;
  onMove(activeId: number, overId: number): void;
}

export function CompletedTable({ games, canReorder, empty, arrivedId = null, onRate, onEdit, onDelete, onOpen, onMove }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (games.length === 0) {
    return <>{empty}</>;
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (canReorder && over && active.id !== over.id) onMove(Number(active.id), Number(over.id));
  }

  return (
    <div className="table-wrap">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        {/* Explicit roles throughout: on a phone the rows become flex boxes, and browsers then stop exposing a table. */}
        <table role="table" className="table completed-table" aria-label={t.completed}>
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
              <th scope="col" role="columnheader">{t.columns.platform}</th>
              <th scope="col" role="columnheader" className="date">
                {t.columns.completedAt}
              </th>
              <th scope="col" role="columnheader" className="num">
                {t.columns.rating}
              </th>
              <th scope="col" role="columnheader">{t.columns.reviewNote}</th>
              <th scope="col" role="columnheader" className="actions-col" aria-label={t.actions.more} />
            </tr>
          </thead>
          <SortableContext items={games.map((g) => g.id)} strategy={verticalListSortingStrategy}>
            <tbody role="rowgroup">
              {games.map((game) => (
                <CompletedRow
                  key={game.id}
                  game={game}
                  arrived={game.id === arrivedId}
                  canReorder={canReorder}
                  onRate={onRate}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onOpen={onOpen}
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
  game: Game;
  arrived: boolean;
  canReorder: boolean;
  onRate(game: Game): void;
  onEdit(game: Game): void;
  onDelete(game: Game): void;
  onOpen(game: Game): void;
}

function CompletedRow({ game, arrived, canReorder, onRate, onEdit, onDelete, onOpen }: RowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: game.id,
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

  return (
    <tr role="row"
      ref={setRowRef}
      id={`game-${game.id}`}
      style={style}
      className={[isDragging ? "row-dragging" : "", arrived ? "row-arrived" : ""].filter(Boolean).join(" ") || undefined}
      onFocus={roving.onFocus}
      onKeyDown={roving.onKeyDown}
    >
      <td role="cell" className="drag-col">
        <button
          ref={setActivatorNodeRef}
          type="button"
          className="drag-handle"
          aria-label={t.actions.drag}
          title={canReorder ? t.actions.drag : t.completedReorderHint}
          disabled={!canReorder}
          {...attributes}
          {...listeners}
        >
          <Icon name="grip" />
        </button>
      </td>
      <td role="cell" className="num muted index">{game.completedOrder ?? t.none}</td>
      <td role="cell" className="title">
        <TitleCell game={game} onOpen={onOpen} />
      </td>
      <td role="cell">
        <TypeChip type={game.type} />
      </td>
      <td role="cell" className="col-opt-2">
        <GenreChip genre={game.genre} />
      </td>
      <td role="cell">
        <PlatformChip platform={game.platform} />
      </td>
      <td role="cell" className="date">{game.completedAt ? formatDate(game.completedAt) : t.none}</td>
      <td role="cell" className="num">
        {game.rating === null ? (
          <button type="button" className="link-button rating-link" onClick={() => onRate(game)}>
            {t.actions.rate}
          </button>
        ) : (
          <button
            type="button"
            className="rating-value"
            onClick={() => onRate(game)}
            title={t.actions.changeRating}
            aria-label={`${t.actions.changeRating}: ${game.rating}/10`}
          >
            {game.rating}
            <span className="muted">/10</span>
          </button>
        )}
      </td>
      <td role="cell" className="note">
        {(game.review || game.note) && (
          <span className="note-stack">
            {game.review && (
              <span className="clamp-2" title={game.review}>
                {game.review}
              </span>
            )}
            {game.note && (
              <span className="clamp-2 muted" title={game.note}>
                {game.note}
              </span>
            )}
          </span>
        )}
      </td>
      <td role="cell" className="actions-col">
        <div className="row-actions">
          <IconButton label={t.actions.edit} icon="pencil" onClick={() => onEdit(game)} />
          <RowMenu
            items={[
              { label: t.actions.details, onSelect: () => onOpen(game) },
              { label: t.actions.delete, danger: true, onSelect: () => onDelete(game) },
            ]}
          />
        </div>
      </td>
    </tr>
  );
}
