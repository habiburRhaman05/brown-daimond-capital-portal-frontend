import { useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { Button, ShellSkeleton, Spinner } from '../components/ui';
import { errorMessage, ApiError } from '../lib/api';
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

export function HomeRedirect() {
  const { state } = useAuth();
  if (state.status === 'loading') return <Spinner full />;
  if (state.status === 'signedOut') return <Navigate to="/client/login" replace />;
  if (state.status === 'blocked') return <Blocked code={state.code} />;
  return <Navigate to={homeFor(state.user.role)} replace />;
}
