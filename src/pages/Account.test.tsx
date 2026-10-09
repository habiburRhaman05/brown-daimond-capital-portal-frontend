import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MeUser } from '../lib/types';

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), show: vi.fn() }));
const auth = vi.hoisted(() => ({ state: { status: 'loading' } as { status: string; user?: unknown }, updateUser: vi.fn() }));

vi.mock('../components/Toast', () => ({ useToast: () => toast }));
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ state: auth.state, updateUser: auth.updateUser }) }));
vi.mock('../lib/api', async (orig) => ({
  ...(await orig<typeof import('../lib/api')>()),
  api: vi.fn(),
  apiUpload: vi.fn(),
}));

import { api, apiUpload, ApiError } from '../lib/api';
import { clearSession, getSession, setSession } from '../lib/session';
import { Account } from './Account';

const me = (over: Partial<MeUser> = {}): MeUser => ({
  id: 'u1', email: 'ada@example.com', role: 'client', fullName: 'Ada Lovelace', avatarUrl: '', phone: '', ...over,
});

function setUser(user: MeUser) {
  auth.state = { status: 'ready', user };
  setSession({ access_token: 'a', refresh_token: 'r', expires_at: 9_999_999_999, user: { id: user.id, email: user.email, fullName: user.fullName, avatarUrl: user.avatarUrl } });
}

const file = (name: string, type: string, bytes = 10) => new File([new Uint8Array(bytes)], name, { type });
const fileInput = (c: HTMLElement) => c.querySelector('input[type="file"]') as HTMLInputElement;

beforeEach(() => {
  clearSession();
  setUser(me());
  vi.mocked(api).mockReset();
  vi.mocked(apiUpload).mockReset();
  Object.values(toast).forEach((f) => f.mockReset());
  auth.updateUser.mockReset();
});

describe('Account: rendering', () => {
  it('renders nothing until the user is loaded', () => {
    auth.state = { status: 'loading' };
    const { container } = render(<Account />);
    expect(container).toBeEmptyDOMElement();
  });

  it('prefills name and phone and locks the email field', () => {
    setUser(me({ phone: '555-0100' }));
    render(<Account />);
    expect(screen.getByPlaceholderText('Your full name')).toHaveValue('Ada Lovelace');
    expect(screen.getByPlaceholderText('Phone number')).toHaveValue('555-0100');
    expect(screen.getByDisplayValue('ada@example.com')).toBeDisabled();
  });

  it('shows initials when there is no avatar', () => {
    render(<Account />);
    expect(screen.getByText('AL')).toBeInTheDocument();
    expect(screen.queryByAltText('Avatar')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload picture' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
  });

  it('falls back to the email local-part for initials when the name is empty', () => {
    setUser(me({ fullName: '' }));
    render(<Account />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('shows the avatar with Change and Remove when one exists', () => {
    setUser(me({ avatarUrl: 'https://cdn.example/a.png' }));
    render(<Account />);
    expect(screen.getByAltText('Avatar')).toHaveAttribute('src', 'https://cdn.example/a.png');
    expect(screen.getByRole('button', { name: 'Change picture' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });
});

describe('Account: avatar upload', () => {
  it('rejects a file over 2 MB before it reaches the network', async () => {
    const { container } = render(<Account />);
    await userEvent.upload(fileInput(container), file('big.png', 'image/png', 2 * 1024 * 1024 + 1));
    expect(toast.error).toHaveBeenCalledWith('Maximum file size is 2 MB.');
    expect(screen.queryByRole('button', { name: 'Save picture' })).not.toBeInTheDocument();
    expect(apiUpload).not.toHaveBeenCalled();
  });

  it('accepts a file of exactly 2 MB', async () => {
    const { container } = render(<Account />);
    await userEvent.upload(fileInput(container), file('edge.png', 'image/png', 2 * 1024 * 1024));
    expect(await screen.findByRole('button', { name: 'Save picture' })).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('ignores file types the picker is not supposed to allow', async () => {
    const { container } = render(<Account />);
    await userEvent.upload(fileInput(container), file('notes.txt', 'text/plain'));
    expect(screen.queryByRole('button', { name: 'Save picture' })).not.toBeInTheDocument();
  });

  it('does nothing when the file dialog is cancelled', async () => {
    const { container } = render(<Account />);
    await userEvent.upload(fileInput(container), []);
    expect(screen.getByRole('button', { name: 'Upload picture' })).toBeInTheDocument();
  });

  it('previews a chosen picture and Cancel puts the old state back', async () => {
    const { container } = render(<Account />);
    await userEvent.upload(fileInput(container), file('me.png', 'image/png'));
    expect(await screen.findByAltText('Avatar')).toHaveAttribute('src', expect.stringMatching(/^data:/));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByAltText('Avatar')).not.toBeInTheDocument();
    expect(screen.getByText('AL')).toBeInTheDocument();
    expect(apiUpload).not.toHaveBeenCalled();
  });

  it('uploads the file as multipart, stores the returned URL, and confirms', async () => {
    vi.mocked(apiUpload).mockResolvedValueOnce({ user: me({ avatarUrl: 'https://signed.example/a.png?sig=1' }) });
    const { container } = render(<Account />);
    const png = file('me.png', 'image/png');
    await userEvent.upload(fileInput(container), png);
    await userEvent.click(await screen.findByRole('button', { name: 'Save picture' }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Profile picture updated.'));
    const [path, body] = vi.mocked(apiUpload).mock.calls[0];
    expect(path).toBe('/api/auth/avatar');
    expect((body as FormData).get('file')).toBe(png);
    expect(getSession()?.user.avatarUrl).toBe('https://signed.example/a.png?sig=1');
    expect(auth.updateUser).toHaveBeenCalledWith({ avatarUrl: 'https://signed.example/a.png?sig=1' });
  });

  it.each([
    ['INVALID_FILE_TYPE', 'Only JPEG, PNG, WebP or GIF images are allowed.'],
    ['FILE_TOO_LARGE', 'Maximum file size is 2 MB.'],
    ['UPLOAD_FAILED', 'Could not upload the file. Please try again.'],
    ['STORAGE_NOT_CONFIGURED', 'Avatar upload is not available right now.'],
  ])('shows a friendly message for %s and keeps the pending picture', async (code, message) => {
    vi.mocked(apiUpload).mockRejectedValueOnce(new ApiError(400, code));
    const { container } = render(<Account />);
    await userEvent.upload(fileInput(container), file('me.png', 'image/png'));
    await userEvent.click(await screen.findByRole('button', { name: 'Save picture' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message));
    expect(screen.getByRole('button', { name: 'Save picture' })).toBeEnabled(); // can retry
    expect(getSession()?.user.avatarUrl).toBe('');
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it('handles a network failure without crashing', async () => {
    vi.mocked(apiUpload).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const { container } = render(<Account />);
    await userEvent.upload(fileInput(container), file('me.png', 'image/png'));
    await userEvent.click(await screen.findByRole('button', { name: 'Save picture' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Something went wrong. Please try again.'));
  });

  it('removes the picture with DELETE and clears it from the session', async () => {
    setUser(me({ avatarUrl: 'https://cdn.example/a.png' }));
    vi.mocked(api).mockResolvedValueOnce({});
    render(<Account />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Profile picture removed.'));
    expect(api).toHaveBeenCalledWith('/api/auth/avatar', { method: 'DELETE' });
    expect(getSession()?.user.avatarUrl).toBe('');
    expect(auth.updateUser).toHaveBeenCalledWith({ avatarUrl: '' });
  });

  it('keeps the picture when removal fails', async () => {
    setUser(me({ avatarUrl: 'https://cdn.example/a.png' }));
    vi.mocked(api).mockRejectedValueOnce(new ApiError(500, 'X'));
    render(<Account />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(getSession()?.user.avatarUrl).toBe('https://cdn.example/a.png');
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
});

describe('Account: profile form', () => {
  it('saves name and phone and updates the session', async () => {
    vi.mocked(api).mockResolvedValueOnce({ user: me({ fullName: 'Ada B', phone: '555' }) });
    render(<Account />);
    const name = screen.getByPlaceholderText('Your full name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Ada B');
    await userEvent.type(screen.getByPlaceholderText('Phone number'), '555');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Profile updated.'));
    expect(api).toHaveBeenCalledWith('/api/auth/profile', { method: 'PUT', body: { fullName: 'Ada B', phone: '555' } });
    expect(getSession()?.user).toMatchObject({ fullName: 'Ada B', phone: '555' });
    expect(auth.updateUser).toHaveBeenCalledWith({ fullName: 'Ada B', phone: '555' });
  });

  it('can clear the phone number (sends an empty string, not undefined)', async () => {
    setUser(me({ phone: '555' }));
    vi.mocked(api).mockResolvedValueOnce({ user: me({ phone: '' }) });
    render(<Account />);
    await userEvent.clear(screen.getByPlaceholderText('Phone number'));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api).toHaveBeenCalled());
    expect(vi.mocked(api).mock.calls[0][1]).toMatchObject({ body: { phone: '' } });
  });

  it('shows an error and leaves the session alone when saving fails', async () => {
    vi.mocked(api).mockRejectedValueOnce(new ApiError(500, 'BOOM'));
    render(<Account />);
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe('Account: change password', () => {
  const fill = async (cur: string, next: string, again: string) => {
    await userEvent.type(screen.getByPlaceholderText('Current password'), cur);
    await userEvent.type(screen.getByPlaceholderText('New password'), next);
    await userEvent.type(screen.getByPlaceholderText('Repeat new password'), again);
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
  };

  it('blocks a new password shorter than 8 characters without calling the API', async () => {
    render(<Account />);
    await fill('oldpass', 'short', 'short');
    expect(await screen.findByRole('alert')).toHaveTextContent('Use at least 8 characters.');
    expect(api).not.toHaveBeenCalled();
  });

  it('blocks a mismatched confirmation', async () => {
    render(<Account />);
    await fill('oldpass', 'LongEnough1', 'LongEnough2');
    expect(await screen.findByRole('alert')).toHaveTextContent('do not match');
    expect(api).not.toHaveBeenCalled();
  });

  it('accepts exactly 8 characters', async () => {
    vi.mocked(api).mockResolvedValueOnce({ session: { access_token: 'n', refresh_token: 'n', expires_at: 9_999_999_999, user: { id: 'u1', email: 'ada@example.com' } } });
    render(<Account />);
    await fill('oldpass', '12345678', '12345678');
    await waitFor(() => expect(api).toHaveBeenCalled());
  });

  it('swaps in the fresh session, clears the form and confirms', async () => {
    vi.mocked(api).mockResolvedValueOnce({ session: { access_token: 'NEW', refresh_token: 'NEWR', expires_at: 9_999_999_999, user: { id: 'u1', email: 'ada@example.com' } } });
    render(<Account />);
    await fill('oldpass', 'BrandNew123!', 'BrandNew123!');
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Password changed.'));
    expect(api).toHaveBeenCalledWith('/api/auth/change-password', { method: 'POST', body: { currentPassword: 'oldpass', newPassword: 'BrandNew123!' } });
    expect(getSession()?.access_token).toBe('NEW');
    expect(screen.getByPlaceholderText('Current password')).toHaveValue('');
    expect(screen.getByPlaceholderText('New password')).toHaveValue('');
    expect(screen.getByText(/Any other devices were signed out/)).toBeInTheDocument();
  });

  it.each([
    ['WRONG_PASSWORD', 'Your current password is not correct.'],
    ['SAME_PASSWORD', 'Choose a password you have not used just now.'],
    ['WEAK_PASSWORD', 'Use at least 8 characters.'],
  ])('shows the server rejection %s and keeps what was typed', async (code, message) => {
    vi.mocked(api).mockRejectedValueOnce(new ApiError(400, code));
    render(<Account />);
    await fill('oldpass', 'BrandNew123!', 'BrandNew123!');
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByPlaceholderText('Current password')).toHaveValue('oldpass');
  });

  it('clears a previous error when the user tries again', async () => {
    render(<Account />);
    await fill('old', 'short', 'short');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    vi.mocked(api).mockResolvedValueOnce({ session: { access_token: 'n', refresh_token: 'n', expires_at: 9_999_999_999, user: { id: 'u1', email: 'e' } } });
    await userEvent.clear(screen.getByPlaceholderText('New password'));
    await userEvent.clear(screen.getByPlaceholderText('Repeat new password'));
    await userEvent.type(screen.getByPlaceholderText('New password'), 'LongEnough1');
    await userEvent.type(screen.getByPlaceholderText('Repeat new password'), 'LongEnough1');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
});
