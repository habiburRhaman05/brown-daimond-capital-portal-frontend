import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api, ApiError, errorMessage } from '../lib/api';
import { clearSession, setSession, type Session } from '../lib/session';
import { useAuth } from '../auth/AuthProvider';
import { Button, inputCls, Notice } from '../components/ui';
import { homeFor } from '../auth/Guards';
import { Footer } from '../components/Footer';
import { COMPANY_NAME, MAILING_ADDRESS } from '../lib/brand';

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-4">
      <div className="my-8 w-full max-w-sm rounded-2xl border border-line bg-white p-6 shadow-[0_1px_2px_rgba(20,18,16,0.04),0_24px_64px_-16px_rgba(20,18,16,0.12)] sm:p-8">
        <div className="mx-auto flex h-[52px] w-[52px] items-center justify-center rounded-2xl border border-gold/45 bg-brand text-sm font-bold text-gold-light">BD</div>
        <h1 className="mt-5 text-center font-serif text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-2 text-center text-sm text-muted">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
      <Footer />
    </div>
  );
}

type Variant = 'client' | 'admin';

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
  } catch { /* storage unavailable */ }
};
const clearBounce = () => {
  try {
    sessionStorage.removeItem(BOUNCE_KEY);
  } catch { /* storage unavailable */ }
};

const VARIANTS: Record<Variant, { title: string; subtitle: string; footer: React.ReactNode }> = {
  client: {
    title: 'Client Portal',
    subtitle: 'Sign in to view your account, website and requests.',
    footer: (
      <>
        New here? <Link to="/client/signup" className="font-semibold text-brand hover:underline">Create an account</Link>
      </>
    ),
  },
  admin: {
    title: 'Admin sign in',
    subtitle: 'For Brown Diamond Capital staff only.',
    footer: (
      <>
        Looking for the client portal? <Link to="/client/login" className="font-semibold text-brand hover:underline">Sign in here</Link>
      </>
    ),
  },
};

function CheckIcon() {
  return (
    <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg bg-gold/16">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D9B98A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>
    </span>
  );
}

export function Login({ variant = 'client' }: { variant?: Variant } = {}) {
  const { state } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const requested = (location.state as { from?: string } | null)?.from ?? query.get('next') ?? '';
  const fallback = variant === 'admin' ? '/admin' : '/dashboard';
  const dest = requested.startsWith('/') && !requested.startsWith('//') ? requested : fallback;
  const isStaticPortal = dest.startsWith('/portal');
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
    <div className="flex min-h-screen items-center justify-center px-4 py-4">
      <div className="flex w-full max-w-[1220px] flex-wrap overflow-hidden rounded-[28px] border border-black/5 bg-white shadow-[0_1px_2px_rgba(20,18,16,0.04),0_24px_64px_-16px_rgba(20,18,16,0.18),0_8px_24px_-8px_rgba(20,18,16,0.10)]">

        {/* Brand panel */}
        <div className="relative flex min-w-[320px] flex-1 flex-col justify-between overflow-hidden bg-[linear-gradient(165deg,#0F3728_0%,#07201A_100%)] p-10 text-white sm:p-14" style={{ flexBasis: 460 }}>
          <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-50" aria-hidden="true">
            <defs><pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1.1" fill="rgba(247,246,242,0.08)"/></pattern></defs>
            <rect width="100%" height="100%" fill="url(#dots)"/>
          </svg>
          <div className="pointer-events-none absolute -right-28 -top-28 h-[340px] w-[340px] rounded-full border border-gold/22" />
          <div className="pointer-events-none absolute -right-8 -top-8 h-[200px] w-[200px] rounded-full border border-gold/16" />

          <div className="relative flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[13px] border border-gold/45 bg-gold/18 text-[15px] font-bold tracking-wide text-gold-light">BD</div>
            <div className="text-[13px] font-semibold uppercase tracking-[2px] text-[#D9D4C6]">{COMPANY_NAME}</div>
          </div>

          <div className="relative max-w-[440px]">
            <div className="mb-4 text-[12.5px] font-bold uppercase tracking-[2px] text-gold">{v.title}</div>
            <h1 className="mb-4 font-serif text-[42px] font-semibold leading-[1.18] tracking-tight text-white max-sm:text-3xl">
              Your business,<br/>built right the&nbsp;first&nbsp;time.
            </h1>
            <p className="text-[15px] leading-relaxed text-white/72">{v.subtitle}</p>

            <div className="mt-9 flex flex-col gap-4">
              <div className="flex items-center gap-3"><CheckIcon /><span className="text-sm text-white/85">See your submission and website progress live</span></div>
              <div className="flex items-center gap-3"><CheckIcon /><span className="text-sm text-white/85">Request changes any time after you submit</span></div>
              <div className="flex items-center gap-3"><CheckIcon /><span className="text-sm text-white/85">Your information is never shared without consent</span></div>
            </div>
          </div>

          <div className="relative text-xs text-white/42">&copy; {new Date().getFullYear()} {COMPANY_NAME}</div>
        </div>

        {/* Form panel */}
        <div className="flex min-w-[320px] flex-1 items-center justify-center bg-paper p-10 sm:p-14" style={{ flexBasis: 460 }}>
          <div className="w-full max-w-[380px]">
            <h2 className="font-serif text-[28px] font-semibold tracking-tight text-ink">Welcome back</h2>
            <p className="mb-7 mt-2 text-sm text-muted">{v.subtitle}</p>

            {(justVerified || linkExpired || stuck) && (
              <div className="mb-5">
                {stuck && <Notice tone="warn">The portal could not use your session, so you were signed out. Please sign in again.</Notice>}
                {justVerified && <Notice tone="ok">Your email is verified. Sign in to continue.</Notice>}
                {linkExpired && <Notice tone="warn">That verification link has expired or was already used. Try signing in; if your email is not verified yet we can send a new link.</Notice>}
              </div>
            )}

            {error && (
              <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B91C1C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
                <p className="flex-1 text-[13px] leading-relaxed text-red-900">{error}</p>
              </div>
            )}

            <form onSubmit={submit} className="flex flex-col gap-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-ink">Email address</span>
                <input className={inputCls} type="email" placeholder="you@company.com" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-ink">Password</span>
                <input className={inputCls} type="password" placeholder="Enter your password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </label>

              <div className="-mt-1 text-right">
                <Link to="/forgot-password" className="text-[13px] font-semibold text-brand hover:underline">Forgot your password?</Link>
              </div>

              <Button type="submit" className="mt-2 w-full gap-2" loading={busy} loadingText="Signing in...">
                Sign in
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
              </Button>
            </form>

            {needsVerify && (
              <div className="mt-3 text-center">
                {resent ? (
                  <p className="text-sm text-green-800">A new verification email is on its way.</p>
                ) : (
                  <Button variant="ghost" className="w-full" loading={resending} loadingText="Sending..." onClick={resend}>Resend verification email</Button>
                )}
              </div>
            )}

            <p className="mt-6 text-center text-[13px] text-muted">{v.footer}</p>

            <div className="mt-10 border-t border-line pt-5 text-center text-[11.5px] leading-relaxed text-muted/60">
              {COMPANY_NAME}, {MAILING_ADDRESS}<br/>
              <Link to="/privacy" className="hover:text-ink hover:underline">Privacy Policy</Link> &middot; <Link to="/terms" className="hover:text-ink hover:underline">Terms of Use</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const ClientLogin = () => <Login variant="client" />;
export const AdminLogin = () => <Login variant="admin" />;
