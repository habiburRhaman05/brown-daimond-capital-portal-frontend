import type { Role } from './types';

// Where the session lives:
//  - the refresh token is an HttpOnly cookie the browser manages; JavaScript can never read it;
//  - the short-lived access token is kept here, in memory only, and is restored after a reload
//    from the cookie (see restoreSession in api.ts);
//  - the only thing written to localStorage is a non-secret hint, the user id, so a visitor who was
//    never signed in does not trigger a pointless refresh call and the static portal page can tell
//    whether to bother. It grants nothing.
export const UID_KEY = 'bdcap-uid';
const LEGACY_KEYS = ['bdcap-session-v1']; // older builds kept the tokens themselves in localStorage
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
  expires_at: number; // unix seconds
  expires_in?: number;
  user?: SessionUser;
}

function purgeLegacyStorage() {
  try {
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
    // The portal page now keeps its draft per tab (sessionStorage); drop copies older builds left behind.
    DRAFT_KEYS.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* storage unavailable */
  }
}
purgeLegacyStorage();

let current: Session | null = null;
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

export function hasSessionHint(): boolean {
  try {
    return !!localStorage.getItem(UID_KEY);
  } catch {
    return false;
  }
}

export function setSession(session: Session): void {
  current = session;
  try {
    if (session.user?.id) localStorage.setItem(UID_KEY, session.user.id);
  } catch {
    /* storage unavailable */
  }
  emit();
}

export function clearSession(): void {
  current = null;
  try {
    localStorage.removeItem(UID_KEY);
  } catch {
    /* storage unavailable */
  }
  purgeLegacyStorage();
  emit();
}

// Drafts the portal page keeps in this browser belong to whoever was signed in.
export function clearPortalDraft(): void {
  try {
    DRAFT_KEYS.forEach((k) => {
      sessionStorage.removeItem(k);
      localStorage.removeItem(k);
    });
  } catch {
    /* storage unavailable */
  }
}

// Verify, invite and password-reset links land with a one-time sign-in grant in the URL fragment.
// It is taken out of the address bar immediately and traded for a real session (restoreSession).
let pendingGrant: string | null = null;

export function captureGrantFromUrl(): void {
  const raw = window.location.hash.replace(/^#/, '');
  if (!raw) return;
  const params = new URLSearchParams(raw);

  if (params.get('error') || params.get('error_code')) {
    history.replaceState(null, '', '/client/login?verify=expired');
    return;
  }

  const grant = params.get('grant');
  if (!grant) return;
  pendingGrant = grant;

  // A fresh email-verification grant is good for this one page load only: EmailVerified
  // reads (and clears) this flag to decide whether to offer the "go to my profile"
  // shortcut. A later refresh or replay of the same link never sets it again, so the
  // shortcut cannot be resurrected by anyone who gets hold of a stale copy of the link.
  if (params.get('type') === 'verify') {
    try { sessionStorage.setItem('bdcap-fresh-verify', '1'); } catch { /* storage unavailable */ }
  }

  // Drop the grant from the address bar so a refresh, a screenshot or the history never holds it.
  history.replaceState(null, '', window.location.pathname + window.location.search);
}

export function takePendingGrant(): string | null {
  const g = pendingGrant;
  pendingGrant = null;
  return g;
}
