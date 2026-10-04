import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api, ApiError, errorMessage } from '../lib/api';
import { clearSession, setSession, type Session } from '../lib/session';
import { useAuth } from '../auth/AuthProvider';
import { Button, inputCls, Notice } from '../components/ui';
import { homeFor } from '../auth/Guards';

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-4">
      <div className="my-8 w-full max-w-sm rounded-xl border border-line bg-white p-5 sm:p-8">
        <img src="/assets/favicon-dark.png" alt="Brown Diamond Capital" width={76} height={76} className="mx-auto h-[76px] w-[76px]" />
        <h1 className="mt-4 text-center text-xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-2 text-center text-sm text-muted">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

type Variant = 'client' | 'admin';

// Loop guard. We send a signed-in user on to the static portal page; if that page sends them
// straight back, the portal cannot use this session (it is talking to a backend that rejects it).
// Bouncing again would never end, so the second arrival within seconds signs them out instead.
const BOUNCE_KEY = 'bdcap-portal-bounce';
const BOUNCE_WINDOW_MS = 20_000;
const bouncedRecently = () => {
  try {
    const t = Number(sessionStorage.getItem(BOUNCE_KEY));
    return !!t && Date.now() - t < BOUNCE_WINDOW_MS;
  } catch {
    return false;
  }
};
const markBounce = () => {
  try {
    sessionStorage.setItem(BOUNCE_KEY, String(Date.now()));
  } catch {
    /* storage unavailable */
  }
};
const clearBounce = () => {
  try {
    sessionStorage.removeItem(BOUNCE_KEY);
  } catch {
    /* storage unavailable */
  }
};

const VARIANTS: Record<Variant, { title: string; subtitle: string; footer: React.ReactNode }> = {
  client: {
    title: 'Client Portal',
    subtitle: 'Sign in to view your account, website and requests.',
    footer: (
      <>
        New here? <Link to="/client/signup" className="text-brand hover:underline">Create an account</Link>
      </>
    ),
  },
  admin: {
    title: 'Admin sign in',
    subtitle: 'For Brown Diamond Capital staff only.',
    footer: (
      <>
        Looking for the client portal? <Link to="/client/login" className="text-brand hover:underline">Sign in here</Link>
      </>
    ),
  },
};

export function Login({ variant = 'client' }: { variant?: Variant } = {}) {
  const { state } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const requested = (location.state as { from?: string } | null)?.from ?? query.get('next') ?? '';
  const fallback = variant === 'admin' ? '/admin' : '/dashboard';
  // Same-site paths only ("//host" would be an open redirect).
  const dest = requested.startsWith('/') && !requested.startsWith('//') ? requested : fallback;
  const isStaticPortal = dest.startsWith('/portal'); // a plain HTML page, not a SPA route
  const justVerified = query.get('verified') === '1';
  const linkExpired = query.get('verify') === 'expired';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [needsVerify, setNeedsVerify] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const portalRejected = query.get('reason') === 'auth';
  const stuck = isStaticPortal && (portalRejected || bouncedRecently());
  useEffect(() => {
    if (stuck && state.status !== 'signedOut' && state.status !== 'loading') clearSession();
  }, [stuck, state.status]);

  if (state.status === 'ready' && !stuck) {
    // Enforce the login's role: an admin landing on /client/login goes to /admin, and vice versa.
    const goTo = state.user.role === variant ? dest : homeFor(state.user.role);
    if (isStaticPortal && state.user.role === variant) {
      markBounce();
      window.location.assign(goTo);
      return null;
    }
    return <Navigate to={goTo} replace />;
  }
  if (state.status === 'blocked' && !stuck) return <Navigate to={dest} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setNeedsVerify(false);
    setResent(false);
    setBusy(true);
    try {
      const session = await api<Session>('/api/auth/login', {
        method: 'POST',
        body: { email: email.trim().toLowerCase(), password },
      });
      setSession(session);
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiError && err.code === 'EMAIL_NOT_VERIFIED') setNeedsVerify(true);
      setError(errorMessage(err));
      return;
    }
    // Keep the spinner up while the app loads the account and redirects.
    clearBounce();
    if (isStaticPortal) window.location.assign(dest);
    else navigate(dest, { replace: true });
  }

  async function resend() {
    setResending(true);
    try {
      await api('/api/auth/resend-verification', { method: 'POST', body: { email: email.trim().toLowerCase() } });
      setResent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setResending(false);
    }
  }

  const v = VARIANTS[variant];
  return (
    <AuthCard title={v.title} subtitle={v.subtitle}>
      {(justVerified || linkExpired || stuck) && (
        <div className="mb-4">
          {stuck && <Notice tone="warn">The portal could not use your session, so you were signed out. Please sign in again.</Notice>}
          {justVerified && <Notice tone="ok">Your email is verified. Sign in to continue.</Notice>}
          {linkExpired && <Notice tone="warn">That verification link has expired or was already used. Try signing in; if your email is not verified yet we can send a new link.</Notice>}
        </div>
      )}
      <form onSubmit={submit} className="space-y-3">
        <input className={inputCls} type="email" placeholder="Email address" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={inputCls} type="password" placeholder="Password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
        <Button type="submit" className="w-full" loading={busy} loadingText="Signing in…">Sign in</Button>
      </form>
      {needsVerify && (
        <div className="mt-3 text-center">
          {resent ? (
            <p className="text-sm text-green-800">A new verification email is on its way.</p>
          ) : (
            <Button variant="ghost" className="w-full" loading={resending} loadingText="Sending…" onClick={resend}>Resend verification email</Button>
          )}
        </div>
      )}
      <p className="mt-4 text-center text-sm">
        <Link to="/forgot-password" className="text-brand hover:underline">Forgot your password?</Link>
      </p>
      <p className="mt-6 text-center text-xs text-muted">{v.footer}</p>
    </AuthCard>
  );
}

export const ClientLogin = () => <Login variant="client" />;
export const AdminLogin = () => <Login variant="admin" />;
