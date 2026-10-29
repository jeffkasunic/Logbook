import { createContext, useContext, useEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import type { AppState, DayEntry, ProjectDetails, Quarter } from './types';
import { addDays, inQuarter, quarterDays, quarterOf, todayISO } from './lib/dates';
import { api } from './lib/api';
import { SignedOutError } from './lib/auth';

/** Where the app kept everything before accounts; read once to copy it into the user's account. */
export const LOCAL_STORAGE_KEY = 'logbook:v1';
/** A guest's data, kept only for this browser tab and never sent to the server. */
export const GUEST_KEY = 'logbook:guest';

/** Keeps a guest's data for this tab; null ends the guest session. */
export function saveGuest(state: AppState | null) {
  try {
    if (state) sessionStorage.setItem(GUEST_KEY, JSON.stringify(state));
    else sessionStorage.removeItem(GUEST_KEY);
  } catch {
    /* storage full or blocked: keep working in memory */
  }
}

// ---------- initial state ----------

/** An empty quarter for the ISO quarter containing `date`. */
export function blankQuarter(date: string): Quarter {
  const { year, quarter, startDate } = quarterOf(date);
  return {
    id: `${year}-Q${quarter}`,
    year,
    quarter,
    startDate,
    defaultDailyGoal: 4,
    categories: [],
    metrics: [],
    days: {},
    core: [],
    yearGoals: [],
    projects: [],
    reading: [],
  };
}

/** What a new user starts with: the current quarter, with nothing in it yet. */
export function blankState(): AppState {
  const q = blankQuarter(todayISO());
  return { version: 1, quarters: [q], activeQuarterId: q.id };
}

export function isValidState(s: unknown): s is AppState {
  const st = s as AppState;
  return (
    !!st &&
    st.version === 1 &&
    Array.isArray(st.quarters) &&
    st.quarters.length > 0 &&
    st.quarters.every((q) => typeof q.id === 'string' && typeof q.startDate === 'string' && Array.isArray(q.categories))
  );
}

// ---------- actions ----------

export type Action =
  | { type: 'setActive'; quarterId: string }
  | { type: 'setHours'; quarterId: string; date: string; categoryId: string; value: number | null }
  | { type: 'setGoal'; quarterId: string; date: string; value: number }
  | { type: 'setMetric'; quarterId: string; date: string; metricId: string; value: number | null }
  | { type: 'updateQuarter'; quarterId: string; patch: Partial<Omit<Quarter, 'id'>> }
  | { type: 'addQuarter' }
  | { type: 'deleteQuarter'; quarterId: string }
  /** Merges `patch` into a project's page; empty fields are dropped, and so is a page left with nothing on it. */
  | { type: 'setProjectDetails'; projectId: string; patch: Partial<ProjectDetails> }
  | { type: 'replace'; state: AppState };

function patchDay(q: Quarter, date: string, fn: (d: DayEntry) => DayEntry): Quarter {
  const prev = q.days[date] ?? { goal: q.defaultDailyGoal };
  return { ...q, days: { ...q.days, [date]: fn(prev) } };
}

function setRecord(rec: Record<string, number> | undefined, key: string, value: number | null) {
  const next = { ...(rec ?? {}) };
  if (value == null || value === 0) delete next[key];
  else next[key] = value;
  return Object.keys(next).length ? next : undefined;
}

function mapQuarter(state: AppState, id: string, fn: (q: Quarter) => Quarter): AppState {
  return { ...state, quarters: state.quarters.map((q) => (q.id === id ? fn(q) : q)) };
}

/** Find the quarter that contains a date, if any. */
export function quarterFor(state: AppState, date: string): Quarter | undefined {
  return state.quarters.find((q) => inQuarter(q, date));
}

/** Drops the pages of projects no quarter lists any more, keeping `state` as is when there are none. */
function prunePages(state: AppState): AppState {
  if (!state.projectDetails) return state;
  const ids = new Set(state.quarters.flatMap((q) => q.projects.map((p) => p.id)));
  const kept = Object.entries(state.projectDetails).filter(([id]) => ids.has(id));
  if (kept.length === Object.keys(state.projectDetails).length) return state;
  return { ...state, projectDetails: kept.length ? Object.fromEntries(kept) : undefined };
}

function reducer(state: AppState, a: Action): AppState {
  switch (a.type) {
    case 'setActive':
      return { ...state, activeQuarterId: a.quarterId };

    case 'setHours':
      return mapQuarter(state, a.quarterId, (q) =>
        patchDay(q, a.date, (d) => ({ ...d, hours: setRecord(d.hours, a.categoryId, a.value) })),
      );

    case 'setGoal':
      return mapQuarter(state, a.quarterId, (q) => patchDay(q, a.date, (d) => ({ ...d, goal: a.value })));

    case 'setMetric':
      return mapQuarter(state, a.quarterId, (q) =>
        patchDay(q, a.date, (d) => ({ ...d, metrics: setRecord(d.metrics, a.metricId, a.value) })),
      );

    case 'updateQuarter':
      return prunePages(mapQuarter(state, a.quarterId, (q) => ({ ...q, ...a.patch })));

    case 'addQuarter': {
      const last = [...state.quarters].sort((x, y) => x.startDate.localeCompare(y.startDate)).at(-1)!;
      const quarter = (last.quarter % 4) + 1;
      const year = quarter === 1 ? last.year + 1 : last.year;
      const id = `${year}-Q${quarter}`;
      if (state.quarters.some((q) => q.id === id)) return state;
      const next: Quarter = {
        ...structuredClone(last),
        id,
        year,
        quarter,
        // Starts the day after the last quarter ends, which lands on the next ISO year's week 1 after a 14-week Q4.
        startDate: addDays(last.startDate, quarterDays(last)),
        days: {},
        // Unfinished projects carry over with the same ids, so their pages on the Projects tab come along.
        projects: last.projects.filter((p) => !p.done),
        reading: last.reading.filter((r) => r.status !== 'done'),
        sections: last.sections?.map((s) => ({ ...s, items: s.items.filter((i) => !i.done) })),
      };
      return { ...state, quarters: [...state.quarters, next], activeQuarterId: id };
    }

    case 'deleteQuarter': {
      if (state.quarters.length <= 1) return state;
      const quarters = state.quarters.filter((q) => q.id !== a.quarterId);
      return prunePages({
        ...state,
        quarters,
        activeQuarterId: state.activeQuarterId === a.quarterId ? quarters.at(-1)!.id : state.activeQuarterId,
      });
    }

    case 'setProjectDetails': {
      const merged: ProjectDetails = { ...state.projectDetails?.[a.projectId], ...a.patch };
      for (const k of Object.keys(merged) as (keyof ProjectDetails)[]) if (!merged[k] || merged[k].length === 0) delete merged[k];
      const projectDetails = { ...state.projectDetails };
      delete projectDetails[a.projectId];
      if (Object.keys(merged).length) projectDetails[a.projectId] = merged;
      return { ...state, projectDetails: Object.keys(projectDetails).length ? projectDetails : undefined };
    }

    case 'replace':
      return a.state;
  }
}

// ---------- context ----------

// ---------- saving ----------

export type SaveStatus = 'saved' | 'saving' | 'error' | 'signedOut';

type Save = () => Promise<unknown>;

/**
 * The API calls that bring the server from `prev` to `next`. The reducer keeps the identity of anything it
 * didn't change, so only changed quarters and days are compared and sent.
 */
function changes(prev: AppState, next: AppState): Save[] {
  const saves: Save[] = [];
  if (prev.activeQuarterId !== next.activeQuarterId) saves.push(() => api.putState(next.activeQuarterId));

  const before = new Map(prev.quarters.map((q) => [q.id, q]));
  for (const q of next.quarters) {
    const old = before.get(q.id);
    if (old === q) continue;
    const fields = new Set([...Object.keys(q), ...Object.keys(old ?? {})]);
    fields.delete('days');
    if (!old || [...fields].some((k) => old[k as keyof Quarter] !== q[k as keyof Quarter])) saves.push(() => api.putQuarter(q));
    for (const [date, day] of Object.entries(q.days)) {
      if (old?.days[date] !== day) saves.push(() => api.putDay(q.id, date, day));
    }
  }
  for (const id of before.keys()) {
    if (!next.quarters.some((q) => q.id === id)) saves.push(() => api.deleteQuarter(id));
  }

  const oldDetails = prev.projectDetails ?? {};
  const newDetails = next.projectDetails ?? {};
  for (const [id, d] of Object.entries(newDetails)) if (oldDetails[id] !== d) saves.push(() => api.putProject(id, d));
  for (const id of Object.keys(oldDetails)) if (!(id in newDetails)) saves.push(() => api.deleteProject(id));
  return saves;
}

// ---------- context ----------

interface Store {
  state: AppState;
  dispatch: (a: Action) => void;
  quarter: Quarter;
  saveStatus: SaveStatus;
  /** After a failed save, sends the whole current state to the server. */
  retrySave: () => void;
  /** Browsing without an account: nothing is saved to the server. */
  guest: boolean;
}

const Ctx = createContext<Store | null>(null);

/**
 * Holds the user's data, loaded from the server by <Session>, and saves each change back in order.
 * A guest's changes are kept in sessionStorage instead.
 */
export function StoreProvider({ initial, guest = false, children }: { initial: AppState; guest?: boolean; children: ReactNode }) {
  const [state, rawDispatch] = useReducer(reducer, initial);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const latest = useRef(state);
  const replaced = useRef(false);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0);
  const failure = useRef<'error' | 'signedOut' | null>(null);

  function enqueue(saves: Save[]) {
    if (!saves.length) return;
    pending.current++;
    setSaveStatus('saving');
    queue.current = queue.current
      .then(async () => {
        // After a failure, later edits wait for retrySave, which sends everything at once.
        if (failure.current) return;
        for (const save of saves) await save();
      })
      .catch((err) => {
        failure.current = err instanceof SignedOutError ? 'signedOut' : 'error';
      })
      .finally(() => {
        if (--pending.current === 0) setSaveStatus(failure.current ?? 'saved');
      });
  }

  function dispatch(a: Action) {
    if (a.type === 'replace') replaced.current = true;
    rawDispatch(a);
  }

  function retrySave() {
    failure.current = null;
    enqueue([() => api.replaceAll(latest.current)]);
  }

  useEffect(() => {
    const prev = latest.current;
    latest.current = state;
    if (prev === state) return;
    if (guest) return saveGuest(state);
    enqueue(replaced.current ? [() => api.replaceAll(state)] : changes(prev, state));
    replaced.current = false;
  }, [state, guest]);

  // Warn before closing the tab while changes are unsaved.
  useEffect(() => {
    if (saveStatus === 'saved') return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, [saveStatus]);

  const quarter = state.quarters.find((q) => q.id === state.activeQuarterId) ?? state.quarters[0];
  return <Ctx.Provider value={{ state, dispatch, quarter, saveStatus, retrySave, guest }}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside <StoreProvider>');
  return s;
}
