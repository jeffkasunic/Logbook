// Calls to the Logbook API (API Gateway → lambda/index.mjs). Every call carries the signed-in user's access token.
import type { AppState, DayEntry, Quarter } from '../types';
import { getAccessToken, SignedOutError } from './auth';

const API_URL = 'https://qo7g5yee6f.execute-api.us-east-2.amazonaws.com';

async function call<T = void>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(API_URL + path, {
    method,
    headers: {
      Authorization: `Bearer ${await getAccessToken()}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401) throw new SignedOutError();
  if (!res.ok) throw new Error(`${method} ${path} failed (${res.status})`);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

const q = (quarterId: string) => `/quarters/${encodeURIComponent(quarterId)}`;

export const api = {
  /** Everything for the signed-in user, or null if they have nothing saved yet. */
  loadState: () => call<AppState | null>('GET', '/state'),
  putState: (activeQuarterId: string) => call('PUT', '/state', { activeQuarterId }),
  /** Days are saved one at a time with putDay, so they're left out here. */
  putQuarter: (quarter: Quarter) => call('PUT', q(quarter.id), { ...quarter, days: undefined }),
  deleteQuarter: (quarterId: string) => call('DELETE', q(quarterId)),
  putDay: (quarterId: string, date: string, day: DayEntry) => call('PUT', `${q(quarterId)}/days/${encodeURIComponent(date)}`, day),
  /** Replaces everything on the server with `state`. */
  replaceAll: (state: AppState) => call('POST', '/import', state),
};
