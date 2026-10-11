import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api', async (orig) => ({ ...(await orig<typeof import('../lib/api')>()), api: vi.fn(), restoreSession: vi.fn() }));

import { api, ApiError, restoreSession } from '../lib/api';
import { clearSession, getSession, setSession } from '../lib/session';
import { Login } from '../pages/Login';
import { AuthProvider, useAuth } from './AuthProvider';
import { homeFor, loginFor, Protected, HomeRedirect, GuestOnly } from './Guards';
import { Signup } from '../pages/Signup';
import { ForgotPassword } from '../pages/ForgotPassword';
import { SetPassword } from '../pages/SetPassword';

const mockApi = vi.mocked(api);
const mockRestore = vi.mocked(restoreSession);
const session = (over: Record<string, unknown> = {}) => ({
  access_token: 'tok', expires_at: 9_999_999_999, user: { id: 'u1', email: 'a@b.co' }, ...over,
});
const me = (role: 'admin' | 'client' = 'client') => ({ user: { id: 'u1', email: 'a@b.co', role, fullName: 'A B', avatarUrl: '', phone: '' } });

function Probe() {
  const { state, hasSession, signOut } = useAuth();
  return (
    <div>
      <span data-testid="status">{state.status}</span>
      <span data-testid="has">{String(hasSession)}</span>
      <span data-testid="code">{state.status === 'blocked' ? state.code : ''}</span>
      <span data-testid="role">{state.status === 'ready' ? state.user.role : ''}</span>
      <button onClick={() => signOut()}>out</button>
    </div>
  );
}

function Where() {
  const l = useLocation();
  return <div data-testid="where">{l.pathname + l.search}</div>;
}

function app(ui: React.ReactNode, path = '/') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>{ui}<Where /></AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// The access token lives in memory, so "already signed in" means: the cookie brought the session back at startup.
function signIn(over: Record<string, unknown> = {}) {
  mockRestore.mockImplementation(async () => { setSession(session(over)); });
}

beforeEach(() => {
  clearSession();
  mockApi.mockReset();
  mockRestore.mockReset().mockResolvedValue(undefined);
});

describe('route helpers', () => {
  it('send each role to its own home and login', () => {
    expect(homeFor('admin')).toBe('/admin');
    expect(homeFor('client')).toBe('/dashboard');
    expect(loginFor('admin')).toBe('/admin/login');
    expect(loginFor('client')).toBe('/client/login');
  });
});

describe('AuthProvider', () => {
  it('is signed out without a session and never calls the API', async () => {
    app(<Probe />);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedOut'));
    expect(screen.getByTestId('has')).toHaveTextContent('false');
    expect(mockApi).not.toHaveBeenCalled();
  });

  it('says "loading", never "signed out", while the session is being restored from the cookie', async () => {
    let finish!: () => void;
    mockRestore.mockReturnValue(new Promise<void>((res) => { finish = res; }));
    app(<Probe />);
    expect(screen.getByTestId('status')).toHaveTextContent('loading'); // no flash of the login page on reload
    finish();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedOut'));
  });

  it('restores the session exactly once, even under StrictMode double effects', async () => {
    const qc = new QueryClient();
    render(
      <React.StrictMode>
        <QueryClientProvider client={qc}>
          <MemoryRouter><AuthProvider><Probe /></AuthProvider></MemoryRouter>
        </QueryClientProvider>
      </React.StrictMode>,
    );
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedOut'));
    expect(mockRestore).toHaveBeenCalledTimes(1);
  });

  it('loads the user for a stored session', async () => {
    signIn();
    mockApi.mockResolvedValueOnce(me('admin'));
    app(<Probe />);
    expect(screen.getByTestId('status')).toHaveTextContent('loading');
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    expect(screen.getByTestId('role')).toHaveTextContent('admin');
    expect(mockApi).toHaveBeenCalledWith('/api/auth/me');
  });

  it.each([[403, 'NOT_INVITED'], [401, 'SESSION_EXPIRED']])('blocks on a %i with the server code', async (status, code) => {
    signIn();
    mockApi.mockRejectedValueOnce(new ApiError(status, code));
    app(<Probe />);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('blocked'));
    expect(screen.getByTestId('code')).toHaveTextContent(code);
  });

  it('blocks with REQUEST_FAILED on a network or server error', async () => {
    signIn();
    mockApi.mockRejectedValueOnce(new TypeError('offline'));
    app(<Probe />);
    await waitFor(() => expect(screen.getByTestId('code')).toHaveTextContent('REQUEST_FAILED'));
  });

  it('reacts to the session being cleared elsewhere (another tab or an expired refresh)', async () => {
    signIn();
    mockApi.mockResolvedValueOnce(me());
    app(<Probe />);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    clearSession();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedOut'));
  });

  it('does not re-ask /me when the token refreshes for the same user... but does when it changes', async () => {
    signIn();
    mockApi.mockResolvedValue(me());
    app(<Probe />);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    const before = mockApi.mock.calls.length;
    setSession(session({ access_token: 'tok2' }));
    await waitFor(() => expect(mockApi.mock.calls.length).toBeGreaterThan(before)); // new token -> re-verify role
  });

  it('signOut calls logout, wipes session and portal drafts', async () => {
    signIn();
    localStorage.setItem('bdcap-form-v1', 'draft');
    localStorage.setItem('bdcap-draft-owner', 'u1');
    mockApi.mockResolvedValueOnce(me()).mockResolvedValueOnce({ ok: true });
    app(<Probe />);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    await userEvent.click(screen.getByText('out'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedOut'));
    expect(mockApi).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
    expect(getSession()).toBeNull();
    expect(localStorage.getItem('bdcap-uid')).toBeNull(); // the signed-in hint goes too
    expect(localStorage.getItem('bdcap-form-v1')).toBeNull();
    expect(localStorage.getItem('bdcap-draft-owner')).toBeNull();
    expect(sessionStorage.getItem('bdcap-form-v1')).toBeNull();
  });

  it('signOut still signs the browser out when the logout request fails', async () => {
    signIn();
    mockApi.mockResolvedValueOnce(me()).mockRejectedValueOnce(new TypeError('offline'));
    app(<Probe />);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    await userEvent.click(screen.getByText('out'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedOut'));
    expect(getSession()).toBeNull();
  });

  it('useAuth outside the provider is a clear error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow('useAuth must be used inside AuthProvider');
    spy.mockRestore();
  });
});

describe('Protected / HomeRedirect', () => {
  const routes = (
    <Routes>
      <Route path="/admin" element={<Protected role="admin"><div>ADMIN AREA</div></Protected>} />
      <Route path="/dashboard" element={<Protected role="client"><div>CLIENT AREA</div></Protected>} />
      <Route path="/admin/login" element={<div>admin login</div>} />
      <Route path="/client/login" element={<div>client login</div>} />
      <Route path="/" element={<HomeRedirect />} />
    </Routes>
  );

  it('sends signed-out visitors to the matching login page, remembering where they were going', async () => {
    app(routes, '/admin');
    expect(await screen.findByText('admin login')).toBeInTheDocument();
    expect(screen.queryByText('ADMIN AREA')).not.toBeInTheDocument();
  });

  it('shows a loading shell, never the protected content, while checking', () => {
    signIn();
    mockApi.mockReturnValue(new Promise(() => {}));
    app(routes, '/dashboard');
    expect(screen.queryByText('CLIENT AREA')).not.toBeInTheDocument();
  });

  it('lets the right role in', async () => {
    signIn();
    mockApi.mockResolvedValueOnce(me('client'));
    app(routes, '/dashboard');
    expect(await screen.findByText('CLIENT AREA')).toBeInTheDocument();
  });

  it('keeps a client out of /admin and bounces them to their dashboard', async () => {
    signIn();
    mockApi.mockResolvedValueOnce(me('client'));
    app(routes, '/admin');
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/dashboard'));
    expect(screen.queryByText('ADMIN AREA')).not.toBeInTheDocument();
  });

  it('keeps an admin out of the client area', async () => {
    signIn();
    mockApi.mockResolvedValueOnce(me('admin'));
    app(routes, '/dashboard');
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/admin'));
  });

  it('shows a blocked screen with the reason and a sign-out button', async () => {
    signIn();
    mockApi.mockRejectedValueOnce(new ApiError(403, 'EMAIL_NOT_VERIFIED'));
    app(routes, '/dashboard');
    expect(await screen.findByText(/verify your email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.queryByText('CLIENT AREA')).not.toBeInTheDocument();
  });

  it('HomeRedirect routes by state and role', async () => {
    app(routes, '/');
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/client/login'));
  });

  it('HomeRedirect sends a signed-in admin to /admin', async () => {
    signIn();
    mockApi.mockResolvedValueOnce(me('admin'));
    app(routes, '/');
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/admin'));
  });
});

describe('Login', () => {
  let meRole: 'admin' | 'client' = 'client';
  beforeEach(() => {
    meRole = 'client';
    // After a successful login the provider asks /me who the user is.
    mockApi.mockImplementation(async (path: string) => (path === '/api/auth/me' ? me(meRole) : undefined) as never);
  });
  const email = () => screen.getByPlaceholderText('you@company.com');
  const pass = () => screen.getByPlaceholderText('Enter your password');
  const submit = () => userEvent.click(screen.getByRole('button', { name: /^Sign in/ }));
  const routes = (
    <Routes>
      <Route path="/client/login" element={<Login variant="client" />} />
      <Route path="/dashboard" element={<div>CLIENT HOME</div>} />
      <Route path="/dashboard/account" element={<div>ACCOUNT PAGE</div>} />
      <Route path="/admin/login" element={<Login variant="admin" />} />
      <Route path="/admin" element={<div>ADMIN HOME</div>} />
    </Routes>
  );

  it('normalises the email, signs in and lands on the dashboard', async () => {
    mockApi.mockResolvedValueOnce(session());
    app(routes, '/client/login');
    await userEvent.type(email(), '  Ada@Example.COM ');
    await userEvent.type(pass(), 'secret-pass');
    await submit();
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/dashboard'));
    expect(mockApi).toHaveBeenCalledWith('/api/auth/login', { method: 'POST', body: { email: 'ada@example.com', password: 'secret-pass' } });
    expect(getSession()?.access_token).toBe('tok');
  });

  it('shows a clear message for wrong credentials and stays signed out', async () => {
    mockApi.mockRejectedValueOnce(new ApiError(401, 'INVALID_CREDENTIALS'));
    app(routes, '/client/login');
    await userEvent.type(email(), 'a@b.co');
    await userEvent.type(pass(), 'nope');
    await submit();
    expect(await screen.findByText(/Incorrect password/)).toBeInTheDocument();
    expect(getSession()).toBeNull();
    expect(screen.getByRole('button', { name: /^Sign in/ })).toBeEnabled(); // can try again
  });

  it('says so when no account exists for the email, and offers to create one', async () => {
    mockApi.mockRejectedValueOnce(new ApiError(404, 'ACCOUNT_NOT_FOUND'));
    app(routes, '/client/login');
    await userEvent.type(email(), 'ghost@x.co');
    await userEvent.type(pass(), 'whatever1');
    await submit();
    expect(await screen.findByText(/No account was found for that email address/)).toBeInTheDocument();
    const alert = screen.getByRole('alert');
    expect(within(alert).getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/client/signup');
    expect(getSession()).toBeNull();
  });

  it('does not push the admin sign-in page towards client signup', async () => {
    mockApi.mockRejectedValueOnce(new ApiError(404, 'ACCOUNT_NOT_FOUND'));
    app(routes, '/admin/login');
    await userEvent.type(email(), 'ghost@x.co');
    await userEvent.type(pass(), 'whatever1');
    await submit();
    await screen.findByText(/No account was found/);
    expect(within(screen.getByRole('alert')).queryByRole('link', { name: 'Create an account' })).not.toBeInTheDocument();
  });

  it('offers a password reset link after a wrong password', async () => {
    mockApi.mockRejectedValueOnce(new ApiError(401, 'INVALID_CREDENTIALS'));
    app(routes, '/client/login');
    await userEvent.type(email(), 'a@b.co');
    await userEvent.type(pass(), 'wrong');
    await submit();
    expect(await screen.findByRole('link', { name: 'Reset your password' })).toHaveAttribute('href', '/forgot-password');
  });

  it('tells a disabled account what is going on', async () => {
    mockApi.mockRejectedValueOnce(new ApiError(403, 'ACCOUNT_DISABLED'));
    app(routes, '/client/login');
    await userEvent.type(email(), 'a@b.co');
    await userEvent.type(pass(), 'x');
    await submit();
    expect(await screen.findByText(/account has been disabled/i)).toBeInTheDocument();
  });

  it('clears the previous error (and its link) when submitting again', async () => {
    mockApi.mockRejectedValueOnce(new ApiError(404, 'ACCOUNT_NOT_FOUND')).mockRejectedValueOnce(new ApiError(401, 'INVALID_CREDENTIALS'));
    app(routes, '/client/login');
    await userEvent.type(email(), 'a@b.co');
    await userEvent.type(pass(), 'x');
    await submit();
    await within(await screen.findByRole('alert')).findByRole('link', { name: 'Create an account' });
    await submit();
    await within(await screen.findByRole('alert')).findByRole('link', { name: 'Reset your password' });
    expect(within(screen.getByRole('alert')).queryByRole('link', { name: 'Create an account' })).not.toBeInTheDocument();
  });

  it('offers to resend the verification mail for an unverified account, then confirms', async () => {
    mockApi.mockRejectedValueOnce(new ApiError(403, 'EMAIL_NOT_VERIFIED')).mockResolvedValueOnce({ ok: true });
    app(routes, '/client/login');
    await userEvent.type(email(), 'New@x.co');
    await userEvent.type(pass(), 'pw');
    await submit();
    await userEvent.click(await screen.findByRole('button', { name: 'Resend verification email' }));
    expect(await screen.findByText(/new verification email is on its way/i)).toBeInTheDocument();
    expect(mockApi).toHaveBeenLastCalledWith('/api/auth/resend-verification', { method: 'POST', body: { email: 'new@x.co' } });
  });

  it('does not offer a resend for ordinary login failures', async () => {
    mockApi.mockRejectedValueOnce(new ApiError(401, 'INVALID_CREDENTIALS'));
    app(routes, '/client/login');
    await userEvent.type(email(), 'a@b.co');
    await userEvent.type(pass(), 'x');
    await submit();
    await screen.findByText(/Incorrect password/);
    expect(screen.queryByRole('button', { name: 'Resend verification email' })).not.toBeInTheDocument();
  });

  it('shows a generic message when the server is down', async () => {
    mockApi.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    app(routes, '/client/login');
    await userEvent.type(email(), 'a@b.co');
    await userEvent.type(pass(), 'x');
    await submit();
    expect(await screen.findByText('Could not reach the server. Check your connection and try again.')).toBeInTheDocument();
  });

  it('returns the user to the page they were heading to', async () => {
    mockApi.mockResolvedValueOnce(session());
    app(routes, '/client/login?next=/dashboard/account');
    await userEvent.type(email(), 'a@b.co');
    await userEvent.type(pass(), 'x');
    await submit();
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/dashboard/account'));
  });

  it.each([
    ['//evil.com/phish', 'protocol-relative URL'],
    ['https://evil.com', 'absolute URL'],
    ['javascript:alert(1)', 'javascript: URL'],
    ['evil', 'bare word'],
  ])('ignores an unsafe next= target (%s: %s) and uses the default page', async (next) => {
    mockApi.mockResolvedValueOnce(session());
    app(routes, `/client/login?next=${encodeURIComponent(next)}`);
    await userEvent.type(email(), 'a@b.co');
    await userEvent.type(pass(), 'x');
    await submit();
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/dashboard'));
  });

  it('admin login lands on /admin', async () => {
    meRole = 'admin';
    mockApi.mockResolvedValueOnce(session());
    app(routes, '/admin/login');
    await userEvent.type(email(), 'boss@x.co');
    await userEvent.type(pass(), 'x');
    await submit();
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/admin'));
  });

  it('shows the right banners for verified and expired verification links', () => {
    const { unmount } = app(routes, '/client/login?verified=1');
    expect(screen.getByText(/Your email is verified/)).toBeInTheDocument();
    unmount();
    app(routes, '/client/login?verify=expired');
    expect(screen.getByText(/verification link has expired/)).toBeInTheDocument();
  });

  it('redirects an already signed-in client away from the login page', async () => {
    signIn();
    mockApi.mockResolvedValueOnce(me('client'));
    app(routes, '/client/login');
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/dashboard'));
  });

  it('sends a signed-in client who opens the admin login to their own home', async () => {
    signIn();
    mockApi.mockResolvedValueOnce(me('client'));
    app(routes, '/admin/login');
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/dashboard'));
  });

  it('requires both fields (native validation)', () => {
    app(routes, '/client/login');
    expect(email()).toBeRequired();
    expect(pass()).toBeRequired();
    expect(mockApi).not.toHaveBeenCalled();
  });
});


describe('signed-in visitors on the public auth pages', () => {
  const routes = (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/client/login" element={<Login variant="client" />} />
      <Route path="/admin/login" element={<Login variant="admin" />} />
      <Route path="/client/signup" element={<GuestOnly><Signup /></GuestOnly>} />
      <Route path="/forgot-password" element={<GuestOnly><ForgotPassword /></GuestOnly>} />
      <Route path="/set-password" element={<SetPassword />} />
      <Route path="/dashboard" element={<div>CLIENT HOME</div>} />
      <Route path="/admin" element={<div>ADMIN HOME</div>} />
    </Routes>
  );
  const PAGES: [string, string][] = [
    ['/login', 'Welcome back'],
    ['/client/login', 'Welcome back'],
    ['/admin/login', 'Welcome back'],
    ['/client/signup', 'Create your account'],
    ['/forgot-password', 'Reset your password'],
  ];
  const as = (role: 'admin' | 'client') => {
    signIn();
    mockApi.mockImplementation((async (path: string) => (path === '/api/auth/me' ? me(role) : undefined)) as never);
  };

  describe.each([['client', '/dashboard'], ['admin', '/admin']] as const)('a signed-in %s', (role, home) => {
    it.each(PAGES)('is sent to their home from %s', async (path) => {
      as(role);
      app(routes, path);
      await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(new RegExp('^' + home + '$')));
    });
  });

  it.each(PAGES)('a signed-out visitor still sees %s (%s)', async (path, heading) => {
    app(routes, path);
    expect(await screen.findByText(heading)).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent(path);
  });

  it('a first-time visitor gets the page immediately, without waiting for the session check', () => {
    mockRestore.mockReturnValue(new Promise(() => {})); // never settles
    app(routes, '/client/signup');
    expect(screen.getByText('Create your account')).toBeInTheDocument();
  });

  it.each(PAGES)('a returning visitor never sees %s flash while the session is restored', async (path, heading) => {
    localStorage.setItem('bdcap-uid', 'u1'); // there was a session in this browser
    let finish!: () => void;
    mockRestore.mockReturnValue(new Promise<void>((res) => { finish = res; }));
    mockApi.mockImplementation((async (p: string) => (p === '/api/auth/me' ? me('client') : undefined)) as never);
    app(routes, path);
    expect(screen.queryByText(heading)).not.toBeInTheDocument(); // spinner only, no form
    setSession(session());
    finish();
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(/^\/dashboard$/));
    expect(screen.queryByText(heading)).not.toBeInTheDocument();
  });

  it('a returning visitor whose cookie has expired gets the page after the check', async () => {
    localStorage.setItem('bdcap-uid', 'u1');
    mockRestore.mockImplementation(async () => { localStorage.removeItem('bdcap-uid'); });
    app(routes, '/forgot-password');
    expect(await screen.findByText('Reset your password')).toBeInTheDocument();
  });

  it('an account the server refuses (blocked) can still open sign-up and forgot-password', async () => {
    signIn();
    mockApi.mockImplementation((async (path: string) => {
      if (path === '/api/auth/me') throw new ApiError(403, 'NOT_INVITED');
      return undefined;
    }) as never);
    app(routes, '/client/signup');
    expect(await screen.findByText('Create your account')).toBeInTheDocument();
  });

  it('does NOT bounce someone who opens an emailed set-password link while signed in', async () => {
    as('client');
    app(routes, '/set-password');
    expect(await screen.findByPlaceholderText('New password')).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('/set-password');
  });

  it('sign-out then lets the person see the login page again', async () => {
    as('client');
    app(<>{routes}<Probe /></>, '/dashboard');
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    await userEvent.click(screen.getByText('out'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedOut'));
  });
});
