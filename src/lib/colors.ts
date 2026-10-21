// Categories take series colours in a fixed order (validated for colour-vision
// deficiency as adjacent pairs). Colour follows the category's position in the
// quarter's list; past eight categories, extras share a neutral tone.
export const SERIES_COUNT = 8;

export function seriesVar(index: number): string {
  return index < SERIES_COUNT ? `var(--series-${index + 1})` : 'var(--series-other)';
}

/** Sequential step (0–5) for a fraction of a goal, used by heat cells. */
export function heatStep(pct: number | null): number {
  if (pct == null || pct <= 0) return 0;
  if (pct < 0.25) return 1;
  if (pct < 0.5) return 2;
  if (pct < 0.75) return 3;
  if (pct < 1) return 4;
  return 5;
}
