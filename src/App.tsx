import { useEffect, useState } from 'react';
import { useStore } from './store';
import { inQuarter, todayISO } from './lib/dates';
import { currentStreak } from './lib/calc';
import { DailyLog } from './components/DailyLog';
import { WeeklySummary } from './components/WeeklySummary';
import { SetupView } from './components/SetupView';
import { PlanView } from './components/PlanView';
import { SettingsView } from './components/SettingsView';

type Tab = 'log' | 'weeks' | 'plan' | 'setup' | 'settings';
const TABS: { id: Tab; label: string }[] = [
  { id: 'log', label: 'Daily log' },
  { id: 'weeks', label: 'Quarter' },
  { id: 'plan', label: 'Plan' },
  { id: 'setup', label: 'Edit' },
  { id: 'settings', label: 'Settings' },
];
const TAB_KEY = 'logbook:tab';
/** Set once a guest closes the sample-data note, for the rest of the tab's session. */
const GUEST_TIP_KEY = 'logbook:guest-tip';

function readGuestTipClosed(): boolean {
  try {
    return sessionStorage.getItem(GUEST_TIP_KEY) === 'closed';
  } catch {
    return false;
  }
}

function readTab(): Tab {
  try {
    const t = localStorage.getItem(TAB_KEY) as Tab | null;
    if (t && TABS.some((x) => x.id === t)) return t;
  } catch {
    /* ignore */
  }
  return 'log';
}

export default function App() {
  const { state, quarter, dispatch, saveStatus, retrySave, guest } = useStore();
  const [tab, setTab] = useState<Tab>(readTab);
  const [today, setToday] = useState(todayISO);
  const [selected, setSelected] = useState(() => (inQuarter(quarter, today) ? today : quarter.startDate));
  const [guestTipClosed, setGuestTipClosed] = useState(readGuestTipClosed);

  function closeGuestTip() {
    setGuestTipClosed(true);
    try {
      sessionStorage.setItem(GUEST_TIP_KEY, 'closed');
    } catch {
      /* ignore */
    }
  }

  // Keep "today" right if the app stays open past midnight.
  useEffect(() => {
    const id = setInterval(() => setToday(todayISO()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(TAB_KEY, tab);
    } catch {
      /* ignore */
    }
  }, [tab]);

  // When switching quarters, move the selected day into that quarter.
  useEffect(() => {
    if (!inQuarter(quarter, selected)) setSelected(inQuarter(quarter, today) ? today : quarter.startDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quarter.id]);

  // Selecting a day in another quarter (via the day arrows) follows it there.
  function selectDay(d: string) {
    setSelected(d);
    const q = state.quarters.find((x) => inQuarter(x, d));
    if (q && q.id !== quarter.id) dispatch({ type: 'setActive', quarterId: q.id });
  }

  const quarters = [...state.quarters].sort((a, b) => a.startDate.localeCompare(b.startDate));

  // The title goes home: the Daily log in the current quarter, or the latest one that has started.
  function goHome() {
    const home = quarters.find((q) => inQuarter(q, today)) ?? quarters.filter((q) => q.startDate <= today).at(-1) ?? quarters.at(-1);
    if (home && home.id !== quarter.id) dispatch({ type: 'setActive', quarterId: home.id });
    setTab('log');
  }

  const streak = inQuarter(quarter, today) ? currentStreak(quarter, today) : 0;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1>
            <button type="button" className="brand-btn" onClick={goHome}>
              Logbook
            </button>
          </h1>
          {streak > 1 && <span className="streak">{streak}-day streak</span>}
          {guest && (
            <span className="streak" title="Nothing is saved to an account. Data stays in this tab until you close it.">
              Guest
            </span>
          )}
          {saveStatus === 'saving' && <span className="save-status muted">Saving…</span>}
          {saveStatus === 'error' && (
            <span className="save-status is-error" role="alert">
              Not saved.{' '}
              <button type="button" className="link-btn" onClick={retrySave}>
                Retry
              </button>
            </span>
          )}
          {saveStatus === 'signedOut' && (
            <span className="save-status is-error" role="alert">
              Not saved: you’ve been signed out. Export a backup on Settings, then reload to sign in.
            </span>
          )}
        </div>
        <nav className="quarters" aria-label="Quarter">
          {quarters.map((q) => (
            <button
              key={q.id}
              type="button"
              className={`qbtn${q.id === quarter.id ? ' is-active' : ''}${inQuarter(q, today) ? ' is-now' : ''}`}
              aria-current={q.id === quarter.id ? 'true' : undefined}
              onClick={() => dispatch({ type: 'setActive', quarterId: q.id })}
            >
              <span className="qbtn-q">Q{q.quarter}</span>
              <span className="qbtn-y">{q.year}</span>
            </button>
          ))}
        </nav>
        <nav className="tabs" aria-label="View">
          {TABS.map((t) => (
            <button key={t.id} type="button" className={`tab${tab === t.id ? ' is-active' : ''}`} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className={`view view-${tab}`}>
        {guest && !guestTipClosed && quarter.categories.length > 0 && tab !== 'settings' && (
          <p className="notice getting-started" role="status">
            <strong>You’re trying Logbook as a guest.</strong> It’s filled with made-up sample data so you can see how it works, and
            nothing you change is saved to an account. To try it with your own categories, use{' '}
            <button type="button" className="link-btn" onClick={() => setTab('settings')}>
              Start over on the Settings tab
            </button>{' '}
            for an empty quarter.{' '}
            <button type="button" className="link-btn" onClick={closeGuestTip}>
              Got it
            </button>
          </p>
        )}
        {quarter.categories.length === 0 && (tab === 'log' || tab === 'weeks') && (
          <p className="notice getting-started" role="status">
            <strong>Welcome to Logbook.</strong> Start by adding the categories you want to track hours for, like Writing or Exercise.{' '}
            <button type="button" className="link-btn" onClick={() => setTab('setup')}>
              Add categories on the Edit tab
            </button>
            . Or try{' '}
            <button type="button" className="link-btn" onClick={() => setTab('settings')}>
              Load sample data on Settings tab
            </button>{' '}
            to see it filled in.
          </p>
        )}
        {(tab === 'log' || tab === 'weeks' || tab === 'plan') && (
          <h2 className="page-title">
            {TABS.find((t) => t.id === tab)?.label}{' '}
            <span className="count">
              Q{quarter.quarter} {quarter.year}
            </span>
          </h2>
        )}
        {tab === 'log' && <DailyLog today={today} selected={selected} onSelect={selectDay} />}
        {tab === 'weeks' && (
          <WeeklySummary
            today={today}
            onOpenDay={(d) => {
              selectDay(d);
              setTab('log');
            }}
          />
        )}
        {tab === 'plan' && <PlanView onEdit={() => setTab('setup')} />}
        {tab === 'setup' && <SetupView />}
        {tab === 'settings' && <SettingsView />}
      </main>
    </div>
  );
}
