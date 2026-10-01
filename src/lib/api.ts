import { clearSession, getSession, setSession, type Session } from './session';

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

const nearExpiry = (s: Session | null) =>
  !!s && !!s.expires_at && s.expires_at * 1000 - Date.now() < 60_000;

// One refresh in flight at a time; every waiting caller shares its result.
let refreshing: Promise<boolean> | null = null;

export function refreshSession(): Promise<boolean> {
  const s = getSession();
  if (!s?.refresh_token) return Promise.resolve(false);
  if (refreshing) return refreshing;

  refreshing = (async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: s.refresh_token }),
      });
      if (!res.ok) return false;
      const next = (await res.json()) as Omit<Session, 'user'>;
      setSession({
        ...s,
        access_token: next.access_token,
        refresh_token: next.refresh_token,
        expires_at: next.expires_at,
        expires_in: next.expires_in,
      });
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();

  return refreshing;
}

function request(path: string, init: { method?: string; body?: unknown }, token?: string) {
  return fetch(`http://localhost:3000${path}`, {
    method: init.method ?? 'GET',
    headers: {
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

// The backend decides who the user is. We attach the session token and refresh it when the
// server says the session expired, so callers never see a stale token.
export async function api<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  let session = getSession();
  if (nearExpiry(session)) {
    await refreshSession();
    session = getSession();
  }

  let res = await request(path, init, session?.access_token);

  if (res.status === 401 && session?.refresh_token) {
    if (await refreshSession()) {
      res = await request(path, init, getSession()?.access_token);
    } else {
      clearSession();
    }
  }

  let payload: { error?: string } & Record<string, unknown> = {};
  try {
    payload = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) throw new ApiError(res.status, payload.error ?? 'REQUEST_FAILED');
  return payload as T;
}

const MESSAGES: Record<string, string> = {
  NOT_INVITED: 'This account is not set up yet. Please contact Brown Diamond.',
  EMAIL_NOT_VERIFIED: 'Please verify your email first. Check your inbox for the verification link.',
  NOT_SIGNED_IN: 'Please sign in again.',
  SESSION_EXPIRED: 'Your session expired. Please sign in again.',
  FORBIDDEN: 'You do not have access to that.',
  INVALID_CREDENTIALS: 'Invalid email or password.',
  AUTH_FAILED: 'Something went wrong. Please try again.',
  WEAK_PASSWORD: 'Use at least 8 characters.',
  INVALID_EMAIL: 'Enter a valid email address.',
  INVITE_PENDING: 'An invite is already waiting for that email.',
  ALREADY_REGISTERED: 'That person already has an account.',
  INVITE_EMAIL_FAILED: 'The invite email could not be sent. Try again in a minute.',
  ALREADY_DECIDED: 'That request was already decided.',
  NOT_LOCKED: 'The portal is not locked.',
  ALREADY_LOCKED: 'The portal is already locked.',
  CLIENT_NOT_FOUND: 'Client not found.',
  REQUEST_NOT_FOUND: 'Request not found.',
  TOO_MANY_ATTEMPTS: 'Too many attempts. Wait a few minutes and try again.',
  NAME_REQUIRED: 'Please enter your full name.',
  SIGNUP_FAILED: 'We could not submit your request. Please try again.',
  REQUEST_FAILED: 'Something went wrong. Please try again.',
};

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return MESSAGES[err.code] ?? 'Something went wrong. Please try again.';
  return 'Something went wrong. Please try again.';
}
