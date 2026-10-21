import { useEffect, useState } from 'react';
import type { AppState } from './types';
import { blankState, GUEST_KEY, isValidState, LOCAL_STORAGE_KEY, saveGuest, StoreProvider } from './store';
import { api } from './lib/api';
import { completeSignIn, isSignedIn, signIn, SignedOutError } from './lib/auth';
import { sampleState } from './data/sample';
import App from './App';

type Phase =
  | { kind: 'loading' }
  | { kind: 'signedOut' }
  | { kind: 'ready'; state: AppState; guest?: boolean }
  | { kind: 'error'; message: string };

/** The guest data for this tab, if a guest session is running. */
function guestData(): AppState | null {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(GUEST_KEY) ?? 'null');
    return isValidState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Data saved in this browser before accounts existed, if the user wants it copied into their account. */
function localData(): AppState | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) ?? 'null');
    if (!isValidState(parsed)) return null;
    if (!confirm('Found Logbook data saved in this browser from before sign-in. Copy it into your account?')) return null;
    // Drop fields the app no longer uses, like the old timer.
    return { version: 1, quarters: parsed.quarters, activeQuarterId: parsed.activeQuarterId ?? parsed.quarters.at(-1)!.id };
  } catch {
    return null;
  }
}

/** Finishes a sign-in redirect, then loads the user's data, creating it for a new account. */
async function start(): Promise<AppState | null> {
  await completeSignIn();
  if (!isSignedIn()) return null;
  const saved = await api.loadState();
  if (saved) return saved;
  const first = localData() ?? blankState();
  await api.replaceAll(first);
  return first;
}

// Run once per page load, even when StrictMode mounts twice: a sign-in code can only be used once.
let starting: Promise<AppState | null> | null = null;

/** Signs the user in and loads their data before showing the app. */
export function Session() {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });

  useEffect(() => {
    (starting ??= start()).then(
      (state) => {
        if (state) return setPhase({ kind: 'ready', state });
        const guest = guestData();
        setPhase(guest ? { kind: 'ready', state: guest, guest: true } : { kind: 'signedOut' });
      },
      (err) =>
        setPhase(
          err instanceof SignedOutError
            ? { kind: 'signedOut' }
            : { kind: 'error', message: err instanceof Error ? err.message : String(err) },
        ),
    );
  }, []);

  if (phase.kind === 'ready') {
    return (
      <StoreProvider initial={phase.state} guest={phase.guest}>
        <App />
      </StoreProvider>
    );
  }

  return (
    <main className="session">
      <div className="panel session-panel">
        <h1>Logbook</h1>
        {phase.kind === 'loading' && <p className="muted">Loading…</p>}
        {phase.kind === 'signedOut' && (
          <>
            <p className="muted">Sign in to see your log. Your data is saved to your account and private to you.</p>
            <div className="btn-row">
              <button type="button" className="btn btn-primary" onClick={() => signIn()}>
                Sign in
              </button>
              <button type="button" className="btn" onClick={() => {
                  const state = sampleState();
                  saveGuest(state);
                  setPhase({ kind: 'ready', state, guest: true });
                }}>
                Try it as a guest
              </button>
            </div>
            <p className="hint">Guests start with sample data. Nothing is saved to an account, and it’s gone when you close the tab.</p>
          </>
        )}
        {phase.kind === 'error' && (
          <>
            <p>Couldn’t load your data: {phase.message}</p>
            <button type="button" className="btn btn-primary" onClick={() => location.reload()}>
              Try again
            </button>
          </>
        )}
      </div>
    </main>
  );
}
