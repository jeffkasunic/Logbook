import type { KeyboardEvent, ReactNode } from 'react';
import { useDragReorder } from '../lib/useDragReorder';

/** Drag handle for a sortable row. Focus it and use the arrow keys to move the row without a mouse. */
export function Grip({ label, ...handlers }: { label: string; onPointerDown: () => void; onPointerUp: () => void; onKeyDown: (e: KeyboardEvent) => void }) {
  return (
    <button type="button" className="grip" title="Drag to reorder" aria-label={`Reorder ${label} (arrow keys)`} {...handlers}>
      ⋮⋮
    </button>
  );
}

interface SortableListProps<T> {
  items: T[];
  onReorder: (items: T[]) => void;
  itemKey: (item: T, i: number) => string;
  itemLabel: (item: T) => string;
  itemClass?: (item: T) => string | undefined;
  renderItem: (item: T, i: number) => ReactNode;
  className?: string;
  /** Rendered after the rows, inside the list (e.g. an add row). */
  after?: ReactNode;
}

/** A <ul> whose rows can be dragged by their grip to reorder them. */
export function SortableList<T>({ items, onReorder, itemKey, itemLabel, itemClass, renderItem, className, after }: SortableListProps<T>) {
  const drag = useDragReorder(items, onReorder);
  return (
    <ul className={['sortable', className].filter(Boolean).join(' ')}>
      {items.map((it, i) => {
        const row = drag.row(i, itemLabel(it));
        return (
          <li key={itemKey(it, i)} {...row} className={[row.className, itemClass?.(it)].filter(Boolean).join(' ') || undefined}>
            <Grip {...drag.grip(i, itemLabel(it))} />
            {renderItem(it, i)}
          </li>
        );
      })}
      {after}
    </ul>
  );
}
