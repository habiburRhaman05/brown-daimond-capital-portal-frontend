import { useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { Button, ShellSkeleton, Spinner } from '../components/ui';
import { errorMessage, ApiError } from '../lib/api';
import { hasSessionHint } from '../lib/session';
import type { Role } from '../lib/types';

export const homeFor = (role: Role) => (role === 'admin' ? '/admin' : '/dashboard');
export const loginFor = (role: Role) => (role === 'admin' ? '/admin/login' : '/client/login');

export function Blocked({ code }: { code: string }) {
  const { signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  return (
    <div className="mx-auto mt-16 max-w-md rounded-xl border border-line bg-white p-6 text-center sm:p-8">
      <h1 className="text-lg font-semibold">We can't open your account</h1>
      <p className="mt-2 text-sm text-muted">{errorMessage(new ApiError(403, code))}</p>
      <Button className="mt-6" loading={busy} loadingText="Signing out…" onClick={async () => { setBusy(true); await signOut(); }}>
        Sign out
      </Button>
    </div>
  );
}

// Signed-in users of the right role only; everyone else is sent where they belong.
export function Protected({ role, children }: { role: Role; children: ReactNode }) {
  const { state } = useAuth();
  const location = useLocation();

  if (state.status === 'loading') return <ShellSkeleton />;
  if (state.status === 'signedOut') return <Navigate to={loginFor(role)} replace state={{ from: location.pathname + location.search }} />;
  if (state.status === 'blocked') return <Blocked code={state.code} />;
  if (state.user.role !== role) return <Navigate to={homeFor(state.user.role)} replace />;
  return <>{children}</>;
}

// Pages for people who are NOT signed in (sign-up, forgot password). Someone who already is goes straight to
// their own home instead. A returning visitor (there is a session hint) sees a spinner while the session is
// restored from the cookie, so the form never flashes; a first-time visitor sees the page immediately.
export function GuestOnly({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  if (state.status === 'ready') return <Navigate to={homeFor(state.user.role)} replace />;
  if (state.status === 'loading' && hasSessionHint()) return <Spinner full />;
  return <>{children}</>;
}

export function HomeRedirect() {
  const { state } = useAuth();
  if (state.status === 'loading') return <Spinner full />;
  if (state.status === 'signedOut') return <Navigate to="/client/login" replace />;
  if (state.status === 'blocked') return <Blocked code={state.code} />;
  return <Navigate to={homeFor(state.user.role)} replace />;
}
