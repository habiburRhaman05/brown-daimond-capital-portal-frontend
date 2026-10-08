import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { Button } from './ui';

const CLIENT_NAV = [
  { to: '/dashboard', label: 'Dashboard', end: true, icon: <><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></> },
  { to: '/dashboard/information', label: 'My information', icon: <><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></> },
  { to: '/dashboard/website', label: 'My website', icon: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4v5"/></> },
  { to: '/dashboard/requests', label: 'Change requests', icon: <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/> },
  { to: '/dashboard/account', label: 'Account', icon: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09c.46.1.86.38 1.1.7"/></> },
];

const ADMIN_NAV = [
  { to: '/admin', label: 'Overview', end: true, icon: <><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></> },
  { to: '/admin/clients', label: 'Clients', icon: <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></> },
  { to: '/admin/requests', label: 'Change requests', icon: <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/> },
  { to: '/admin/invites', label: 'Invites', icon: <><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></> },
  { to: '/admin/account', label: 'Account', icon: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09c.46.1.86.38 1.1.7"/></> },
];

function NavIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-85" aria-hidden="true">
      {children}
    </svg>
  );
}

export function Layout() {
  const { state, signOut } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  if (state.status !== 'ready') return null;
  const isAdmin = state.user.role === 'admin';
  const nav = isAdmin ? ADMIN_NAV : CLIENT_NAV;
  const displayName = state.user.fullName || state.user.email?.split('@')[0] || 'Account';
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'A';
  const avatarUrl = state.user.avatarUrl;

  async function handleSignOut() {
    setSigningOut(true);
    try { await signOut(); } finally { setSigningOut(false); }
  }

  const sidebarContent = (
    <>
      <div>
        <div className="flex items-center gap-2.5 px-2.5 pb-8 pt-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-gold/45 bg-gold/18 text-xs font-bold text-gold-light">BD</div>
          <div className="text-xs font-bold uppercase tracking-[1.5px] text-[#D9D4C6]">{isAdmin ? 'Admin' : 'Client Portal'}</div>
        </div>
        <nav className="flex flex-col gap-0.5 pl-3.5" aria-label="Main">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `group relative flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-[13.5px] font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-gradient-to-r from-gold/18 to-gold/6 font-semibold text-white'
                    : 'text-white/68 hover:bg-white/7 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute -left-3.5 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-sm bg-gold shadow-[0_0_8px_rgba(200,168,117,0.6)]" />
                  )}
                  <NavIcon>{n.icon}</NavIcon>
                  {n.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-2.5 rounded-[14px] bg-white/6 p-2.5">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-xl object-cover" />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold/20 text-xs font-bold text-gold-light">{initials}</div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] font-semibold text-white">{displayName}</div>
          <div className="truncate text-[11px] text-white/50">{state.user.email}</div>
        </div>
        <Button
          variant="ghost"
          className="!border-0 !bg-transparent !p-1.5 !shadow-none text-white/55 hover:!bg-white/12 hover:!text-white"
          loading={signingOut}
          loadingText=""
          onClick={handleSignOut}
          aria-label="Sign out"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
          </svg>
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col justify-between bg-gradient-to-b from-brand-light to-brand-dark p-5 lg:flex">
        {sidebarContent}
      </aside>

      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-line bg-white/78 px-4 py-3 backdrop-blur-[14px] lg:hidden">
        <NavLink to="/" aria-label="Brown Diamond Capital" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-gold/45 bg-brand text-[10px] font-bold text-gold-light">BD</div>
          <span className="text-sm font-semibold text-ink">BDCap Portal</span>
        </NavLink>
        <button
          type="button"
          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-line"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {/* Mobile slide-out sidebar */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMenuOpen(false)} />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col justify-between bg-gradient-to-b from-brand-light to-brand-dark p-5 shadow-2xl lg:hidden">
            {sidebarContent}
          </aside>
        </>
      )}

      {/* Main content */}
      <main className="min-w-0 flex-1 pt-16 lg:pt-0">
        <div className="animate-fade-in px-5 py-8 sm:px-8 lg:px-11 lg:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
