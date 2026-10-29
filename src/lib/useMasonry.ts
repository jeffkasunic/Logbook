import { useLayoutEffect, useRef } from 'react';

/**
 * Masonry for a CSS grid with 1px auto rows and no row gap: each child spans as many rows as
 * its height plus the column gap, so a short panel slots in under another short one instead of
 * waiting for the tallest panel in its row. Children stay in DOM order for reading and tabbing.
 */
export function useMasonry<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useLayoutEffect(() => {
    const grid = ref.current;
    if (!grid) return;
    const fit = (el: HTMLElement) => {
      const gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
      el.style.gridRowEnd = `span ${Math.ceil(el.getBoundingClientRect().height + gap)}`;
    };
    const sizes = new ResizeObserver((entries) => entries.forEach((e) => fit(e.target as HTMLElement)));
    const watch = () => {
      sizes.disconnect();
      for (const el of grid.children) {
        fit(el as HTMLElement);
        sizes.observe(el);
      }
    };
    watch();
    const kids = new MutationObserver(watch);
    kids.observe(grid, { childList: true });
    return () => {
      sizes.disconnect();
      kids.disconnect();
    };
  }, []);

  return ref;
}
