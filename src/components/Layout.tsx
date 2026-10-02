import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { Button } from './ui';

const link = ({ isActive }: { isActive: boolean }) =>
  `block rounded-md px-3 py-2 text-sm font-medium md:py-1.5 ${isActive ? 'bg-brand/10 text-brand' : 'text-muted hover:text-ink'}`;

const CLIENT_NAV = [
  { to: '/dashboard', label: 'Dashboard', end: true },
  { to: '/dashboard/information', label: 'My information' },
  { to: '/dashboard/website', label: 'My website' },
  { to: '/dashboard/requests', label: 'Change requests' },
  { to: '/dashboard/account', label: 'Account' },
];

const ADMIN_NAV = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/clients', label: 'Clients' },
  { to: '/admin/requests', label: 'Change requests' },
  { to: '/admin/invites', label: 'Invites' },
  { to: '/admin/account', label: 'Account' },
];

export function Layout() {
  const { state, signOut } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Close the mobile menu whenever the page changes.
  useEffect(() => setMenuOpen(false), [location.pathname]);

  if (state.status !== 'ready') return null;
  const nav = state.user.role === 'admin' ? ADMIN_NAV : CLIENT_NAV;

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-6">
            <NavLink to="/" aria-label="Brown Diamond Capital" className="shrink-0">
              <img src="/assets/secondary-logo-dark.png" alt="Brown Diamond Capital" width={144} height={32} className="h-8 w-36 object-contain object-left" />
            </NavLink>
            <nav className="hidden flex-wrap gap-1 md:flex" aria-label="Main">
              {nav.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} className={link}>{n.label}</NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2 text-sm sm:gap-3">
            {state.user.role === 'admin' && <span className="rounded bg-ink px-2 py-0.5 text-xs font-semibold text-white">Admin</span>}
            <span className="hidden max-w-[14rem] truncate text-muted lg:inline">{state.user.email}</span>
            <Button variant="ghost" className="shrink-0 whitespace-nowrap !px-3 !py-1.5 font-medium" loading={signingOut} loadingText="Signing out…" onClick={handleSignOut}>
              Sign out
            </Button>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line md:hidden"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="border-t border-line bg-white px-4 py-2 md:hidden" aria-label="Main">
            <p className="truncate px-3 py-1 text-xs text-muted">{state.user.email}</p>
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={link}>{n.label}</NavLink>
            ))}
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-5 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
