import { useLayoutEffect, useRef, useState } from 'react';

/** How many columns at least `minWidth` wide (plus the grid's column gap) fit in the element. */
export function useColumnCount<T extends HTMLElement>(minWidth: number) {
  const ref = useRef<T>(null);
  const [count, setCount] = useState(1);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
      setCount(Math.max(1, Math.floor((el.clientWidth + gap) / (minWidth + gap))));
    };
    measure();
    const sizes = new ResizeObserver(measure);
    sizes.observe(el);
    return () => sizes.disconnect();
  }, [minWidth]);

  return [ref, count] as const;
}

/**
 * Lay `ids` out in `count` columns, following `saved` where it can. Saved columns past `count`
 * fold onto the ones that fit, ids it doesn't know are dropped, and ids it doesn't list go in
 * the column with the fewest panels. When a saved column's panels have all gone (say, a retired
 * panel), that column is dropped and the panels are spread evenly across the columns, keeping
 * their order, so no gap is left. A column the user emptied by dragging is kept.
 */
export function arrangeColumns(saved: string[][] | undefined, ids: string[], count: number): string[][] {
  const cols = Array.from({ length: count }, (): string[] => []);
  const known = new Set(ids);
  const placed = new Set<string>();
  const live = (saved ?? []).filter((col) => col.length === 0 || col.some((id) => known.has(id)));
  live.forEach((col, j) =>
    col.forEach((id) => {
      if (!known.has(id) || placed.has(id)) return;
      cols[j % count].push(id);
      placed.add(id);
    }),
  );
  for (const id of ids) {
    if (placed.has(id)) continue;
    cols.reduce((a, b) => (b.length < a.length ? b : a)).push(id);
  }
  return live.length < (saved?.length ?? 0) ? spread(cols.flat(), count) : cols;
}

/** `ids` in order across `count` columns, as evenly as they go, with any extras in the leftmost columns. */
function spread(ids: string[], count: number): string[][] {
  const per = Math.floor(ids.length / count);
  const extra = ids.length % count;
  let at = 0;
  return Array.from({ length: count }, (_, j) => {
    const n = per + (j < extra ? 1 : 0);
    return ids.slice(at, (at += n));
  });
}
