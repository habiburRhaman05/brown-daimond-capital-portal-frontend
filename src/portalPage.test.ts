// public/portal/index.html is a static page, separate from the React app. Its two injected scripts handle
// the session (refresh cookie + in-memory token) and the form draft. These tests run those exact scripts.
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const html = fs.readFileSync(path.resolve(process.cwd(), 'public/portal/index.html'), 'utf8');

function scriptContaining(marker: string): string {
  const at = html.indexOf(marker);
  if (at < 0) throw new Error(`marker not found: ${marker}`);
  return html.slice(html.lastIndexOf('<script>', at) + '<script>'.length, html.indexOf('</script>', at));
}
const HEAD = scriptContaining('Injected at the end of <head>');
const BOTTOM = scriptContaining('Injected before the LAST </body>');

const run = (code: string) => new Function(code)();
const nowSec = () => Math.floor(Date.now() / 1000);
const json = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('static guards on the page source', () => {
  it('no longer knows the old token storage key or a refresh token in the browser', () => {
    expect(html).not.toContain('bdcap-session-v1');
    expect(html).not.toContain('refresh_token');
    expect(html).not.toContain('sessionEntry');
  });

  it('only ever puts the non-secret hint and the API base in localStorage', () => {
    const args = [...html.matchAll(/localStorage\.(?:getItem|setItem|removeItem)\(\s*([^,)]+)/g)].map((m) => m[1].trim());
    expect(args.length).toBeGreaterThan(0);
    for (const a of args) expect(['UID', "'bdcap-api-base'"]).toContain(a);
  });

  it('keeps the form draft (dates of birth, addresses) out of localStorage', () => {
    expect(html).not.toMatch(/localStorage\.\w+\(\s*(?:STORE|OWNER|'bdcap-form-v1'|'bdcap-draft-owner')/);
    expect(html).toMatch(/sessionStorage\.setItem\(STORE/);
  });

  it('talks to the refresh endpoint with the cookie, and sends credentials on API calls', () => {
    expect(BOTTOM).toMatch(/fetch\(url\('\/api\/auth\/refresh'\), \{ method: 'POST', credentials: 'include' \}\)/);
    expect(BOTTOM).toMatch(/headers: h, credentials: 'include'/);
  });
});

describe('head gate', () => {
  let replace: ReturnType<typeof vi.fn>;
  const setLocation = (search = '') => {
    replace = vi.fn();
    vi.stubGlobal('location', { pathname: '/portal/index.html', search, replace });
  };
  const w = window as unknown as { __BDCAP?: Record<string, unknown> };

  beforeEach(() => {
    delete w.__BDCAP;
    document.head.innerHTML = '';
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sends a visitor with no sign-in hint to the login page, remembering where they were going', () => {
    setLocation('?x=1');
    run(HEAD);
    expect(replace).toHaveBeenCalledWith('/login?next=' + encodeURIComponent('/portal/index.html?x=1'));
  });

  it('does not consult any token storage: a leftover old-style session does not count as signed in', () => {
    localStorage.setItem('bdcap-session-v1', JSON.stringify({ access_token: 'old', refresh_token: 'old' }));
    setLocation();
    run(HEAD);
    expect(replace).toHaveBeenCalled();
  });

  it('lets a signed-in user through and claims the draft for them', () => {
    localStorage.setItem('bdcap-uid', 'u1');
    setLocation();
    run(HEAD);
    expect(replace).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('bdcap-draft-owner')).toBe('u1');
  });

  it("drops another user's draft left in this tab, but keeps the user's own", () => {
    localStorage.setItem('bdcap-uid', 'u2');
    sessionStorage.setItem('bdcap-draft-owner', 'u1');
    sessionStorage.setItem('bdcap-form-v1', '{"fields":{"dateOfBirth":"1990-01-01"}}');
    setLocation();
    run(HEAD);
    expect(sessionStorage.getItem('bdcap-form-v1')).toBeNull();
    expect(sessionStorage.getItem('bdcap-draft-owner')).toBe('u2');

    sessionStorage.setItem('bdcap-form-v1', 'mine');
    run(HEAD);
    expect(sessionStorage.getItem('bdcap-form-v1')).toBe('mine');
  });

  it('never keeps a draft while an admin views a client', () => {
    localStorage.setItem('bdcap-uid', 'admin1');
    sessionStorage.setItem('bdcap-form-v1', 'something');
    setLocation('?viewAs=client-7');
    run(HEAD);
    expect(sessionStorage.getItem('bdcap-form-v1')).toBeNull();
    expect(w.__BDCAP).toMatchObject({ viewAs: 'client-7', backUrl: '/admin/clients/client-7' });
  });

  it('uses the API base the app recorded, and only a well-formed one', () => {
    localStorage.setItem('bdcap-uid', 'u1');
    localStorage.setItem('bdcap-api-base', 'http://localhost:8000/');
    setLocation();
    run(HEAD);
    expect(w.__BDCAP?.apiBase).toBe('http://localhost:8000');
    localStorage.setItem('bdcap-api-base', 'javascript:alert(1)');
    run(HEAD);
    expect(w.__BDCAP?.apiBase).toBe('');
  });
});

describe('session handling script (before </body>)', () => {
  let replace: ReturnType<typeof vi.fn>;
  let fetchMock: ReturnType<typeof vi.fn>;
  let accessN: number;
  const everyStorage = () => JSON.stringify({ ...localStorage, ...sessionStorage });
  const w = window as unknown as { __BDCAP?: Record<string, unknown> };

  function boot(opts: { hint?: boolean; viewAs?: string; apiBase?: string } = {}) {
    if (opts.hint !== false) localStorage.setItem('bdcap-uid', 'u1');
    w.__BDCAP = { viewAs: opts.viewAs, apiBase: opts.apiBase ?? '', loginUrl: '/login', backUrl: '/dashboard' };
    run(BOTTOM);
  }
  const paths = () => fetchMock.mock.calls.map(([u]) => u as string);

  beforeEach(() => {
    document.body.innerHTML = '';
    accessN = 0;
    replace = vi.fn();
    vi.stubGlobal('location', { pathname: '/portal/index.html', search: '', replace });
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    // default server: refresh hands out tok1, tok2, ...; everything else succeeds
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith('/api/auth/refresh')) {
        accessN += 1;
        return Promise.resolve(json(200, { access_token: `tok${accessN}`, expires_at: nowSec() + 900, user: { id: 'u1', email: 'client@example.com' } }));
      }
      if (url.endsWith('/api/portal/prefill')) return Promise.resolve(json(200, { fields: { bizNameInput: 'Acme' }, sel: {}, status: {} }));
      return Promise.resolve(json(200, {}));
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('does nothing for a signed-out visitor (the head gate is already redirecting)', () => {
    boot({ hint: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('restores the session from the cookie first: POST /refresh with credentials, no body, no token', async () => {
    boot();
    await vi.waitFor(() => expect(paths()).toContain('/api/portal/prefill'));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/refresh');
    expect(init).toEqual({ method: 'POST', credentials: 'include' });
  });

  it('then calls the API with the in-memory token and the cookie', async () => {
    boot();
    await vi.waitFor(() => expect(paths()).toContain('/api/portal/prefill'));
    const call = fetchMock.mock.calls.find(([u]) => u === '/api/portal/prefill')!;
    expect(call[1].headers.Authorization).toBe('Bearer tok1');
    expect(call[1].credentials).toBe('include');
  });

  it('shares a single refresh between the top bar and the first API call', async () => {
    boot();
    await vi.waitFor(() => expect(paths()).toContain('/api/portal/prefill'));
    expect(paths().filter((p) => p === '/api/auth/refresh')).toHaveLength(1);
  });

  it('shows who is signed in once the session is restored', async () => {
    boot();
    await vi.waitFor(() => expect(document.body.textContent).toContain('client@example.com'));
  });

  it('keeps the draft in sessionStorage and never writes a token anywhere', async () => {
    boot();
    await vi.waitFor(() => expect(sessionStorage.getItem('bdcap-form-v1')).toContain('Acme'));
    expect(localStorage.getItem('bdcap-form-v1')).toBeNull();
    expect(everyStorage()).not.toMatch(/tok\d/);
    expect(everyStorage()).not.toMatch(/token/i);
  });

  it('prefixes the API base when the app records one (backend on another origin in development)', async () => {
    boot({ apiBase: 'http://localhost:8000' });
    await vi.waitFor(() => expect(paths()).toContain('http://localhost:8000/api/portal/prefill'));
    expect(paths()[0]).toBe('http://localhost:8000/api/auth/refresh');
  });

  it('a refused refresh sends the user to login and forgets the hint (no redirect loop)', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(url.endsWith('/api/auth/refresh') ? json(401, { error: 'REFRESH_FAILED' }) : json(401, { error: 'NOT_SIGNED_IN' })));
    boot();
    await vi.waitFor(() => expect(replace).toHaveBeenCalled());
    expect(replace.mock.calls[0][0]).toBe('/login?reason=auth&next=' + encodeURIComponent('/portal/index.html'));
    expect(localStorage.getItem('bdcap-uid')).toBeNull();
  });

  it('a network blip or a server error does NOT sign the user out', async () => {
    fetchMock.mockImplementation((url: string) =>
      url.endsWith('/api/auth/refresh') ? Promise.reject(new TypeError('offline')) : Promise.resolve(json(503, {})));
    boot();
    await vi.waitFor(() => expect(paths()).toContain('/api/portal/prefill'));
    await new Promise((r) => setTimeout(r, 30));
    expect(replace).not.toHaveBeenCalled();
    expect(localStorage.getItem('bdcap-uid')).toBe('u1');
  });

  it('a 5xx from the refresh endpoint does not sign the user out either', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(url.endsWith('/api/auth/refresh') ? json(500, {}) : json(200, { fields: {}, sel: {}, status: {} })));
    boot();
    await vi.waitFor(() => expect(paths()).toContain('/api/portal/prefill'));
    await new Promise((r) => setTimeout(r, 30));
    expect(replace).not.toHaveBeenCalled();
  });

  it('when the token has expired mid-session, one 401 triggers one refresh and a retry with the new token', async () => {
    fetchMock.mockImplementation((url: string, init?: { headers?: Record<string, string> }) => {
      if (url.endsWith('/api/auth/refresh')) {
        accessN += 1;
        return Promise.resolve(json(200, { access_token: `tok${accessN}`, expires_at: nowSec() + 900, user: { id: 'u1', email: 'c@x.co' } }));
      }
      if (url.endsWith('/api/portal/prefill')) {
        return Promise.resolve(init?.headers?.Authorization === 'Bearer tok1' ? json(401, { error: 'SESSION_EXPIRED' }) : json(200, { fields: { bizNameInput: 'Retried' }, sel: {}, status: {} }));
      }
      return Promise.resolve(json(200, {}));
    });
    boot();
    await vi.waitFor(() => expect(sessionStorage.getItem('bdcap-form-v1')).toContain('Retried'));
    expect(paths().filter((p) => p === '/api/auth/refresh')).toHaveLength(2);
    expect(replace).not.toHaveBeenCalled();
  });

  it('an admin viewing a client reads that client and keeps no draft', async () => {
    sessionStorage.setItem('bdcap-form-v1', 'leftover');
    // the portal's own script normally provides this; the injected script calls it once the data is loaded
    const apply = vi.fn();
    (window as unknown as { bdcapApplyState?: unknown }).bdcapApplyState = apply;
    try {
      boot({ viewAs: 'client-7' });
      await vi.waitFor(() => expect(paths()).toContain('/api/admin/clients/client-7/prefill'));
      await vi.waitFor(() => expect(apply).toHaveBeenCalled());
      expect(sessionStorage.getItem('bdcap-form-v1')).toBeNull();
      expect(document.body.textContent).toContain('Admin view');
    } finally {
      delete (window as unknown as { bdcapApplyState?: unknown }).bdcapApplyState;
    }
  });
});
