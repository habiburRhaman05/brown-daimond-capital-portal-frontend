import type { Role } from './types';

// The browser never talks to Supabase. The backend mints the session at /api/auth/login
// (and /api/auth/refresh) and this store keeps it. The static portal page
// (public/portal/index.html) reads the same key, so signing in here signs the portal in too.
export const SESSION_KEY = 'bdcap-session-v1';
const DRAFT_KEYS = ['bdcap-form-v1', 'bdcap-draft-owner'];

export interface SessionUser {
  id: string;
  email: string;
  role?: Role;
  fullName?: string;
  avatarUrl?: string;
  phone?: string;
}

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix seconds
  expires_in?: number;
  user: SessionUser;
}

function read(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    return s && s.access_token && s.refresh_token ? s : null;
  } catch {
    return null;
  }
}

let current: Session | null = read();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

export function getSession(): Session | null {
  return current;
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setSession(session: Session): void {
  current = session;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* storage unavailable */
  }
  emit();
}

export function clearSession(): void {
  current = null;
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage unavailable */
  }
  emit();
}

// Drafts the portal page keeps in this browser belong to whoever was signed in.
export function clearPortalDraft(): void {
  try {
    DRAFT_KEYS.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* storage unavailable */
  }
}

function decodeJwtUser(token: string): SessionUser | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const claims = JSON.parse(decodeURIComponent(escape(json))) as { sub?: string; email?: string };
    if (!claims.sub && !claims.email) return null;
    return { id: claims.sub ?? '', email: claims.email ?? '' };
  } catch {
    return null;
  }
}

// Invite, password-reset and email-verification links all land with the tokens in the URL
// fragment and are picked up here, once, at app bootstrap.
export function captureSessionFromUrl(): boolean {
  const raw = window.location.hash.replace(/^#/, '');
  if (!raw) return false;
  const params = new URLSearchParams(raw);

  if (params.get('error') || params.get('error_code')) {
    history.replaceState(null, '', '/client/login?verify=expired');
    return false;
  }

  const access = params.get('access_token');
  const refresh = params.get('refresh_token');
  if (!access || !refresh) return false;

  const expiresIn = Number(params.get('expires_in')) || 3600;
  const user = decodeJwtUser(access);
  setSession({
    access_token: access,
    refresh_token: refresh,
    expires_in: expiresIn,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    user: user ?? { id: '', email: '' },
  });

  // A fresh email-verification grant is good for this one page load only: EmailVerified
  // reads (and clears) this flag to decide whether to offer the "go to my profile"
  // shortcut. A later refresh or replay of the same link never sets it again, so the
  // shortcut cannot be resurrected by anyone who gets hold of a stale copy of the link.
  if (params.get('type') === 'verify') {
    try { sessionStorage.setItem('bdcap-fresh-verify', '1'); } catch { /* storage unavailable */ }
  }

  // Drop the tokens from the address bar so a refresh or a screenshot does not leak them.
  history.replaceState(null, '', window.location.pathname + window.location.search);
  return true;
}
