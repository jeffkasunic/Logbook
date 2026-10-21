import { useRef, useState } from 'react';
import { blankState, isValidState, saveGuest, useStore } from '../store';
import { sampleState } from '../data/sample';
import { shortDate, addDays, quarterDays } from '../lib/dates';
import { signIn, signOut, userEmail } from '../lib/auth';
import { NumCell } from './NumCell';

/** Quarters, data backup (export, import and restore) and the signed-in account. */
export function SettingsView() {
  const { state, quarter: q, dispatch, saveStatus, guest } = useStore();
  const email = userEmail();
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function exportJSON() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `logbook-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg('Exported a backup file.');
  }

  async function importJSON(file: File) {
    try {
      const parsed = JSON.parse(await file.text());
      if (!isValidState(parsed)) throw new Error('shape');
      dispatch({ type: 'replace', state: parsed });
      setMsg(`Imported ${parsed.quarters.length} quarters from ${file.name}.`);
    } catch {
      setMsg(`${file.name} isn’t a backup from this app. Choose a .json file made with “Export backup”.`);
    }
  }

  return (
    <div className="setup">
      <section className="panel">
        <h2>Quarters</h2>
        <label className="field field-inline">
          <span>Default daily goal for {q.id.replace('-', ' ')}</span>
          <NumCell
            kind="number"
            value={q.defaultDailyGoal}
            format={(v) => (v == null ? '' : String(v))}
            label="Default daily goal in hours"
            min={0}
            max={24}
            allowEmpty={false}
            onCommit={(v) => v != null && dispatch({ type: 'updateQuarter', quarterId: q.id, patch: { defaultDailyGoal: v } })}
          />
          <span>hours per day</span>
        </label>
        <ul className="quarter-list">
          {state.quarters.map((x) => (
            <li key={x.id}>
              <strong>{x.id.replace('-', ' ')}</strong>
              <span className="muted">
                {shortDate(x.startDate)} – {shortDate(addDays(x.startDate, quarterDays(x) - 1))}, {x.categories.length} categories
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={state.quarters.length <= 1}
                onClick={() => confirm(`Delete ${x.id} and everything logged in it? This can’t be undone.`) && dispatch({ type: 'deleteQuarter', quarterId: x.id })}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn" onClick={() => dispatch({ type: 'addQuarter' })}>
          Start next quarter
        </button>
        <p className="hint">The next quarter copies the latest quarter’s categories, goals, focus and unread books, with an empty log.</p>
      </section>

      <section className="panel">
        <h2>Your data</h2>
        <p className="muted">
          {guest
            ? 'You’re trying Logbook as a guest, so everything stays in this browser tab and is gone when you close it. Export a backup to keep a copy.'
            : `Everything is saved to your account${email ? ` (${email})` : ''}, so it’s the same on every device you sign in on. Export a backup to keep a copy of your own.`}
        </p>
        <div className="btn-row">
          <button type="button" className="btn btn-primary" onClick={exportJSON}>
            Export backup
          </button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            Import backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importJSON(f);
              e.target.value = '';
            }}
          />
        </div>
        <h3 className="settings-sub">Try it out or start over</h3>
        <p className="muted">Both replace everything {guest ? 'in this guest session' : 'saved in your account'}. Export a backup first if you want to keep it.</p>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() =>
              confirm('Replace everything with made-up sample data? What you’ve entered will be lost unless you’ve exported a backup.') &&
              (dispatch({ type: 'replace', state: sampleState() }), setMsg('Loaded sample data. Use “Start over” to clear it.'))
            }
          >
            Load sample data
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() =>
              confirm('Erase everything and start with an empty quarter? This can’t be undone unless you’ve exported a backup.') &&
              (dispatch({ type: 'replace', state: blankState() }), setMsg('Started over with an empty quarter.'))
            }
          >
            Start over
          </button>
        </div>
        {msg && (
          <p className="notice" role="status">
            {msg}
          </p>
        )}
      </section>

      <section className="panel">
        <h2>Account</h2>
        {guest ? (
          <>
            <p className="muted">You’re browsing as a guest. Signing in ends the guest session and its data.</p>
            <button
              type="button"
              className="btn"
              onClick={() => confirm('Sign in and leave the guest session? Its data will be gone unless you’ve exported a backup.') && (saveGuest(null), signIn())}
            >
              Sign in
            </button>
          </>
        ) : (
          <>
            {email && <p className="muted">Signed in as {email}.</p>}
            <button type="button" className="btn" disabled={saveStatus !== 'saved'} onClick={signOut}>
              Sign out
            </button>
            {saveStatus !== 'saved' && <p className="hint">Available once your latest changes are saved.</p>}
          </>
        )}
      </section>
    </div>
  );
}
