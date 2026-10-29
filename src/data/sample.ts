// Made-up example data for "Load sample data" on Settings, so a new user can see the app filled in.
// Everything here is fictional; nothing comes from a real person's log.
import type { AppState, DayEntry, Quarter } from '../types';
import { blankQuarter } from '../store';
import { addDays, daysBetween, isoYearStart, quarterDays, quarterOf, todayISO } from '../lib/dates';
import { round2 } from '../lib/calc';

/** Small seeded random generator, so the sample looks the same every time it's loaded. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hours logged per category: the chance of logging on a given day, and a typical session length. */
const chance: Record<string, [number, number]> = { writing: [0.7, 1.5], piano: [0.45, 0.75], french: [0.5, 0.5], running: [0.4, 0.75] };

/** Log hours for the days of the quarter that have already passed. */
function fillDays(q: Quarter, today: string, seed: number) {
  const rand = rng(seed);
  const pastDays = Math.max(0, Math.min(daysBetween(q.startDate, today), quarterDays(q)));
  for (let i = 0; i < pastDays; i++) {
    const hours: Record<string, number> = {};
    for (const [id, [p, size]] of Object.entries(chance)) {
      if (rand() < p) hours[id] = round2(Math.ceil((size * (0.5 + rand())) * 4) / 4);
    }
    const entry: DayEntry = { goal: q.defaultDailyGoal, metrics: { sleep: 60 + Math.round(rand() * 35), water: 4 + Math.round(rand() * 4) } };
    if (Object.keys(hours).length) entry.hours = hours;
    q.days[addDays(q.startDate, i)] = entry;
  }
}

/** A quarter with the setup every sample quarter shares; the caller adds its projects and reading. */
function baseQuarter(date: string): Quarter {
  const q = blankQuarter(date);
  q.categories = [
    { id: 'writing', name: 'Writing', weeklyGoal: 6, note: 'Short stories, mornings before work' },
    { id: 'piano', name: 'Piano', weeklyGoal: 3 },
    { id: 'french', name: 'French', weeklyGoal: 2, note: 'App lessons plus one podcast a week' },
    { id: 'running', name: 'Exercise', weeklyGoal: 3 },
  ];
  q.metrics = [
    { id: 'sleep', name: 'Sleep score', min: 0, max: 100 },
    { id: 'water', name: 'Water (cups)', min: 0, max: null },
  ];
  q.yearGoals = [
    { title: 'Writing', items: ['Write synopsis', 'Write 50,000 words'], done: [] },
    { title: 'Health', items: ['Run a 10K', 'Sleep 7+ hours most nights'], done: [] },
  ];
  return q;
}

/** The earlier quarters of the year, already finished, so history and comparisons have something to show. */
function pastQuarters(today: string): Quarter[] {
  const { year, quarter } = quarterOf(today);
  const out: Quarter[] = [];

  if (quarter > 1) {
    const q = baseQuarter(isoYearStart(year));
    q.core = ['Build a daily writing habit', 'Run 5K without stopping'];
    q.projects = [
      { id: 's1-p1', text: 'Write a story a week for six weeks', done: true, group: 0, categoryId: 'writing' },
      { id: 's1-p2', text: 'Pick a method book and finish part one', done: true, group: 0, categoryId: 'piano' },
      { id: 's1-p3', text: 'Finish beginner French course', done: false, group: 0, categoryId: 'french' },
      { id: 's1-p4', text: 'Couch to 5K', done: true, group: 0, categoryId: 'running' },
    ];
    q.reading = [
      { id: 's1-r1', title: 'Bird by Bird', status: 'done', kind: 'nonfiction' },
      { id: 's1-r2', title: 'The Great Gatsby', status: 'done', kind: 'fiction' },
      { id: 's1-r3', title: 'Atomic Habits', status: 'reading', kind: 'nonfiction' },
    ];
    out.push(q);
  }

  if (quarter > 2) {
    const q = baseQuarter(addDays(isoYearStart(year), 91));
    q.core = ['Choose the story to expand', 'Run 5K under 30 minutes'];
    q.projects = [
      { id: 's2-p1', text: 'Outline “The Lighthouse Keeper”', done: true, group: 0, categoryId: 'writing' },
      { id: 's2-p2', text: 'Enter a short story contest', done: true, group: 0, categoryId: 'writing' },
      { id: 's2-p3', text: 'Learn first full song', done: true, group: 0, categoryId: 'piano' },
      { id: 's2-p4', text: 'Finish beginner French course', done: true, group: 0, categoryId: 'french' },
      { id: 's2-p5', text: 'Sub-30 5K', done: false, group: 0, categoryId: 'running' },
    ];
    q.reading = [
      { id: 's2-r1', title: 'Atomic Habits', status: 'done', kind: 'nonfiction' },
      { id: 's2-r2', title: 'Jane Eyre', status: 'done', kind: 'fiction' },
      { id: 's2-r3', title: 'On Writing', status: 'done', kind: 'nonfiction' },
    ];
    out.push(q);
  }

  if (quarter > 3) {
    const q = baseQuarter(addDays(isoYearStart(year), 182));
    q.core = ['Write synopsis', 'Run 5K under 30 minutes'];
    q.projects = [
      { id: 's3-p1', text: 'Write synopsis', done: true, group: 0, categoryId: 'writing' },
      { id: 's3-p2', text: 'Start the first draft', done: true, group: 0, categoryId: 'writing' },
      { id: 's3-p3', text: 'Learn second full song', done: true, group: 0, categoryId: 'piano' },
      { id: 's3-p4', text: 'Watch a French film without subtitles', done: false, group: 0, categoryId: 'french' },
      { id: 's3-p5', text: 'Sub-30 5K', done: true, group: 0, categoryId: 'running' },
    ];
    q.reading = [
      { id: 's3-r1', title: 'Frankenstein', status: 'done', kind: 'fiction' },
      { id: 's3-r2', title: 'The Elements of Style', status: 'done', kind: 'nonfiction' },
      { id: 's3-r3', title: 'Pride and Prejudice', status: 'reading', kind: 'fiction' },
    ];
    q.sections = [
      {
        id: 's3-habits',
        title: 'Habits',
        items: [
          { id: 's3-h1', text: 'Drink 8 cups of water a day', done: false },
          { id: 's3-h2', text: 'Stretch after every run', done: true },
        ],
      },
    ];
    out.push(q);
  }

  out.forEach((q, i) => fillDays(q, today, 101 + i));
  return out;
}

export function sampleState(): AppState {
  const today = todayISO();
  const q = baseQuarter(today);

  q.core = ['Finish the first draft', 'Run a 10K'];
  q.projects = [
    { id: 's-p1', text: 'Draft “The Lighthouse Keeper”', done: true, group: 0, categoryId: 'writing' },
    { id: 's-p2', text: 'Revise and submit one story', done: false, group: 0, categoryId: 'writing' },
    { id: 's-p3', text: 'Learn three full songs', done: false, group: 0, categoryId: 'piano' },
    { id: 's-p4', text: 'Hold a 10-minute conversation', done: false, group: 0, categoryId: 'french' },
    { id: 's-p5', text: 'Follow a 10K training plan', done: false, group: 0, categoryId: 'running' },
  ];
  q.reading = [
    { id: 's-r1', title: 'Pride and Prejudice', status: 'done', kind: 'fiction' },
    { id: 's-r2', title: 'The Old Man and the Sea', status: 'reading', kind: 'fiction' },
    { id: 's-r3', title: 'Meditations', note: 'A few pages each night', status: 'todo', kind: 'nonfiction' },
    { id: 's-r4', title: 'Walden', status: 'todo', kind: 'nonfiction' },
  ];
  q.sections = [
    {
      id: 's-habits',
      title: 'Habits',
      items: [
        { id: 's-h1', text: 'Drink 8 cups of water a day', done: true },
        { id: 's-h2', text: 'Meditate', done: false },
      ],
    },
  ];

  fillDays(q, today, 7);

  return {
    version: 1,
    quarters: [...pastQuarters(today), q],
    activeQuarterId: q.id,
    projectDetails: {
      's-p2': {
        description: 'Take one finished story through a full revision and send it out to at least three magazines.',
        tasks: [
          { id: 's-t1', text: 'Pick the story', done: true },
          { id: 's-t2', text: 'Second draft', done: true },
          { id: 's-t3', text: 'Get feedback from the writing group', done: false },
          { id: 's-t4', text: 'Final pass and submit', done: false },
        ],
        notes: [
          {
            id: 's-n1',
            date: q.startDate,
            text: 'Candidate: “The Lighthouse Keeper”.\n\n- Read it aloud before sending\n- Submission calls: www.example.com/calls',
          },
          { id: 's-n2', date: addDays(today, -2), text: 'Cut the opening scene and started at the storm. Reads much faster now.' },
        ],
      },
    },
  };
}
