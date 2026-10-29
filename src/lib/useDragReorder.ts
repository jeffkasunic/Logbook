import { useState, type DragEvent, type KeyboardEvent } from 'react';

/** Move the item at `from` so it sits before index `to` (0..length). */
export function moveTo<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to > from ? to - 1 : to, 0, item);
  return next;
}

/** Put a reordered subset back into the full list, in the slots the subset occupied. */
export function mergeSubset<T>(all: T[], subset: T[], reordered: T[]): T[] {
  const slots = new Set(subset);
  let k = 0;
  return all.map((x) => (slots.has(x) ? reordered[k++] : x));
}

/**
 * Drag-to-reorder for a list or table. Rows only become draggable while their grip is held,
 * so the inputs inside stay selectable. The grip also moves its row with the arrow keys.
 * Events are stopped here so lists nested inside a sortable row don't move their parent.
 */
export function useDragReorder<T>(items: T[], onReorder: (items: T[]) => void) {
  const [armed, setArmed] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);
  const moves = (d: typeof drag): d is { from: number; to: number } => d != null && d.to !== d.from && d.to !== d.from + 1;
  const dropAt = (i: number) => moves(drag) && drag.to === i;

  return {
    grip: (i: number, label: string) => ({
      label,
      onPointerDown: () => setArmed(i),
      onPointerUp: () => setArmed(null),
      onKeyDown: (e: KeyboardEvent) => {
        const to = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 2 : null;
        if (to == null) return;
        e.preventDefault();
        if (to >= 0 && to <= items.length) onReorder(moveTo(items, i, to));
      },
    }),
    row: (i: number, label: string) => ({
      draggable: armed === i,
      className: [drag?.from === i && 'dragging', dropAt(i) && 'drop-before', i === items.length - 1 && dropAt(i + 1) && 'drop-after'].filter(Boolean).join(' ') || undefined,
      onDragStart: (e: DragEvent) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', label);
        setDrag({ from: i, to: i });
      },
      onDragOver: (e: DragEvent) => {
        if (!drag) return;
        e.preventDefault();
        e.stopPropagation();
        const r = e.currentTarget.getBoundingClientRect();
        const to = e.clientY < r.top + r.height / 2 ? i : i + 1;
        if (to !== drag.to) setDrag({ ...drag, to });
      },
      onDrop: (e: DragEvent) => {
        if (!drag) return;
        e.preventDefault();
        e.stopPropagation();
        if (moves(drag)) onReorder(moveTo(items, drag.from, drag.to));
      },
      onDragEnd: (e: DragEvent) => {
        e.stopPropagation();
        setDrag(null);
        setArmed(null);
      },
    }),
  };
}

/** A spot in a column layout: before the panel at `index` in column `col` (index = length is the end). */
export interface Slot {
  col: number;
  index: number;
}

/** Move panel `id` into `to`, where `to` counts positions as they were before the move. */
export function moveToSlot(cols: string[][], id: string, to: Slot): string[][] {
  const fromCol = cols.findIndex((c) => c.includes(id));
  const at = fromCol === to.col && cols[fromCol].indexOf(id) < to.index ? to.index - 1 : to.index;
  const next = cols.map((c) => c.filter((x) => x !== id));
  next[to.col].splice(at, 0, id);
  return next;
}

/**
 * Drag-to-move for panels stacked in columns: drop on a panel's top half to go above it, its
 * bottom half to go below it, or on a column's empty space to go at its end. As with rows,
 * panels only become draggable while their grip is held. The grip moves its panel with the
 * arrow keys: up and down within its column, left and right to the next column.
 */
export function useDragColumns(cols: string[][], onChange: (cols: string[][]) => void) {
  const [armed, setArmed] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; to: Slot | null } | null>(null);

  const where = (id: string): Slot => {
    const col = cols.findIndex((c) => c.includes(id));
    return { col, index: cols[col].indexOf(id) };
  };
  const target = (to: Slot | null | undefined, col: number, index: number) => to?.col === col && to.index === index;
  const hover = (e: DragEvent, to: Slot) => {
    if (!drag) return;
    e.preventDefault();
    e.stopPropagation();
    const from = where(drag.id);
    const moves = from.col !== to.col || (to.index !== from.index && to.index !== from.index + 1);
    const next = moves ? to : null;
    if (next?.col !== drag.to?.col || next?.index !== drag.to?.index) setDrag({ ...drag, to: next });
  };
  const drop = (e: DragEvent) => {
    if (!drag) return;
    e.preventDefault();
    e.stopPropagation();
    if (drag.to) onChange(moveToSlot(cols, drag.id, drag.to));
    // A panel dropped in another column is remounted there, so the browser's dragend goes to the
    // old, detached element and never reaches React. End the drag here instead.
    end();
  };
  const end = () => {
    setDrag(null);
    setArmed(null);
  };

  return {
    grip: (id: string, label: string) => ({
      label,
      onPointerDown: () => setArmed(id),
      onPointerUp: () => setArmed(null),
      onKeyDown: (e: KeyboardEvent) => {
        const { col, index } = where(id);
        const side = (c: number) => (c >= 0 && c < cols.length ? { col: c, index: Math.min(index, cols[c].length) } : null);
        const to =
          e.key === 'ArrowUp' ? (index > 0 ? { col, index: index - 1 } : null)
          : e.key === 'ArrowDown' ? (index < cols[col].length - 1 ? { col, index: index + 2 } : null)
          : e.key === 'ArrowLeft' ? side(col - 1)
          : e.key === 'ArrowRight' ? side(col + 1)
          : undefined;
        if (to === undefined) return;
        e.preventDefault();
        if (to) onChange(moveToSlot(cols, id, to));
      },
    }),
    panel: (id: string, label: string) => {
      const { col, index } = where(id);
      const last = index === cols[col].length - 1;
      return {
        draggable: armed === id,
        className: [drag?.id === id && 'dragging', target(drag?.to, col, index) && 'drop-before', last && target(drag?.to, col, index + 1) && 'drop-after'].filter(Boolean).join(' ') || undefined,
        onDragStart: (e: DragEvent) => {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', label);
          setDrag({ id, to: null });
        },
        onDragOver: (e: DragEvent) => {
          const r = e.currentTarget.getBoundingClientRect();
          hover(e, { col, index: e.clientY < r.top + r.height / 2 ? index : index + 1 });
        },
        onDrop: drop,
        onDragEnd: end,
      };
    },
    /** The column itself takes drops in the space below its last panel, and when it's empty. */
    column: (col: number) => ({
      className: cols[col].length === 0 && target(drag?.to, col, 0) ? 'drop-into' : undefined,
      onDragOver: (e: DragEvent) => hover(e, { col, index: cols[col].length }),
      onDrop: drop,
    }),
  };
}
