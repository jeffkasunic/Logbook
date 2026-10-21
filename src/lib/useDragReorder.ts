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
