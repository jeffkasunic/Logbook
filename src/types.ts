/** A tracked activity column, e.g. "Writing". Hours are logged against it each day. */
export interface Category {
  id: string;
  name: string;
  /** Target hours per week (the "Goal" column of the weekly sheet). */
  weeklyGoal: number;
  note?: string;
}

/** A non-hour daily measurement, e.g. sleep score or cups of water. */
export interface Metric {
  id: string;
  name: string;
  min: number;
  max: number | null;
}

export interface DayEntry {
  /** Target hours for the day (the "Goal" column of the daily sheet). */
  goal: number;
  hours?: Record<string, number>;
  metrics?: Record<string, number>;
}

export interface Project {
  id: string;
  text: string;
  done: boolean;
  /** Projects sharing a group number are shown together (blank rows in the sheet). */
  group: number;
  /** The category the project sits under on the Plan tab; unset or unknown ids show under "Other". */
  categoryId?: string;
  /** Shown one step in, under the category's other projects. */
  indent?: boolean;
  note?: string;
}

export type ReadingStatus = 'todo' | 'reading' | 'done';

/** A section of the reading list, e.g. "Fiction". */
export interface ReadingCategory {
  id: string;
  name: string;
}

export interface ReadingItem {
  id: string;
  title: string;
  note?: string;
  status: ReadingStatus;
  /** The reading category's id. Unset or unknown ids (e.g. a removed category) show as "Unsorted". */
  kind?: string;
}

/** A checklist the user adds to the Plan tab, e.g. "Habits" or "Trips". */
export interface PlanSection {
  id: string;
  title: string;
  /** `indent` shows the item one step in, under the one above. */
  items: { id: string; text: string; note?: string; done: boolean; indent?: boolean }[];
}

export interface GoalArea {
  title: string;
  items: string[];
  /** Items checked off on the Plan tab, stored by their text. */
  done?: string[];
  /** Items shown one step in, stored by their text. */
  indented?: string[];
  /** Notes on items, keyed by their text. */
  notes?: Record<string, string>;
}

export interface Quarter {
  /** e.g. "2026-Q4" */
  id: string;
  year: number;
  quarter: number;
  /** ISO date (YYYY-MM-DD) of the Monday that starts week 1. */
  startDate: string;
  defaultDailyGoal: number;
  categories: Category[];
  metrics: Metric[];
  /** Keyed by ISO date. */
  days: Record<string, DayEntry>;
  core: string[];
  /** Notes on core focus lines, keyed by their text. */
  coreNotes?: Record<string, string>;
  yearGoals: GoalArea[];
  projects: Project[];
  reading: ReadingItem[];
  /** Sections of the reading list; unset means the defaults (Fiction, Non-fiction). */
  readingCategories?: ReadingCategory[];
  /** User-added checklists shown on the Plan tab after the reading list. */
  sections?: PlanSection[];
  /** The Plan tab's panels as columns, top to bottom: 'core', 'goals', 'projects', 'reading' and section ids. Panels it doesn't list go in the column with the fewest. */
  planLayout?: string[][];
}

export interface AppState {
  version: 1;
  quarters: Quarter[];
  activeQuarterId: string;
}
