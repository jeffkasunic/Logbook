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
  /** The category the project sits under on the Projects tab; unset or unknown ids show under "Other". */
  categoryId?: string;
  /** Shown one step in, under the category's other projects. */
  indent?: boolean;
  note?: string;
}

/** One of a project's notes, shown oldest first on its page. */
export interface ProjectNote {
  id: string;
  /** ISO date the note was added. */
  date: string;
  text: string;
}

/** A to-do on a project's page. */
export interface ProjectTask {
  id: string;
  text: string;
  done: boolean;
  /** Shown one step in, under the task above. */
  indent?: boolean;
}

/**
 * A project's page on the Projects tab, keyed by the project's id. Kept outside its quarter so long notes don't
 * weigh down the quarter, and so the page is still there after the quarter ends.
 */
export interface ProjectDetails {
  description?: string;
  /** Shown on the project's page. */
  tasks?: ProjectTask[];
  /** Oldest first; new notes go at the end. */
  notes?: ProjectNote[];
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

/** A checklist the user adds to the Projects tab, e.g. "Habits" or "Trips". */
export interface PlanSection {
  id: string;
  title: string;
  /** `indent` shows the item one step in, under the one above. */
  items: { id: string; text: string; note?: string; done: boolean; indent?: boolean }[];
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
  projects: Project[];
  reading: ReadingItem[];
  /** Sections of the reading list; unset means the defaults (Fiction, Non-fiction). */
  readingCategories?: ReadingCategory[];
  /** User-added checklists shown on the Projects tab after the reading list. */
  sections?: PlanSection[];
  /** The Projects tab's own-section boxes as columns, top to bottom, by section id. Ids it doesn't know (like the retired 'projects' and 'reading') are ignored, and boxes it doesn't list go in the column with the fewest. */
  planLayout?: string[][];
}

export interface AppState {
  version: 1;
  quarters: Quarter[];
  activeQuarterId: string;
  /** Project pages, keyed by project id. Projects without one aren't listed. */
  projectDetails?: Record<string, ProjectDetails>;
}
