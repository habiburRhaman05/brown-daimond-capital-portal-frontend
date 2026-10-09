import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api', async (orig) => ({ ...(await orig<typeof import('../lib/api')>()), api: vi.fn(), apiUpload: vi.fn() }));

import { AuthProvider } from '../auth/AuthProvider';
import { Layout } from '../components/Layout';
import { ToastProvider } from '../components/Toast';
import { api, apiUpload } from '../lib/api';
import { clearSession, setSession } from '../lib/session';
import { Account } from './Account';

const base = { id: 'u1', email: 'ada@example.com', role: 'client' as const, fullName: 'Ada Lovelace', avatarUrl: '', phone: '' };

function serve(user: typeof base & { avatarUrl: string }, extra: Record<string, unknown> = {}) {
  vi.mocked(api).mockImplementation((async (path: string) => {
    if (path === '/api/auth/me') return { user };
    return extra[path] ?? {};
  }) as never);
}

function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/dashboard/account']}>
          <AuthProvider>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/dashboard/account" element={<Account />} />
              </Route>
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const picker = (c: HTMLElement) => c.querySelector('input[type="file"]') as HTMLInputElement;
const png = () => new File(['x'], 'me.png', { type: 'image/png' });

beforeEach(() => {
  clearSession();
  setSession({ access_token: 'a', refresh_token: 'r', expires_at: 9_999_999_999, user: { id: 'u1', email: base.email } });
  vi.mocked(api).mockReset();
  vi.mocked(apiUpload).mockReset();
  serve(base);
});

// Regression: the picture used to disappear right after "Save picture" (and the sidebar kept the
// old name/photo) because the page read stale user state until the next reload.
describe('Account inside the real auth provider', () => {
  it('keeps the new picture on screen after saving, in the page and in the sidebar', async () => {
    const url = 'https://signed.example/ada.png?sig=1';
    vi.mocked(apiUpload).mockResolvedValueOnce({ user: { ...base, avatarUrl: url } });
    const { container } = mount();
    await screen.findByPlaceholderText('Your full name');

    await userEvent.upload(picker(container), png());
    await userEvent.click(await screen.findByRole('button', { name: 'Save picture' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Change picture' })).toBeInTheDocument());
    expect(container.querySelectorAll(`img[src="${url}"]`).length).toBeGreaterThanOrEqual(2); // Account card + sidebar
  });

  it('removing the picture brings the initials back everywhere', async () => {
    serve({ ...base, avatarUrl: 'https://cdn.example/a.png' });
    const { container } = mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Upload picture' })).toBeInTheDocument());
    expect(container.querySelector('img[src="https://cdn.example/a.png"]')).toBeNull();
    expect(screen.getAllByText('AL').length).toBeGreaterThanOrEqual(2);
  });

  it('a saved name shows up in the sidebar immediately', async () => {
    serve(base, { '/api/auth/profile': { user: { ...base, fullName: 'Grace Hopper', phone: '555' } } });
    mount();
    const name = await screen.findByPlaceholderText('Your full name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Grace Hopper');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.getAllByText('GH').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Grace Hopper').length).toBeGreaterThan(0);
  });

  it('a failed upload leaves the current picture untouched', async () => {
    serve({ ...base, avatarUrl: 'https://cdn.example/a.png' });
    vi.mocked(apiUpload).mockRejectedValueOnce(new Error('network'));
    const { container } = mount();
    await screen.findByRole('button', { name: 'Change picture' });
    await userEvent.upload(picker(container), png());
    await userEvent.click(await screen.findByRole('button', { name: 'Save picture' }));
    await screen.findByText('Something went wrong. Please try again.');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(container.querySelector('img[src="https://cdn.example/a.png"]')).not.toBeNull();
  });
});
