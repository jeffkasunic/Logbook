import type { AppState, Project, Quarter } from '../types';
import { seriesVar } from './colors';

/**
 * Asks before removing a project from a quarter when that would delete its page too, i.e. it has one and no other
 * quarter lists the project. True means go ahead.
 */
export function confirmRemoveProject(state: AppState, quarterId: string, p: Project): boolean {
  if (!state.projectDetails?.[p.id]) return true;
  if (state.quarters.some((q) => q.id !== quarterId && q.projects.some((x) => x.id === p.id))) return true;
  return confirm(`Remove “${p.text}”? Its project page and notes will be deleted too.`);
}

/** A quarter's projects under their categories, then "Other" for the rest, leaving out empty groups. */
export function projectGroups(q: Quarter): { key: string; title: string; color?: string; items: Project[] }[] {
  const known = new Set(q.categories.map((c) => c.id));
  return [
    ...q.categories.map((c, i) => ({ key: c.id, title: c.name, color: seriesVar(i), items: q.projects.filter((p) => p.categoryId === c.id) })),
    { key: 'other', title: 'Other', color: undefined, items: q.projects.filter((p) => !p.categoryId || !known.has(p.categoryId)) },
  ].filter((g) => g.items.length > 0);
}
