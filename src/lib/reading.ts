import type { Quarter, ReadingCategory, ReadingStatus } from '../types';

/** The reading list's sections until the user changes them. Ids match books sorted before sections were editable. */
export const DEFAULT_READING_CATEGORIES: ReadingCategory[] = [
  { id: 'fiction', name: 'Fiction' },
  { id: 'nonfiction', name: 'Non-fiction' },
];

export function readingCategories(q: Quarter): ReadingCategory[] {
  return q.readingCategories ?? DEFAULT_READING_CATEGORIES;
}

export const STATUS_LABEL: Record<ReadingStatus, string> = { todo: 'To read', reading: 'Reading', done: 'Read' };
/** Clicking a status pill steps through the statuses in this order. */
export const NEXT_STATUS: Record<ReadingStatus, ReadingStatus> = { todo: 'reading', reading: 'done', done: 'todo' };
