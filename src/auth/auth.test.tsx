import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api', async (orig) => ({ ...(await orig<typeof import('../lib/api')>()), api: vi.fn() }));

import { api, ApiError } from '../lib/api';
import { clearSession, getSession, setSession } from '../lib/session';
import { Login } from '../pages/Login';
import { AuthProvider, useAuth } from './AuthProvider';
import { homeFor, loginFor, Protected, HomeRedirect } from './Guards';

const mockApi = vi.mocked(api);
const session = (over: Record<string, unknown> = {}) => ({
  access_token: 'tok', refresh_token: 'ref', expires_at: 9_999_999_999, user: { id: 'u1', email: 'a@b.co' }, ...over,
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

beforeEach(() => {
  clearSession();
  mockApi.mockReset();
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
  it('is signed out without a session and never calls the API', () => {
    app(<Probe />);
    expect(screen.getByTestId('status')).toHaveTextContent('signedOut');
    expect(screen.getByTestId('has')).toHaveTextContent('false');
    expect(mockApi).not.toHaveBeenCalled();
  });

  it('loads the user for a stored session', async () => {
    setSession(session());
    mockApi.mockResolvedValueOnce(me('admin'));
    app(<Probe />);
    expect(screen.getByTestId('status')).toHaveTextContent('loading');
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    expect(screen.getByTestId('role')).toHaveTextContent('admin');
    expect(mockApi).toHaveBeenCalledWith('/api/auth/me');
  });

  it.each([[403, 'NOT_INVITED'], [401, 'SESSION_EXPIRED']])('blocks on a %i with the server code', async (status, code) => {
    setSession(session());
    mockApi.mockRejectedValueOnce(new ApiError(status, code));
    app(<Probe />);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('blocked'));
    expect(screen.getByTestId('code')).toHaveTextContent(code);
  });

  it('blocks with REQUEST_FAILED on a network or server error', async () => {
    setSession(session());
    mockApi.mockRejectedValueOnce(new TypeError('offline'));
    app(<Probe />);
    await waitFor(() => expect(screen.getByTestId('code')).toHaveTextContent('REQUEST_FAILED'));
  });

  it('reacts to the session being cleared elsewhere (another tab or an expired refresh)', async () => {
    setSession(session());
    mockApi.mockResolvedValueOnce(me());
    app(<Probe />);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    clearSession();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedOut'));
  });

  it('does not re-ask /me when the token refreshes for the same user... but does when it changes', async () => {
    setSession(session());
    mockApi.mockResolvedValue(me());
    app(<Probe />);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    const before = mockApi.mock.calls.length;
    setSession(session({ access_token: 'tok2' }));
    await waitFor(() => expect(mockApi.mock.calls.length).toBeGreaterThan(before)); // new token -> re-verify role
  });

  it('signOut calls logout, wipes session and portal drafts', async () => {
    setSession(session());
    localStorage.setItem('bdcap-form-v1', 'draft');
    localStorage.setItem('bdcap-draft-owner', 'u1');
    mockApi.mockResolvedValueOnce(me()).mockResolvedValueOnce({ ok: true });
    app(<Probe />);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    await userEvent.click(screen.getByText('out'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedOut'));
    expect(mockApi).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
    expect(getSession()).toBeNull();
    expect(localStorage.getItem('bdcap-form-v1')).toBeNull();
    expect(localStorage.getItem('bdcap-draft-owner')).toBeNull();
  });

  it('signOut still signs the browser out when the logout request fails', async () => {
    setSession(session());
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
    setSession(session());
    mockApi.mockReturnValue(new Promise(() => {}));
    app(routes, '/dashboard');
    expect(screen.queryByText('CLIENT AREA')).not.toBeInTheDocument();
  });

  it('lets the right role in', async () => {
    setSession(session());
    mockApi.mockResolvedValueOnce(me('client'));
    app(routes, '/dashboard');
    expect(await screen.findByText('CLIENT AREA')).toBeInTheDocument();
  });

  it('keeps a client out of /admin and bounces them to their dashboard', async () => {
    setSession(session());
    mockApi.mockResolvedValueOnce(me('client'));
    app(routes, '/admin');
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/dashboard'));
    expect(screen.queryByText('ADMIN AREA')).not.toBeInTheDocument();
  });

  it('keeps an admin out of the client area', async () => {
    setSession(session());
    mockApi.mockResolvedValueOnce(me('admin'));
    app(routes, '/dashboard');
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/admin'));
  });

  it('shows a blocked screen with the reason and a sign-out button', async () => {
    setSession(session());
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
    setSession(session());
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
    expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument();
    expect(getSession()).toBeNull();
    expect(screen.getByRole('button', { name: /^Sign in/ })).toBeEnabled(); // can try again
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
    await screen.findByText('Invalid email or password.');
    expect(screen.queryByRole('button', { name: 'Resend verification email' })).not.toBeInTheDocument();
  });

  it('shows a generic message when the server is down', async () => {
    mockApi.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    app(routes, '/client/login');
    await userEvent.type(email(), 'a@b.co');
    await userEvent.type(pass(), 'x');
    await submit();
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
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
    setSession(session());
    mockApi.mockResolvedValueOnce(me('client'));
    app(routes, '/client/login');
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/dashboard'));
  });

  it('sends a signed-in client who opens the admin login to their own home', async () => {
    setSession(session());
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
