import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api', async (orig) => ({ ...(await orig<typeof import('../lib/api')>()), api: vi.fn(), restoreSession: vi.fn() }));

import { AuthProvider } from '../auth/AuthProvider';
import { api, ApiError, restoreSession } from '../lib/api';
import { clearSession, setSession } from '../lib/session';
import { EmailVerified } from './EmailVerified';
import { ForgotPassword } from './ForgotPassword';
import { Login } from './Login';
import { SetPassword } from './SetPassword';
import { Signup } from './Signup';

const mockApi = vi.mocked(api);
const mockRestore = vi.mocked(restoreSession);

function mount(ui: React.ReactNode, path = '/') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>{ui}</AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  clearSession();
  mockApi.mockReset();
  mockRestore.mockReset().mockResolvedValue(undefined);
});

async function fillSignup(over: Partial<Record<'name' | 'email' | 'pw' | 'confirm', string>> = {}) {
  const v = { name: 'Ada Lovelace', email: 'Ada@Example.com', pw: 'LongEnough1', confirm: 'LongEnough1', ...over };
  await userEvent.type(screen.getByPlaceholderText('Full name'), v.name);
  await userEvent.type(screen.getByPlaceholderText('Email address'), v.email);
  await userEvent.type(screen.getByPlaceholderText('Password (8+ characters)'), v.pw);
  await userEvent.type(screen.getByPlaceholderText('Repeat password'), v.confirm);
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
}

describe('Signup', () => {
  it('creates the account with a normalised email and shows the check-your-email screen', async () => {
    mockApi.mockResolvedValueOnce({ ok: true });
    mount(<Signup />);
    await fillSignup({ name: '  Ada Lovelace ' });
    expect(await screen.findByText('Check your email')).toBeInTheDocument();
    expect(mockApi).toHaveBeenCalledWith('/api/auth/signup', { method: 'POST', body: { fullName: 'Ada Lovelace', email: 'ada@example.com', password: 'LongEnough1' } });
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
  });

  it('says the email is already registered, with links to sign in or reset the password', async () => {
    mockApi.mockRejectedValueOnce(new ApiError(409, 'EMAIL_EXISTS'));
    mount(<Signup />);
    await fillSignup();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('An account with this email already exists.');
    expect(within(alert).getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/client/login');
    expect(within(alert).getByRole('link', { name: 'reset your password' })).toHaveAttribute('href', '/forgot-password');
    expect(screen.queryByText('Check your email')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled(); // can correct the address
  });

  it('moves a registered-but-unverified address to the inbox screen (a new link was just sent)', async () => {
    mockApi.mockRejectedValueOnce(new ApiError(409, 'EMAIL_NOT_VERIFIED'));
    mount(<Signup />);
    await fillSignup();
    expect(await screen.findByText('Check your email')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resend the email' })).toBeInTheDocument();
  });

  it.each([
    ['INVALID_EMAIL', 'Enter a valid email address.'],
    ['NAME_REQUIRED', 'Please enter your full name.'],
    ['WEAK_PASSWORD', 'Use at least 8 characters.'],
  ])('shows the server validation error %s', async (code, text) => {
    mockApi.mockRejectedValueOnce(new ApiError(400, code));
    mount(<Signup />);
    await fillSignup();
    expect(await screen.findByRole('alert')).toHaveTextContent(text);
  });

  it('reports an unreachable server', async () => {
    mockApi.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    mount(<Signup />);
    await fillSignup();
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server');
  });

  it('validates the passwords locally before calling the API', async () => {
    mount(<Signup />);
    await fillSignup({ pw: 'LongEnough1', confirm: 'Different123' });
    expect(await screen.findByRole('alert')).toHaveTextContent('do not match');
    expect(mockApi).not.toHaveBeenCalled();
  });

  it('clears the old error and its links on the next attempt', async () => {
    mockApi.mockRejectedValueOnce(new ApiError(409, 'EMAIL_EXISTS')).mockResolvedValueOnce({ ok: true });
    mount(<Signup />);
    await fillSignup();
    await within(await screen.findByRole('alert')).findByRole('link', { name: 'Sign in' });
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await screen.findByText('Check your email');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('can resend the verification email from the inbox screen', async () => {
    mockApi.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: true });
    mount(<Signup />);
    await fillSignup();
    await userEvent.click(await screen.findByRole('button', { name: 'Resend the email' }));
    expect(await screen.findByText(/Sent again/)).toBeInTheDocument();
    expect(mockApi).toHaveBeenLastCalledWith('/api/auth/resend-verification', { method: 'POST', body: { email: 'ada@example.com' } });
  });
});

describe('ForgotPassword', () => {
  it('always confirms in the same neutral words', async () => {
    mockApi.mockResolvedValueOnce({ ok: true });
    mount(<ForgotPassword />);
    await userEvent.type(screen.getByPlaceholderText('Email address'), ' Someone@X.co ');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByText(/If that email has an account, a reset link is on its way/)).toBeInTheDocument();
    expect(mockApi).toHaveBeenCalledWith('/api/auth/forgot-password', { method: 'POST', body: { email: 'someone@x.co' } });
  });

  it('shows the same message even if the request fails', async () => {
    mockApi.mockRejectedValueOnce(new TypeError('offline'));
    mount(<ForgotPassword />);
    await userEvent.type(screen.getByPlaceholderText('Email address'), 'a@b.co');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByText(/reset link is on its way/)).toBeInTheDocument();
  });
});

describe('SetPassword', () => {
  const signedIn = () => {
    mockRestore.mockImplementation(async () => { setSession({ access_token: 'a', expires_at: 9_999_999_999, user: { id: 'u1', email: 'a@b.co' } }); });
    mockApi.mockImplementation((async (path: string) => (path === '/api/auth/me' ? { user: { id: 'u1', email: 'a@b.co', role: 'client', fullName: '', avatarUrl: '', phone: '' } } : { ok: true })) as never);
  };

  it('shows the expired-link page without a session (after the restore attempt settles)', async () => {
    mount(<SetPassword />);
    expect(await screen.findByText('This link has expired')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Send me a new link' })).toHaveAttribute('href', '/forgot-password');
  });

  it('rejects short and mismatched passwords locally', async () => {
    signedIn();
    mount(<SetPassword />);
    await userEvent.type(await screen.findByPlaceholderText('New password'), 'short');
    await userEvent.type(screen.getByPlaceholderText('Repeat password'), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Save password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Use at least 8 characters.');
    expect(mockApi).not.toHaveBeenCalledWith('/api/auth/set-password', expect.anything());
  });

  it('shows the server error when saving fails', async () => {
    mockApi.mockImplementation((async (path: string) => {
      if (path === '/api/auth/me') return { user: { id: 'u1', email: 'a@b.co', role: 'client', fullName: '', avatarUrl: '', phone: '' } };
      throw new ApiError(400, 'WEAK_PASSWORD');
    }) as never);
    mockRestore.mockImplementation(async () => { setSession({ access_token: 'a', expires_at: 9_999_999_999, user: { id: 'u1', email: 'a@b.co' } }); });
    mount(<SetPassword />);
    await userEvent.type(await screen.findByPlaceholderText('New password'), 'LongEnough1');
    await userEvent.type(screen.getByPlaceholderText('Repeat password'), 'LongEnough1');
    await userEvent.click(screen.getByRole('button', { name: 'Save password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Use at least 8 characters.');
  });
});

describe('EmailVerified', () => {
  it.each([
    ['', 'Email verified'],
    ['?status=already', 'Already verified'],
    ['?status=expired', 'Link expired'],
  ])('renders the right state for %j', (qs, title) => {
    window.history.replaceState(null, '', '/email-verified' + qs);
    mount(<EmailVerified />, '/email-verified' + qs);
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
  });

  it('only offers the dashboard shortcut right after a fresh verification', () => {
    window.history.replaceState(null, '', '/email-verified');
    sessionStorage.setItem('bdcap-fresh-verify', '1');
    const { unmount } = mount(<EmailVerified />);
    expect(screen.getByRole('button', { name: 'Go to my profile' })).toBeInTheDocument();
    unmount();
    mount(<EmailVerified />); // the flag is consumed, so a reload or replay does not get it
    expect(screen.queryByRole('button', { name: 'Go to my profile' })).not.toBeInTheDocument();
  });
});

describe('header logo on every sign-in screen', () => {
  const logo = (alt = 'Brown Diamond Capital') => screen.getByAltText(alt);

  it('Login (dark brand panel) uses the light logo, like the sidebar header', () => {
    mount(<Login variant="client" />, '/client/login');
    expect(logo()).toHaveAttribute('src', '/assets/secondary-logo-light.png');
    expect(screen.queryByText('BD')).not.toBeInTheDocument();
  });

  it('Admin login uses it too', () => {
    mount(<Login variant="admin" />, '/admin/login');
    expect(logo()).toHaveAttribute('src', '/assets/secondary-logo-light.png');
  });

  it.each([
    ['Signup', <Signup key="s" />],
    ['ForgotPassword', <ForgotPassword key="f" />],
    ['SetPassword (expired link)', <SetPassword key="p" />],
    ['EmailVerified', <EmailVerified key="e" />],
  ])('%s (white card) uses the dark logo', async (_name, ui) => {
    mount(ui);
    expect(await screen.findByAltText('Brown Diamond Capital')).toHaveAttribute('src', '/assets/secondary-logo-dark.png');
    expect(screen.queryByText('BD')).not.toBeInTheDocument();
  });

  it('keeps the logo on the signup "check your email" screen', async () => {
    mockApi.mockResolvedValueOnce({ ok: true });
    mount(<Signup />);
    await fillSignup();
    await screen.findByText('Check your email');
    await waitFor(() => expect(logo()).toHaveAttribute('src', '/assets/secondary-logo-dark.png'));
  });
});
