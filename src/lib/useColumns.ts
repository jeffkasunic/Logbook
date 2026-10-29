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
 * the column with the fewest panels.
 */
export function arrangeColumns(saved: string[][] | undefined, ids: string[], count: number): string[][] {
  const cols = Array.from({ length: count }, (): string[] => []);
  const known = new Set(ids);
  const placed = new Set<string>();
  (saved ?? []).forEach((col, j) =>
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
  return cols;
}
