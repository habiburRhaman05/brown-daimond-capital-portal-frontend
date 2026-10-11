import { clearSession, getSession, hasSessionHint, setSession, takePendingGrant, type Session } from './session';
import { apiUrl } from './config';

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

// The refresh token is an HttpOnly cookie, so every call carries credentials: the browser attaches the
// cookie to /api/auth/* by itself and JavaScript never touches it. The app and the API must therefore be
// same-origin (the Vercel /api rewrite) or at least same-site (localhost in development).
const CREDENTIALS: RequestCredentials = 'include';

// Calls where a 401 means "wrong input", not "your session expired": retrying them through a refresh
// could quietly sign in whoever the old cookie belongs to.
const NO_REFRESH_RETRY = [
  '/api/auth/login', '/api/auth/signup', '/api/auth/forgot-password', '/api/auth/resend-verification',
  '/api/auth/exchange', '/api/auth/refresh', '/api/auth/logout',
];
const retriable = (path: string) => !NO_REFRESH_RETRY.some((p) => path.startsWith(p));

// One refresh in flight at a time; every waiting caller shares its result.
let refreshing: Promise<boolean> | null = null;

// Trades the refresh cookie for a new access token (and a rotated cookie). A definitive refusal ends the
// session; a network failure does not, so a blip never signs anyone out.
export function refreshSession(): Promise<boolean> {
  if (refreshing) return refreshing;

  refreshing = (async () => {
    try {
      const res = await fetch(apiUrl('/api/auth/refresh'), { method: 'POST', credentials: CREDENTIALS });
      if (res.ok) {
        setSession((await res.json()) as Session);
        return true;
      }
      if (res.status === 401) clearSession();
      return false;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();

  return refreshing;
}

// Trades the one-time grant from a verify / invite / reset link for a session.
async function exchangeGrant(grant: string): Promise<boolean> {
  try {
    const res = await fetch(apiUrl('/api/auth/exchange'), {
      method: 'POST',
      credentials: CREDENTIALS,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant }),
    });
    if (!res.ok) return false;
    setSession((await res.json()) as Session);
    return true;
  } catch {
    return false;
  }
}

// Runs once at startup: a grant from an emailed link wins, otherwise the cookie (if there ever was a
// session in this browser) brings the session back after a reload. Never rejects.
export async function restoreSession(): Promise<void> {
  try {
    const grant = takePendingGrant();
    if (grant) {
      await exchangeGrant(grant);
      return;
    }
    if (hasSessionHint()) await refreshSession();
  } catch {
    /* start signed out */
  }
}

function request(path: string, init: { method?: string; body?: unknown }, token?: string) {
  return fetch(apiUrl(path), {
    method: init.method ?? 'GET',
    credentials: CREDENTIALS,
    headers: {
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

// The backend decides who the user is. We attach the access token and refresh it when the server says
// the session expired, so callers never see a stale token.
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

  if (res.status === 401 && retriable(path) && (session || hasSessionHint())) {
    if (await refreshSession()) res = await request(path, init, getSession()?.access_token);
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

export async function apiUpload<T = unknown>(
  path: string,
  formData: FormData,
): Promise<T> {
  let session = getSession();
  if (nearExpiry(session)) {
    await refreshSession();
    session = getSession();
  }

  const doFetch = (token?: string) =>
    fetch(apiUrl(path), {
      method: 'POST',
      credentials: CREDENTIALS,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

  let res = await doFetch(session?.access_token);

  if (res.status === 401 && (session || hasSessionHint())) {
    if (await refreshSession()) res = await doFetch(getSession()?.access_token);
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
  INVALID_CREDENTIALS: 'Incorrect password. Please try again, or reset it if you forgot it.',
  ACCOUNT_NOT_FOUND: 'No account was found for that email address.',
  ACCOUNT_DISABLED: 'This account has been disabled. Please contact Brown Diamond.',
  EMAIL_EXISTS: 'An account with this email already exists.',
  AUTH_FAILED: 'Something went wrong. Please try again.',
  WEAK_PASSWORD: 'Use at least 8 characters.',
  WRONG_PASSWORD: 'Your current password is not correct.',
  SAME_PASSWORD: 'Choose a password you have not used just now.',
  INVALID_EMAIL: 'Enter a valid email address.',
  INVITE_PENDING: 'An invite is already waiting for that email.',
  ALREADY_REGISTERED: 'That person already has an account.',
  INVITE_EMAIL_FAILED: 'The invite email could not be sent. Try again in a minute.',
  ALREADY_DECIDED: 'That request was already decided.',
  NOT_LOCKED: 'The portal is not locked.',
  ALREADY_LOCKED: 'The portal is already locked.',
  CLIENT_NOT_FOUND: 'Client not found.',
  REQUEST_NOT_FOUND: 'Request not found.',
  NUMBER_REQUIRED: 'Please enter a client number.',
  NUMBER_NOT_FOUND: 'Client number not found.',
  STORAGE_NOT_CONFIGURED: 'Avatar upload is not available right now.',
  UPLOAD_FAILED: 'Could not upload the file. Please try again.',
  INVALID_FILE_TYPE: 'Only JPEG, PNG, WebP or GIF images are allowed.',
  FILE_TOO_LARGE: 'Maximum file size is 2 MB.',
  TOO_MANY_ATTEMPTS: 'Too many attempts. Wait a few minutes and try again.',
  NAME_REQUIRED: 'Please enter your full name.',
  SIGNUP_FAILED: 'We could not submit your request. Please try again.',
  REQUEST_FAILED: 'Something went wrong. Please try again.',
  SERVER_ERROR: 'The server had a problem. Please try again in a moment.',
};

const NETWORK_MESSAGE = 'Could not reach the server. Check your connection and try again.';

export function errorMessage(err: unknown): string {
  if (err instanceof TypeError) return NETWORK_MESSAGE; // fetch() rejects with TypeError when the request never completes
  if (err instanceof ApiError) return MESSAGES[err.code] ?? 'Something went wrong. Please try again.';
  return 'Something went wrong. Please try again.';
}
