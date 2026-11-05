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
import type { Game } from "../domain/types";
import { t } from "../i18n/en";
import { GenreChip } from "./GenreChip";
import { IconButton } from "./IconButton";
import { PlatformChip } from "./PlatformChip";
import { RowMenu } from "./RowMenu";
import { TitleCell } from "./TitleCell";
import { TypeChip } from "./TypeChip";

interface Props {
  /** Already sorted and filtered the way the user asked. */
  games: Game[];
  /** Dragging only makes sense when the list shows the full finish order. */
  canReorder: boolean;
  onRate(game: Game): void;
  onEdit(game: Game): void;
  onDelete(game: Game): void;
  onOpen(game: Game): void;
  onMove(activeId: number, overId: number): void;
}

export function CompletedTable({ games, canReorder, onRate, onEdit, onDelete, onOpen, onMove }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (games.length === 0) {
    return <p className="empty">{t.emptyCompleted}</p>;
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (canReorder && over && active.id !== over.id) onMove(Number(active.id), Number(over.id));
  }

  return (
    <div className="table-wrap">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <table className="table completed-table">
          <thead>
            <tr>
              <th className="drag-col" aria-label={t.actions.drag} />
              <th className="num">{t.columns.index}</th>
              <th>{t.columns.title}</th>
              <th>{t.columns.type}</th>
              <th>{t.columns.genre}</th>
              <th>{t.columns.platform}</th>
              <th className="date">{t.columns.completedAt}</th>
              <th className="num">{t.columns.rating}</th>
              <th>{t.columns.review}</th>
              <th>{t.columns.note}</th>
              <th className="actions-col" />
            </tr>
          </thead>
          <SortableContext items={games.map((g) => g.id)} strategy={verticalListSortingStrategy}>
            <tbody>
              {games.map((game) => (
                <CompletedRow
                  key={game.id}
                  game={game}
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
  canReorder: boolean;
  onRate(game: Game): void;
  onEdit(game: Game): void;
  onDelete(game: Game): void;
  onOpen(game: Game): void;
}

function CompletedRow({ game, canReorder, onRate, onEdit, onDelete, onOpen }: RowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: game.id,
    disabled: !canReorder,
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    position: "relative",
    zIndex: isDragging ? 2 : undefined,
  };

  return (
    <tr ref={setNodeRef} style={style} className={`row-done ${isDragging ? "row-dragging" : ""}`}>
      <td className="drag-col">
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
          ⋮⋮
        </button>
      </td>
      <td className="num muted">{game.completedOrder ?? t.none}</td>
      <td className="title">
        <TitleCell game={game} onOpen={onOpen} />
      </td>
      <td>
        <TypeChip type={game.type} />
      </td>
      <td>
        <GenreChip genre={game.genre} />
      </td>
      <td>
        <PlatformChip platform={game.platform} />
      </td>
      <td className="date">{game.completedAt ? formatDate(game.completedAt) : t.none}</td>
      <td className="num">
        {game.rating === null ? (
          <button type="button" className="button button-small" onClick={() => onRate(game)}>
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
      <td className="note">{game.review}</td>
      <td className="note">{game.note}</td>
      <td className="actions-col">
        <div className="row-actions">
          <IconButton label={t.actions.edit} icon={"\u270E\uFE0E"} onClick={() => onEdit(game)} />
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
