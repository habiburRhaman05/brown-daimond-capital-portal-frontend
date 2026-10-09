import { beforeEach, describe, expect, it, vi } from 'vitest';

type SessionModule = typeof import('./session');

const make = (over: Record<string, unknown> = {}) => ({
  access_token: 'a.b.c',
  refresh_token: 'r1',
  expires_at: 2_000_000_000,
  user: { id: 'u1', email: 'a@b.co' },
  ...over,
});

// session.ts reads localStorage once at import, so each test imports a fresh copy.
async function load(): Promise<SessionModule> {
  vi.resetModules();
  return import('./session');
}

function b64url(obj: unknown) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const jwt = (claims: unknown) => `h.${b64url(claims)}.s`;

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('session store', () => {
  it('starts empty when nothing is stored', async () => {
    const s = await load();
    expect(s.getSession()).toBeNull();
  });

  it('restores a valid stored session on import', async () => {
    localStorage.setItem('bdcap-session-v1', JSON.stringify(make()));
    const s = await load();
    expect(s.getSession()?.user.email).toBe('a@b.co');
  });

  it.each([
    ['corrupt JSON', '{not json'],
    ['missing refresh token', JSON.stringify(make({ refresh_token: '' }))],
    ['missing access token', JSON.stringify(make({ access_token: '' }))],
    ['JSON null', 'null'],
  ])('ignores a stored session with %s', async (_label, raw) => {
    localStorage.setItem('bdcap-session-v1', raw);
    const s = await load();
    expect(s.getSession()).toBeNull();
  });

  it('setSession persists, updates memory and notifies subscribers', async () => {
    const s = await load();
    const fn = vi.fn();
    s.subscribe(fn);
    s.setSession(make());
    expect(fn).toHaveBeenCalledTimes(1);
    expect(s.getSession()?.access_token).toBe('a.b.c');
    expect(JSON.parse(localStorage.getItem('bdcap-session-v1')!).refresh_token).toBe('r1');
  });

  it('unsubscribe stops notifications', async () => {
    const s = await load();
    const fn = vi.fn();
    const off = s.subscribe(fn);
    off();
    s.setSession(make());
    expect(fn).not.toHaveBeenCalled();
  });

  it('clearSession removes storage and notifies', async () => {
    const s = await load();
    s.setSession(make());
    const fn = vi.fn();
    s.subscribe(fn);
    s.clearSession();
    expect(s.getSession()).toBeNull();
    expect(localStorage.getItem('bdcap-session-v1')).toBeNull();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('still works in memory when localStorage throws (private mode)', async () => {
    const s = await load();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('denied'); });
    expect(() => s.setSession(make())).not.toThrow();
    expect(s.getSession()).not.toBeNull();
    expect(() => s.clearSession()).not.toThrow();
    expect(s.getSession()).toBeNull();
  });

  it('clearPortalDraft removes only the draft keys', async () => {
    const s = await load();
    localStorage.setItem('bdcap-form-v1', 'x');
    localStorage.setItem('bdcap-draft-owner', 'y');
    localStorage.setItem('bdcap-sidebar', 'collapsed');
    s.clearPortalDraft();
    expect(localStorage.getItem('bdcap-form-v1')).toBeNull();
    expect(localStorage.getItem('bdcap-draft-owner')).toBeNull();
    expect(localStorage.getItem('bdcap-sidebar')).toBe('collapsed');
  });
});

describe('captureSessionFromUrl', () => {
  it('returns false when there is no hash', async () => {
    const s = await load();
    expect(s.captureSessionFromUrl()).toBe(false);
    expect(s.getSession()).toBeNull();
  });

  it('stores the session from the fragment, decodes the JWT user, and scrubs the URL', async () => {
    const s = await load();
    const token = jwt({ sub: 'user-9', email: 'z@z.co' });
    window.history.replaceState(null, '', `/set-password?x=1#access_token=${token}&refresh_token=rt&expires_in=120&type=invite`);
    expect(s.captureSessionFromUrl()).toBe(true);
    const got = s.getSession()!;
    expect(got.user).toEqual({ id: 'user-9', email: 'z@z.co' });
    expect(got.expires_in).toBe(120);
    expect(got.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000) + 100);
    expect(window.location.hash).toBe('');
    expect(window.location.search).toBe('?x=1');
    expect(sessionStorage.getItem('bdcap-fresh-verify')).toBeNull();
  });

  it('defaults expires_in to 3600 when missing or not a number', async () => {
    const s = await load();
    window.history.replaceState(null, '', `/#access_token=${jwt({ sub: 'u' })}&refresh_token=rt&expires_in=abc`);
    s.captureSessionFromUrl();
    expect(s.getSession()?.expires_in).toBe(3600);
  });

  it('flags a fresh email verification exactly once', async () => {
    const s = await load();
    window.history.replaceState(null, '', `/email-verified#access_token=${jwt({ sub: 'u' })}&refresh_token=rt&type=verify`);
    s.captureSessionFromUrl();
    expect(sessionStorage.getItem('bdcap-fresh-verify')).toBe('1');
  });

  it.each([
    ['only an access token', '#access_token=abc'],
    ['only a refresh token', '#refresh_token=abc'],
    ['unrelated fragment', '#section-2'],
  ])('rejects %s', async (_l, hash) => {
    const s = await load();
    window.history.replaceState(null, '', '/' + hash);
    expect(s.captureSessionFromUrl()).toBe(false);
    expect(s.getSession()).toBeNull();
  });

  it('redirects to the login page on an error fragment', async () => {
    const s = await load();
    window.history.replaceState(null, '', '/#error=access_denied&error_code=otp_expired');
    expect(s.captureSessionFromUrl()).toBe(false);
    expect(window.location.pathname + window.location.search).toBe('/client/login?verify=expired');
  });

  it('survives a malformed JWT by using an empty user', async () => {
    const s = await load();
    window.history.replaceState(null, '', '/#access_token=not-a-jwt&refresh_token=rt');
    expect(s.captureSessionFromUrl()).toBe(true);
    expect(s.getSession()?.user).toEqual({ id: '', email: '' });
  });

  it('handles non-ASCII names in the JWT payload', async () => {
    const s = await load();
    window.history.replaceState(null, '', `/#access_token=${jwt({ sub: 'u', email: 'jose@é.co' })}&refresh_token=rt`);
    s.captureSessionFromUrl();
    expect(s.getSession()?.user.email).toBe('jose@é.co');
  });
});
