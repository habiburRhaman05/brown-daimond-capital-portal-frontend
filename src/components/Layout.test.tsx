import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MeUser } from '../lib/types';

const signOut = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => ({ state: { status: 'loading' } as { status: string; user?: unknown } }));
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ state: auth.state, signOut }) }));

import { Layout } from './Layout';

const KEY = 'bdcap-sidebar';
const user = (over: Partial<MeUser> = {}): MeUser => ({ id: '1', email: 'ada@example.com', role: 'client', fullName: 'Ada Lovelace', avatarUrl: '', phone: '', ...over });

function mount(u: MeUser | null = user(), path = '/dashboard') {
  auth.state = u ? { status: 'ready', user: u } : { status: 'loading' };
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="*" element={<div>page body</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

const desktop = () => document.querySelector('aside') as HTMLElement;

beforeEach(() => {
  signOut.mockReset().mockResolvedValue(undefined);
});

describe('Layout: sidebar', () => {
  it('renders nothing until the user is loaded', () => {
    const { container } = mount(null);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows client navigation to a client and admin navigation to an admin', () => {
    const { unmount } = mount(user());
    const nav = within(screen.getByRole('navigation', { name: 'Main' }));
    expect(nav.getAllByRole('link').map((l) => l.textContent)).toEqual(['Dashboard', 'My information', 'My website', 'Change requests', 'Account']);
    expect(nav.queryByText('Clients')).not.toBeInTheDocument();
    unmount();

    mount(user({ role: 'admin' }));
    const adminNav = within(screen.getByRole('navigation', { name: 'Main' }));
    expect(adminNav.getAllByRole('link').map((l) => l.textContent)).toEqual(['Overview', 'Clients', 'Change requests', 'Invites', 'Account']);
  });

  it('starts expanded: wide, labelled, with the wordmark logo', () => {
    mount();
    expect(desktop().className).toContain('w-64');
    expect(within(desktop()).getByAltText('Brown Diamond Capital')).toHaveAttribute('src', '/assets/secondary-logo-light.png');
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
  });

  it('is sticky and full height so it never scrolls with the page', () => {
    mount();
    expect(desktop().className).toMatch(/sticky/);
    expect(desktop().className).toMatch(/top-0/);
    expect(desktop().className).toMatch(/h-screen/);
  });

  it('collapses to icons, swaps to the compact logo, and remembers the choice', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(desktop().className).toContain('w-[72px]');
    expect(within(desktop()).queryByText('Dashboard')).not.toBeInTheDocument();
    expect(within(desktop()).getByTitle('Dashboard')).toBeInTheDocument(); // tooltip keeps icons usable
    expect(within(desktop()).getByAltText('BD')).toHaveAttribute('src', '/assets/primary-logo-light.png');
    expect(localStorage.getItem(KEY)).toBe('collapsed');
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
  });

  it('expands again and persists that too', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    expect(desktop().className).toContain('w-64');
    expect(localStorage.getItem(KEY)).toBe('expanded');
  });

  it('restores a collapsed sidebar on reload', () => {
    localStorage.setItem(KEY, 'collapsed');
    mount();
    expect(desktop().className).toContain('w-[72px]');
  });

  it.each(['', 'garbage', 'expanded'])('treats the stored value %j as expanded', (v) => {
    if (v) localStorage.setItem(KEY, v);
    mount();
    expect(desktop().className).toContain('w-64');
  });

  it('defaults to expanded and keeps working when storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    mount();
    expect(desktop().className).toContain('w-64');
    await userEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(desktop().className).toContain('w-[72px]');
  });

  it('navigation links keep working in collapsed mode', async () => {
    localStorage.setItem(KEY, 'collapsed');
    mount(user(), '/dashboard');
    const link = within(desktop()).getByTitle('Account');
    expect(link).toHaveAttribute('href', '/dashboard/account');
  });

  it('marks only the current page active (Dashboard is not active on sub-pages)', () => {
    mount(user(), '/dashboard/account');
    const nav = within(screen.getByRole('navigation', { name: 'Main' }));
    expect(nav.getByText('Account').closest('a')?.className).toMatch(/font-semibold/);
    expect(nav.getByText('Dashboard').closest('a')?.className).not.toMatch(/font-semibold/);
  });
});

describe('Layout: user card', () => {
  it('shows name, email and initials', () => {
    mount();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByText('AL')).toBeInTheDocument();
  });

  it('falls back to the email local-part when there is no name', () => {
    mount(user({ fullName: '' }));
    expect(screen.getAllByText('ada').length).toBeGreaterThan(0);
  });

  it('uses at most two initials for long names', () => {
    mount(user({ fullName: 'Mary Jane Watson Parker' }));
    expect(screen.getByText('MJ')).toBeInTheDocument();
  });

  it('shows the profile picture instead of initials when set', () => {
    mount(user({ avatarUrl: 'https://cdn.example/a.png' }));
    expect(desktop().querySelector('img[src="https://cdn.example/a.png"]')).not.toBeNull();
    expect(screen.queryByText('AL')).not.toBeInTheDocument();
  });

  it('still shows the avatar in collapsed mode', () => {
    localStorage.setItem(KEY, 'collapsed');
    mount(user({ avatarUrl: 'https://cdn.example/a.png' }));
    expect(desktop().querySelector('img[src="https://cdn.example/a.png"]')).not.toBeNull();
  });

  it.each([['expanded'], ['collapsed']])('signs out from the %s sidebar', async (mode) => {
    localStorage.setItem(KEY, mode);
    mount();
    await userEvent.click(within(desktop()).getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
  });

});

describe('Layout: mobile', () => {
  it('opens and closes the slide-out menu', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getAllByRole('navigation', { name: 'Main' })).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(screen.getAllByRole('navigation', { name: 'Main' })).toHaveLength(1);
  });

  it('is always expanded on mobile even if the desktop sidebar is collapsed', async () => {
    localStorage.setItem(KEY, 'collapsed');
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const mobile = document.querySelectorAll('aside')[1] as HTMLElement;
    expect(within(mobile).getByText('Dashboard')).toBeInTheDocument();
  });

  it('closes the menu after navigating', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const mobile = document.querySelectorAll('aside')[1] as HTMLElement;
    await userEvent.click(within(mobile).getByText('Account'));
    await waitFor(() => expect(screen.getAllByRole('navigation', { name: 'Main' })).toHaveLength(1));
  });

  it('closes when the backdrop is tapped', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    await userEvent.click(document.querySelector('.bg-black\\/40') as HTMLElement);
    expect(screen.getAllByRole('navigation', { name: 'Main' })).toHaveLength(1);
  });

  it('renders the routed page', () => {
    mount();
    expect(screen.getByText('page body')).toBeInTheDocument();
  });
});
