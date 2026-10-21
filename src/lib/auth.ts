// Sign-in with Cognito's hosted page: authorization code flow with PKCE, no client secret.

const DOMAIN = 'https://us-east-2tlkjmeqru.auth.us-east-2.amazoncognito.com';
const CLIENT_ID = '48kqq2m1iepqci1eg6p8mn7us8';
/** The app's folder, e.g. https://jeffkasunic.com/logbook/ or http://localhost:5173/. Must be a Cognito callback URL. */
const APP_URL = new URL('./', location.href).href;

const TOKENS_KEY = 'logbook:auth';
const PKCE_KEY = 'logbook:pkce';

interface Tokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  /** epoch ms */
  expiresAt: number;
}

export class SignedOutError extends Error {
  constructor() {
    super('signed out');
  }
}

function readTokens(): Tokens | null {
  try {
    return JSON.parse(localStorage.getItem(TOKENS_KEY) ?? 'null');
  } catch {
    return null;
  }
}

function saveTokens(t: Tokens | null) {
  try {
    if (t) localStorage.setItem(TOKENS_KEY, JSON.stringify(t));
    else localStorage.removeItem(TOKENS_KEY);
  } catch {
    /* storage blocked: stays signed in until the page closes */
  }
  tokens = t;
}

let tokens = readTokens();

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const randomString = () => base64url(crypto.getRandomValues(new Uint8Array(32)));

async function tokenRequest(params: Record<string, string>) {
  const res = await fetch(`${DOMAIN}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, ...params }),
  });
  // Cognito answers 400 when a code or refresh token is no longer valid.
  if (res.status === 400) throw new SignedOutError();
  if (!res.ok) throw new Error(`token request failed (${res.status})`);
  return (await res.json()) as { access_token: string; id_token: string; refresh_token?: string; expires_in: number };
}

/** Sends the browser to Cognito's sign-in page; it comes back to APP_URL with ?code=…&state=…. */
export async function signIn() {
  const verifier = randomString();
  const state = randomString();
  sessionStorage.setItem(PKCE_KEY, JSON.stringify({ verifier, state }));
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  const url = new URL(`${DOMAIN}/oauth2/authorize`);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: APP_URL,
    scope: 'openid email',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString();
  location.assign(url.href);
}

export function signOut() {
  saveTokens(null);
  location.assign(`${DOMAIN}/logout?${new URLSearchParams({ client_id: CLIENT_ID, logout_uri: APP_URL })}`);
}

/** If the page was opened by Cognito's redirect, trades the code for tokens and tidies the URL. */
export async function completeSignIn() {
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  const error = params.get('error_description') ?? params.get('error');
  if (!code && !error) return;
  history.replaceState(null, '', APP_URL);
  if (error) throw new Error(error);

  const saved = JSON.parse(sessionStorage.getItem(PKCE_KEY) ?? 'null') as { verifier: string; state: string } | null;
  sessionStorage.removeItem(PKCE_KEY);
  if (!saved || saved.state !== params.get('state')) throw new Error('Sign-in didn’t match this browser tab. Please try again.');

  const t = await tokenRequest({ grant_type: 'authorization_code', code: code!, redirect_uri: APP_URL, code_verifier: saved.verifier });
  saveTokens({ accessToken: t.access_token, idToken: t.id_token, refreshToken: t.refresh_token!, expiresAt: Date.now() + t.expires_in * 1000 });
}

export const isSignedIn = () => tokens != null;

let refreshing: Promise<Tokens | null> | null = null;

/**
 * A current access token, refreshed when it's within a minute of expiring. Throws SignedOutError once the
 * refresh token itself has expired; a network failure throws without signing out.
 */
export async function getAccessToken(): Promise<string> {
  if (!tokens) throw new SignedOutError();
  if (tokens.expiresAt - 60_000 > Date.now()) return tokens.accessToken;
  const current = tokens;
  refreshing ??= tokenRequest({ grant_type: 'refresh_token', refresh_token: current.refreshToken })
    .then((t) => ({ ...current, accessToken: t.access_token, idToken: t.id_token, expiresAt: Date.now() + t.expires_in * 1000 }))
    .catch((err) => {
      if (err instanceof SignedOutError) return null;
      throw err;
    })
    .finally(() => (refreshing = null));
  const next = await refreshing;
  saveTokens(next);
  if (!next) throw new SignedOutError();
  return next.accessToken;
}

/** The signed-in user's email, read from the ID token. */
export function userEmail(): string | null {
  if (!tokens) return null;
  try {
    const payload = tokens.idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return (JSON.parse(atob(payload)) as { email?: string }).email ?? null;
  } catch {
    return null;
  }
}
