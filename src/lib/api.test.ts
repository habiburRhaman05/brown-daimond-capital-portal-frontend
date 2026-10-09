import { beforeEach, describe, expect, it, vi } from 'vitest';

type Api = typeof import('./api');
type Session = typeof import('./session');

const nowSec = () => Math.floor(Date.now() / 1000);
const session = (over: Record<string, unknown> = {}) => ({
  access_token: 'access-1',
  refresh_token: 'refresh-1',
  expires_at: nowSec() + 3600,
  user: { id: 'u1', email: 'a@b.co' },
  ...over,
});

const json = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

let fetchMock: ReturnType<typeof vi.fn>;
let api: Api;
let store: Session;

async function boot(initial?: ReturnType<typeof session>) {
  vi.resetModules();
  if (initial) localStorage.setItem('bdcap-session-v1', JSON.stringify(initial));
  store = await import('./session');
  api = await import('./api');
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

describe('api()', () => {
  it('sends the bearer token and returns parsed JSON', async () => {
    await boot(session());
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }));
    await expect(api.api('/api/auth/me')).resolves.toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/me');
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toBe('Bearer access-1');
    expect(init.headers['Content-Type']).toBeUndefined();
  });

  it('serialises a body as JSON with a content type', async () => {
    await boot(session());
    fetchMock.mockResolvedValueOnce(json(200, {}));
    await api.api('/api/x', { method: 'POST', body: { a: 1 } });
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe('{"a":1}');
  });

  it('sends a falsy body (0, false, empty string) rather than dropping it', async () => {
    await boot(session());
    fetchMock.mockResolvedValue(json(200, {}));
    await api.api('/api/x', { method: 'POST', body: false });
    expect(fetchMock.mock.calls[0][1].body).toBe('false');
  });

  it('omits Authorization when signed out', async () => {
    await boot();
    fetchMock.mockResolvedValueOnce(json(200, {}));
    await api.api('/api/public');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('throws ApiError carrying status and the server error code', async () => {
    await boot(session());
    fetchMock.mockResolvedValueOnce(json(403, { error: 'FORBIDDEN' }));
    await expect(api.api('/api/admin/clients')).rejects.toMatchObject({ name: 'Error', status: 403, code: 'FORBIDDEN' });
  });

  it('falls back to REQUEST_FAILED when an error response has no JSON body', async () => {
    await boot(session());
    fetchMock.mockResolvedValueOnce(new Response('<html>bad gateway</html>', { status: 502 }));
    await expect(api.api('/api/x')).rejects.toMatchObject({ status: 502, code: 'REQUEST_FAILED' });
  });

  it('tolerates an empty success body', async () => {
    await boot(session());
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(api.api('/api/x', { method: 'DELETE' })).resolves.toEqual({});
  });

  it('propagates a network failure', async () => {
    await boot(session());
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(api.api('/api/x')).rejects.toThrow('Failed to fetch');
  });
});

describe('token refresh', () => {
  it('on 401 refreshes once, stores the new tokens, retries, and keeps the user', async () => {
    await boot(session());
    fetchMock
      .mockResolvedValueOnce(json(401, { error: 'SESSION_EXPIRED' }))
      .mockResolvedValueOnce(json(200, { access_token: 'access-2', refresh_token: 'refresh-2', expires_at: nowSec() + 3600, expires_in: 3600 }))
      .mockResolvedValueOnce(json(200, { fine: true }));
    await expect(api.api('/api/portal/prefill')).resolves.toEqual({ fine: true });

    expect(fetchMock.mock.calls[1][0]).toBe('/api/auth/refresh');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ refresh_token: 'refresh-1' });
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer access-2');
    expect(store.getSession()).toMatchObject({ access_token: 'access-2', refresh_token: 'refresh-2', user: { id: 'u1' } });
  });

  it('on 401 with a failed refresh signs the user out and surfaces the 401', async () => {
    await boot(session());
    fetchMock
      .mockResolvedValueOnce(json(401, { error: 'SESSION_EXPIRED' }))
      .mockResolvedValueOnce(json(401, { error: 'REFRESH_FAILED' }));
    await expect(api.api('/api/x')).rejects.toMatchObject({ status: 401, code: 'SESSION_EXPIRED' });
    expect(store.getSession()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not loop: a second 401 after a successful refresh is returned as an error', async () => {
    await boot(session());
    fetchMock
      .mockResolvedValueOnce(json(401, { error: 'SESSION_EXPIRED' }))
      .mockResolvedValueOnce(json(200, { access_token: 'n', refresh_token: 'n', expires_at: nowSec() + 3600 }))
      .mockResolvedValueOnce(json(401, { error: 'SESSION_EXPIRED' }));
    await expect(api.api('/api/x')).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not try to refresh when there is no session', async () => {
    await boot();
    fetchMock.mockResolvedValueOnce(json(401, { error: 'NOT_SIGNED_IN' }));
    await expect(api.api('/api/x')).rejects.toMatchObject({ code: 'NOT_SIGNED_IN' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refreshes ahead of time when the token is about to expire', async () => {
    await boot(session({ expires_at: nowSec() + 20 }));
    fetchMock
      .mockResolvedValueOnce(json(200, { access_token: 'fresh', refresh_token: 'r2', expires_at: nowSec() + 3600 }))
      .mockResolvedValueOnce(json(200, {}));
    await api.api('/api/x');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/refresh');
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer fresh');
  });

  it('shares one refresh between concurrent callers', async () => {
    await boot(session({ expires_at: nowSec() + 5 }));
    let release!: (r: Response) => void;
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/auth/refresh') return new Promise<Response>((res) => { release = res; });
      return Promise.resolve(json(200, { url }));
    });
    const calls = Promise.all([api.api('/api/a'), api.api('/api/b'), api.api('/api/c')]);
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    release(json(200, { access_token: 'shared', refresh_token: 'r2', expires_at: nowSec() + 3600 }));
    await calls;
    expect(fetchMock.mock.calls.filter(([u]) => u === '/api/auth/refresh')).toHaveLength(1);
  });

  it('refreshSession resolves false when offline or when there is no refresh token', async () => {
    await boot();
    await expect(api.refreshSession()).resolves.toBe(false);
    await boot(session());
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    await expect(api.refreshSession()).resolves.toBe(false);
    expect(store.getSession()).not.toBeNull(); // a network blip must not sign anyone out
  });
});

describe('apiUpload()', () => {
  it('posts FormData without forcing a content type so the boundary is set by the browser', async () => {
    await boot(session());
    fetchMock.mockResolvedValueOnce(json(200, { user: { avatarUrl: 'u' } }));
    const fd = new FormData();
    fd.append('file', new File(['x'], 'a.png', { type: 'image/png' }));
    await expect(api.apiUpload('/api/auth/avatar', fd)).resolves.toEqual({ user: { avatarUrl: 'u' } });
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(fd);
    expect(init.headers['Content-Type']).toBeUndefined();
    expect(init.headers.Authorization).toBe('Bearer access-1');
  });

  it('retries after a refresh on 401', async () => {
    await boot(session());
    fetchMock
      .mockResolvedValueOnce(json(401, {}))
      .mockResolvedValueOnce(json(200, { access_token: 'n2', refresh_token: 'r2', expires_at: nowSec() + 3600 }))
      .mockResolvedValueOnce(json(200, { ok: 1 }));
    await expect(api.apiUpload('/api/auth/avatar', new FormData())).resolves.toEqual({ ok: 1 });
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer n2');
  });

  it('clears the session when the refresh also fails', async () => {
    await boot(session());
    fetchMock.mockResolvedValueOnce(json(401, {})).mockResolvedValueOnce(json(401, {}));
    await expect(api.apiUpload('/api/auth/avatar', new FormData())).rejects.toMatchObject({ status: 401 });
    expect(store.getSession()).toBeNull();
  });

  it.each([
    [400, 'INVALID_FILE_TYPE'],
    [400, 'FILE_TOO_LARGE'],
    [502, 'UPLOAD_FAILED'],
    [503, 'STORAGE_NOT_CONFIGURED'],
  ])('maps %i %s to a friendly message', async (status, code) => {
    await boot(session());
    fetchMock.mockResolvedValueOnce(json(status, { error: code }));
    const err = (await api.apiUpload('/api/auth/avatar', new FormData()).catch((e: unknown) => e)) as InstanceType<typeof api.ApiError>;
    expect(err).toBeInstanceOf(api.ApiError);
    expect(err.code).toBe(code);
    expect(api.errorMessage(err)).not.toBe('Something went wrong. Please try again.');
  });

  it('reports REQUEST_FAILED for a non-JSON server error', async () => {
    await boot(session());
    fetchMock.mockResolvedValueOnce(new Response('Internal error', { status: 500 }));
    await expect(api.apiUpload('/api/auth/avatar', new FormData())).rejects.toMatchObject({ code: 'REQUEST_FAILED' });
  });
});

describe('errorMessage()', () => {
  it('gives specific text for known codes', async () => {
    await boot();
    expect(api.errorMessage(new api.ApiError(401, 'INVALID_CREDENTIALS'))).toBe('Invalid email or password.');
    expect(api.errorMessage(new api.ApiError(400, 'WRONG_PASSWORD'))).toBe('Your current password is not correct.');
    expect(api.errorMessage(new api.ApiError(403, 'EMAIL_NOT_VERIFIED'))).toMatch(/verify your email/i);
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
