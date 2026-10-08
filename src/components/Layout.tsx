import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { Button } from './ui';
import { Footer } from './Footer';

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
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  // Close the mobile menu whenever the page changes.
  useEffect(() => setMenuOpen(false), [location.pathname]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!profileMenuRef.current || profileMenuRef.current.contains(event.target as Node)) return;
      setProfileMenuOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  if (state.status !== 'ready') return null;
  const nav = state.user.role === 'admin' ? ADMIN_NAV : CLIENT_NAV;
  const displayName = state.user.email?.split('@')[0] || 'Account';
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'A';

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
      setProfileMenuOpen(false);
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

          <div className="flex items-center gap-2 sm:gap-3">
            {state.user.role === 'admin' && <span className="rounded bg-ink px-2 py-0.5 text-xs font-semibold text-white">Admin</span>}

            <div ref={profileMenuRef} className="relative">
              <button
                type="button"
                aria-label="Open account menu"
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
                onClick={() => setProfileMenuOpen((o) => !o)}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line bg-paper p-1.5 text-left shadow-sm transition hover:bg-gray-50"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">{initials}</span>
                <span className="hidden pr-1 text-xs font-medium text-muted sm:inline">Account</span>
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-line bg-white p-3 shadow-xl">
                  <div className="flex items-center gap-3 border-b border-line pb-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">{initials}</span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-ink">{displayName}</div>
                      <div className="truncate text-xs text-muted">{state.user.email}</div>
                    </div>
                  </div>

                  <div className="pt-3">
                    <Button
                      variant="ghost"
                      className="w-full justify-center !rounded-lg !border !border-line !bg-white !px-3 !py-2 text-sm font-medium text-ink hover:bg-paper"
                      loading={signingOut}
                      loadingText="Signing out…"
                      onClick={handleSignOut}
                    >
                      Sign out
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-line md:hidden"
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
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={link}>{n.label}</NavLink>
            ))}
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-5 sm:py-8">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
