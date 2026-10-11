import { beforeEach, describe, expect, it, vi } from 'vitest';

type Api = typeof import('./api');
type Session = typeof import('./session');

const nowSec = () => Math.floor(Date.now() / 1000);
const session = (over: Record<string, unknown> = {}) => ({
  access_token: 'access-1',
  expires_at: nowSec() + 900,
  user: { id: 'u1', email: 'a@b.co' },
  ...over,
});

const json = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

let fetchMock: ReturnType<typeof vi.fn>;
let api: Api;
let store: Session;

// Fresh module state per test. `signedIn` puts a session in memory; `hint` alone models a page reload
// (the cookie is still there, but the in-memory token is gone).
async function boot(opts: { signedIn?: ReturnType<typeof session>; hint?: boolean } = {}) {
  vi.resetModules();
  store = await import('./session');
  api = await import('./api');
  if (opts.signedIn) store.setSession(opts.signedIn);
  else if (opts.hint) localStorage.setItem('bdcap-uid', 'u1');
}

const calls = (path: string) => fetchMock.mock.calls.filter(([u]) => u === path);

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

describe('api()', () => {
  it('sends the bearer token and includes the cookie', async () => {
    await boot({ signedIn: session() });
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }));
    await expect(api.api('/api/auth/me')).resolves.toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/me');
    expect(init.method).toBe('GET');
    expect(init.credentials).toBe('include');
    expect(init.headers.Authorization).toBe('Bearer access-1');
    expect(init.headers['Content-Type']).toBeUndefined();
  });

  it('serialises a body as JSON with a content type', async () => {
    await boot({ signedIn: session() });
    fetchMock.mockResolvedValueOnce(json(200, {}));
    await api.api('/api/x', { method: 'POST', body: { a: 1 } });
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe('{"a":1}');
  });

  it('sends a falsy body (false) rather than dropping it', async () => {
    await boot({ signedIn: session() });
    fetchMock.mockResolvedValue(json(200, {}));
    await api.api('/api/x', { method: 'POST', body: false });
    expect(fetchMock.mock.calls[0][1].body).toBe('false');
  });

  it('omits Authorization when signed out (but still includes credentials)', async () => {
    await boot();
    fetchMock.mockResolvedValueOnce(json(200, {}));
    await api.api('/api/public');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include');
  });

  it('throws ApiError carrying status and the server error code', async () => {
    await boot({ signedIn: session() });
    fetchMock.mockResolvedValueOnce(json(403, { error: 'FORBIDDEN' }));
    await expect(api.api('/api/admin/clients')).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  it('falls back to REQUEST_FAILED when an error response has no JSON body', async () => {
    await boot({ signedIn: session() });
    fetchMock.mockResolvedValueOnce(new Response('<html>bad gateway</html>', { status: 502 }));
    await expect(api.api('/api/x')).rejects.toMatchObject({ status: 502, code: 'REQUEST_FAILED' });
  });

  it('tolerates an empty success body', async () => {
    await boot({ signedIn: session() });
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(api.api('/api/x', { method: 'DELETE' })).resolves.toEqual({});
  });

  it('propagates a network failure', async () => {
    await boot({ signedIn: session() });
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(api.api('/api/x')).rejects.toThrow('Failed to fetch');
  });
});

describe('token refresh (cookie based)', () => {
  const refreshed = (over: Record<string, unknown> = {}) => json(200, session({ access_token: 'access-2', ...over }));

  it('on 401 refreshes with the cookie only (no body, no token), retries, and keeps the user', async () => {
    await boot({ signedIn: session() });
    fetchMock
      .mockResolvedValueOnce(json(401, { error: 'SESSION_EXPIRED' }))
      .mockResolvedValueOnce(refreshed())
      .mockResolvedValueOnce(json(200, { fine: true }));
    await expect(api.api('/api/portal/prefill')).resolves.toEqual({ fine: true });

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('/api/auth/refresh');
    expect(init).toMatchObject({ method: 'POST', credentials: 'include' });
    expect(init.body).toBeUndefined();
    expect(init.headers).toBeUndefined();
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer access-2');
    expect(store.getSession()).toMatchObject({ access_token: 'access-2', user: { id: 'u1' } });
  });

  it('never stores the new access token anywhere but memory', async () => {
    await boot({ signedIn: session() });
    fetchMock.mockResolvedValueOnce(json(401, {})).mockResolvedValueOnce(refreshed()).mockResolvedValueOnce(json(200, {}));
    await api.api('/api/x');
    expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain('access-2');
  });

  it('a refused refresh (401) signs the user out and surfaces the original 401', async () => {
    await boot({ signedIn: session() });
    fetchMock.mockResolvedValueOnce(json(401, { error: 'SESSION_EXPIRED' })).mockResolvedValueOnce(json(401, { error: 'REFRESH_FAILED' }));
    await expect(api.api('/api/x')).rejects.toMatchObject({ status: 401, code: 'SESSION_EXPIRED' });
    expect(store.getSession()).toBeNull();
    expect(store.hasSessionHint()).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('a network blip during refresh does NOT sign the user out', async () => {
    await boot({ signedIn: session() });
    fetchMock.mockResolvedValueOnce(json(401, {})).mockRejectedValueOnce(new TypeError('offline'));
    await expect(api.api('/api/x')).rejects.toMatchObject({ status: 401 });
    expect(store.getSession()).not.toBeNull();
    expect(store.hasSessionHint()).toBe(true);
  });

  it.each([[500], [502], [429], [403]])('a %i from the refresh endpoint does NOT sign the user out', async (status) => {
    await boot({ signedIn: session() });
    fetchMock.mockResolvedValueOnce(json(401, {})).mockResolvedValueOnce(json(status, { error: 'X' }));
    await expect(api.api('/api/x')).rejects.toMatchObject({ status: 401 });
    expect(store.getSession()).not.toBeNull();
  });

  it('does not loop: a second 401 after a good refresh is returned as an error', async () => {
    await boot({ signedIn: session() });
    fetchMock.mockResolvedValueOnce(json(401, {})).mockResolvedValueOnce(refreshed()).mockResolvedValueOnce(json(401, {}));
    await expect(api.api('/api/x')).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not try to refresh when nobody was ever signed in', async () => {
    await boot();
    fetchMock.mockResolvedValueOnce(json(401, { error: 'NOT_SIGNED_IN' }));
    await expect(api.api('/api/x')).rejects.toMatchObject({ code: 'NOT_SIGNED_IN' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does refresh after a reload: no in-memory token, but the hint says a cookie may exist', async () => {
    await boot({ hint: true });
    fetchMock.mockResolvedValueOnce(json(401, {})).mockResolvedValueOnce(refreshed()).mockResolvedValueOnce(json(200, { ok: 1 }));
    await expect(api.api('/api/x')).resolves.toEqual({ ok: 1 });
  });

  it.each(['/api/auth/login', '/api/auth/signup', '/api/auth/forgot-password', '/api/auth/resend-verification', '/api/auth/exchange', '/api/auth/logout'])(
    'a 401 from %s is a plain error, never a reason to refresh (that could sign in a stale cookie)',
    async (path) => {
      await boot({ signedIn: session() });
      fetchMock.mockResolvedValueOnce(json(401, { error: 'INVALID_CREDENTIALS' }));
      await expect(api.api(path, { method: 'POST', body: {} })).rejects.toMatchObject({ status: 401 });
      expect(calls('/api/auth/refresh')).toHaveLength(0);
    },
  );

  it('refreshes ahead of time when the token is about to expire', async () => {
    await boot({ signedIn: session({ expires_at: nowSec() + 20 }) });
    fetchMock.mockResolvedValueOnce(refreshed({ access_token: 'fresh' })).mockResolvedValueOnce(json(200, {}));
    await api.api('/api/x');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/refresh');
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer fresh');
  });

  it('shares one refresh between concurrent callers', async () => {
    await boot({ signedIn: session({ expires_at: nowSec() + 5 }) });
    let release!: (r: Response) => void;
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/auth/refresh') return new Promise<Response>((res) => { release = res; });
      return Promise.resolve(json(200, { url }));
    });
    const all = Promise.all([api.api('/api/a'), api.api('/api/b'), api.api('/api/c')]);
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    release(refreshed({ access_token: 'shared' }));
    await all;
    expect(calls('/api/auth/refresh')).toHaveLength(1);
  });

  it('refreshSession resolves false when offline, and true with a rotated session', async () => {
    await boot({ hint: true });
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    await expect(api.refreshSession()).resolves.toBe(false);
    fetchMock.mockResolvedValueOnce(refreshed());
    await expect(api.refreshSession()).resolves.toBe(true);
    expect(store.getSession()?.access_token).toBe('access-2');
  });
});

describe('restoreSession (runs once at startup)', () => {
  const withGrant = (grant: string, type = 'invite') => {
    window.history.replaceState(null, '', `/set-password#grant=${grant}&type=${type}`);
    store.captureGrantFromUrl();
  };

  it('does nothing for a visitor who was never signed in', async () => {
    await boot();
    await api.restoreSession();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.getSession()).toBeNull();
  });

  it('brings the session back from the cookie after a reload', async () => {
    await boot({ hint: true });
    fetchMock.mockResolvedValueOnce(json(200, session({ access_token: 'restored' })));
    await api.restoreSession();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/refresh');
    expect(store.getSession()?.access_token).toBe('restored');
  });

  it('forgets a hint whose cookie is gone, so the next load does not even try', async () => {
    await boot({ hint: true });
    fetchMock.mockResolvedValueOnce(json(401, { error: 'REFRESH_FAILED' }));
    await api.restoreSession();
    expect(store.getSession()).toBeNull();
    expect(store.hasSessionHint()).toBe(false);
  });

  it('trades an emailed-link grant for a session (and does not also refresh)', async () => {
    await boot({ hint: true });
    withGrant('the-grant');
    fetchMock.mockResolvedValueOnce(json(200, session({ access_token: 'from-grant' })));
    await api.restoreSession();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/exchange');
    expect(init).toMatchObject({ method: 'POST', credentials: 'include' });
    expect(JSON.parse(init.body)).toEqual({ grant: 'the-grant' });
    expect(store.getSession()?.access_token).toBe('from-grant');
  });

  it('a spent or invalid grant leaves the visitor signed out', async () => {
    await boot();
    withGrant('stale');
    fetchMock.mockResolvedValueOnce(json(401, { error: 'GRANT_INVALID' }));
    await api.restoreSession();
    expect(store.getSession()).toBeNull();
  });

  it('uses a grant only once', async () => {
    await boot();
    withGrant('once');
    fetchMock.mockResolvedValue(json(200, session()));
    await api.restoreSession();
    await api.restoreSession();
    expect(calls('/api/auth/exchange')).toHaveLength(1);
  });

  it.each([['exchange', true], ['refresh', false]])('never rejects when the %s request fails to reach the server', async (_n, grant) => {
    await boot({ hint: true });
    if (grant) withGrant('g');
    fetchMock.mockRejectedValue(new TypeError('offline'));
    await expect(api.restoreSession()).resolves.toBeUndefined();
    expect(store.getSession()).toBeNull();
  });
});

describe('apiUpload()', () => {
  it('posts FormData with the cookie but without forcing a content type', async () => {
    await boot({ signedIn: session() });
    fetchMock.mockResolvedValueOnce(json(200, { user: { avatarUrl: 'u' } }));
    const fd = new FormData();
    fd.append('file', new File(['x'], 'a.png', { type: 'image/png' }));
    await expect(api.apiUpload('/api/auth/avatar', fd)).resolves.toEqual({ user: { avatarUrl: 'u' } });
    const init = fetchMock.mock.calls[0][1];
    expect(init).toMatchObject({ method: 'POST', credentials: 'include', body: fd });
    expect(init.headers['Content-Type']).toBeUndefined();
    expect(init.headers.Authorization).toBe('Bearer access-1');
  });

  it('retries after a refresh on 401', async () => {
    await boot({ signedIn: session() });
    fetchMock
      .mockResolvedValueOnce(json(401, {}))
      .mockResolvedValueOnce(json(200, session({ access_token: 'n2' })))
      .mockResolvedValueOnce(json(200, { ok: 1 }));
    await expect(api.apiUpload('/api/auth/avatar', new FormData())).resolves.toEqual({ ok: 1 });
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer n2');
  });

  it('clears the session when the refresh is refused', async () => {
    await boot({ signedIn: session() });
    fetchMock.mockResolvedValueOnce(json(401, {})).mockResolvedValueOnce(json(401, {}));
    await expect(api.apiUpload('/api/auth/avatar', new FormData())).rejects.toMatchObject({ status: 401 });
    expect(store.getSession()).toBeNull();
  });

  it.each([
    [400, 'INVALID_FILE_TYPE'], [400, 'FILE_TOO_LARGE'], [502, 'UPLOAD_FAILED'], [503, 'STORAGE_NOT_CONFIGURED'],
  ])('maps %i %s to a friendly message', async (status, code) => {
    await boot({ signedIn: session() });
    fetchMock.mockResolvedValueOnce(json(status, { error: code }));
    const err = (await api.apiUpload('/api/auth/avatar', new FormData()).catch((e: unknown) => e)) as InstanceType<typeof api.ApiError>;
    expect(err).toBeInstanceOf(api.ApiError);
    expect(err.code).toBe(code);
    expect(api.errorMessage(err)).not.toBe('Something went wrong. Please try again.');
  });

  it('reports REQUEST_FAILED for a non-JSON server error', async () => {
    await boot({ signedIn: session() });
    fetchMock.mockResolvedValueOnce(new Response('Internal error', { status: 500 }));
    await expect(api.apiUpload('/api/auth/avatar', new FormData())).rejects.toMatchObject({ code: 'REQUEST_FAILED' });
  });
});

describe('errorMessage()', () => {
  it('gives specific text for known codes', async () => {
    await boot();
    expect(api.errorMessage(new api.ApiError(401, 'INVALID_CREDENTIALS'))).toMatch(/incorrect password/i);
    expect(api.errorMessage(new api.ApiError(404, 'ACCOUNT_NOT_FOUND'))).toBe('No account was found for that email address.');
    expect(api.errorMessage(new api.ApiError(409, 'EMAIL_EXISTS'))).toBe('An account with this email already exists.');
    expect(api.errorMessage(new api.ApiError(403, 'ACCOUNT_DISABLED'))).toMatch(/disabled/i);
    expect(api.errorMessage(new api.ApiError(500, 'SERVER_ERROR'))).toMatch(/server had a problem/i);
    expect(api.errorMessage(new api.ApiError(400, 'WRONG_PASSWORD'))).toBe('Your current password is not correct.');
    expect(api.errorMessage(new api.ApiError(403, 'EMAIL_NOT_VERIFIED'))).toMatch(/verify your email/i);
  });

  it('tells the user when the server cannot be reached (fetch rejects with a TypeError)', async () => {
    await boot();
    expect(api.errorMessage(new TypeError('Failed to fetch'))).toBe('Could not reach the server. Check your connection and try again.');
  });

  it('never leaks unknown server codes or raw errors to the user', async () => {
    await boot();
    expect(api.errorMessage(new api.ApiError(500, 'SOME_INTERNAL_CODE'))).toBe('Something went wrong. Please try again.');
    expect(api.errorMessage(new Error('boom'))).toBe('Something went wrong. Please try again.');
    expect(api.errorMessage(undefined)).toBe('Something went wrong. Please try again.');
    expect(api.errorMessage('string')).toBe('Something went wrong. Please try again.');
  });
});

describe('config', () => {
  it('uses same-origin /api by default', async () => {
    vi.resetModules();
    const c = await import('./config');
    expect(c.apiUrl('/api/x')).toBe('/api/x');
    expect(localStorage.getItem('bdcap-api-base')).toBeNull();
  });

  it('trims trailing slashes from VITE_API_URL and shares it with the static portal', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_API_URL', ' https://api.example.com/// ');
    const c = await import('./config');
    expect(c.API_BASE).toBe('https://api.example.com');
    expect(c.apiUrl('/api/x')).toBe('https://api.example.com/api/x');
    expect(localStorage.getItem('bdcap-api-base')).toBe('https://api.example.com');
    vi.unstubAllEnvs();
  });
});
