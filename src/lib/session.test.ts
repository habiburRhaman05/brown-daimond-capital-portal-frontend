import { beforeEach, describe, expect, it, vi } from 'vitest';

type SessionModule = typeof import('./session');

const make = (over: Record<string, unknown> = {}) => ({
  access_token: 'secret-access-token',
  expires_at: 2_000_000_000,
  user: { id: 'u1', email: 'a@b.co' },
  ...over,
});

// session.ts keeps module-level state (the in-memory session, a pending grant), so each test imports a fresh copy.
async function load(): Promise<SessionModule> {
  vi.resetModules();
  return import('./session');
}

const allStorage = () => JSON.stringify({ ...localStorage, ...sessionStorage });

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('the session lives in memory only', () => {
  it('starts signed out', async () => {
    const s = await load();
    expect(s.getSession()).toBeNull();
    expect(s.hasSessionHint()).toBe(false);
  });

  it('never restores a session from storage, even one written by an older build', async () => {
    localStorage.setItem('bdcap-session-v1', JSON.stringify({ access_token: 'old', refresh_token: 'old-refresh', expires_at: 2_000_000_000, user: { id: 'u' } }));
    const s = await load();
    expect(s.getSession()).toBeNull();
  });

  it('wipes tokens and drafts that older builds left in localStorage', async () => {
    localStorage.setItem('bdcap-session-v1', '{"refresh_token":"old"}');
    localStorage.setItem('bdcap-form-v1', '{"fields":{"dateOfBirth":"1990-01-01"}}');
    localStorage.setItem('bdcap-draft-owner', 'u1');
    localStorage.setItem('bdcap-sidebar', 'collapsed');
    await load();
    expect(localStorage.getItem('bdcap-session-v1')).toBeNull();
    expect(localStorage.getItem('bdcap-form-v1')).toBeNull();
    expect(localStorage.getItem('bdcap-draft-owner')).toBeNull();
    expect(localStorage.getItem('bdcap-sidebar')).toBe('collapsed'); // unrelated preferences stay
  });

  it('keeps the token out of every storage area', async () => {
    const s = await load();
    s.setSession(make({ access_token: 'secret-access-token' }));
    expect(s.getSession()?.access_token).toBe('secret-access-token');
    expect(allStorage()).not.toContain('secret-access-token');
    expect(allStorage()).not.toMatch(/token/i);
  });

  it('leaves only the non-secret user-id hint behind', async () => {
    const s = await load();
    s.setSession(make());
    expect(localStorage.getItem('bdcap-uid')).toBe('u1');
    expect(s.hasSessionHint()).toBe(true);
    expect(Object.keys(localStorage)).toEqual(['bdcap-uid']);
  });

  it('does not write a hint for a session without a user id', async () => {
    const s = await load();
    s.setSession({ access_token: 'a', expires_at: 1 });
    expect(s.hasSessionHint()).toBe(false);
  });

  it('notifies subscribers on set and clear, and stops after unsubscribe', async () => {
    const s = await load();
    const fn = vi.fn();
    const off = s.subscribe(fn);
    s.setSession(make());
    s.clearSession();
    expect(fn).toHaveBeenCalledTimes(2);
    off();
    s.setSession(make());
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('clearSession forgets the session and the hint', async () => {
    const s = await load();
    s.setSession(make());
    s.clearSession();
    expect(s.getSession()).toBeNull();
    expect(s.hasSessionHint()).toBe(false);
    expect(localStorage.getItem('bdcap-uid')).toBeNull();
  });

  it('still works in memory when storage is blocked (private mode)', async () => {
    const s = await load();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('denied'); });
    expect(() => s.setSession(make())).not.toThrow();
    expect(s.getSession()).not.toBeNull();
    expect(s.hasSessionHint()).toBe(false);
    expect(() => s.clearSession()).not.toThrow();
    expect(s.getSession()).toBeNull();
  });
});

describe('clearPortalDraft', () => {
  it('removes the draft from both storage areas and nothing else', async () => {
    const s = await load();
    sessionStorage.setItem('bdcap-form-v1', 'x');
    sessionStorage.setItem('bdcap-draft-owner', 'u1');
    localStorage.setItem('bdcap-form-v1', 'x');
    localStorage.setItem('bdcap-sidebar', 'collapsed');
    s.clearPortalDraft();
    expect(sessionStorage.getItem('bdcap-form-v1')).toBeNull();
    expect(sessionStorage.getItem('bdcap-draft-owner')).toBeNull();
    expect(localStorage.getItem('bdcap-form-v1')).toBeNull();
    expect(localStorage.getItem('bdcap-sidebar')).toBe('collapsed');
  });
});

describe('captureGrantFromUrl', () => {
  it('does nothing without a fragment', async () => {
    const s = await load();
    s.captureGrantFromUrl();
    expect(s.takePendingGrant()).toBeNull();
  });

  it('takes the grant out of the address bar and keeps it for one exchange', async () => {
    const s = await load();
    window.history.replaceState(null, '', '/set-password?x=1#grant=one-time-grant&type=invite');
    s.captureGrantFromUrl();
    expect(window.location.hash).toBe('');
    expect(window.location.search).toBe('?x=1');
    expect(window.location.pathname).toBe('/set-password');
    expect(s.takePendingGrant()).toBe('one-time-grant');
    expect(s.takePendingGrant()).toBeNull(); // single use
  });

  it('never writes the grant to storage', async () => {
    const s = await load();
    window.history.replaceState(null, '', '/set-password#grant=one-time-grant&type=recovery');
    s.captureGrantFromUrl();
    expect(allStorage()).not.toContain('one-time-grant');
  });

  it('flags a fresh email verification exactly for verify links', async () => {
    const s = await load();
    window.history.replaceState(null, '', '/email-verified#grant=g&type=verify');
    s.captureGrantFromUrl();
    expect(sessionStorage.getItem('bdcap-fresh-verify')).toBe('1');
    sessionStorage.clear();
    window.history.replaceState(null, '', '/set-password#grant=g&type=invite');
    s.captureGrantFromUrl();
    expect(sessionStorage.getItem('bdcap-fresh-verify')).toBeNull();
  });

  it('ignores a fragment that carries no grant, including tokens in the old format', async () => {
    const s = await load();
    window.history.replaceState(null, '', '/#access_token=abc&refresh_token=def&expires_in=3600');
    s.captureGrantFromUrl();
    expect(s.takePendingGrant()).toBeNull();
    expect(s.getSession()).toBeNull();
    expect(allStorage()).not.toContain('abc');
  });

  it('ignores unrelated fragments such as in-page anchors', async () => {
    const s = await load();
    window.history.replaceState(null, '', '/#section-2');
    s.captureGrantFromUrl();
    expect(s.takePendingGrant()).toBeNull();
    expect(window.location.hash).toBe('#section-2');
  });

  it('sends the user to the login page on an error fragment', async () => {
    const s = await load();
    window.history.replaceState(null, '', '/#error=access_denied&error_code=otp_expired');
    s.captureGrantFromUrl();
    expect(window.location.pathname + window.location.search).toBe('/client/login?verify=expired');
    expect(s.takePendingGrant()).toBeNull();
  });
});
