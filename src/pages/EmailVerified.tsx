import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { btnGhost, btnPrimary } from '../components/ui';
import { Footer } from '../components/Footer';

type Status = 'verified' | 'already' | 'expired';

function readStatus(): Status {
  const params = new URLSearchParams(window.location.search);
  if (params.get('status') === 'already') return 'already';
  if (params.get('status') === 'expired') return 'expired';
  return 'verified';
}

// Single-read: a fresh grant only exists for the one page load right after the backend
// issued it (see session.ts captureSessionFromUrl). Consuming it here means a refresh of
// this same page, or anyone opening a saved/forwarded copy of this URL, never sees the
// "go to my profile" shortcut again — only a real login gets back in.
function consumeFreshVerify(): boolean {
  try {
    const v = sessionStorage.getItem('bdcap-fresh-verify') === '1';
    sessionStorage.removeItem('bdcap-fresh-verify');
    return v;
  } catch {
    return false;
  }
}

function SuccessIcon() {
  return (
    <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
      <div className="absolute inset-0 rounded-full bg-brand/10" />
      <div className="absolute inset-2 rounded-full bg-brand/15" />
      <div className="animate-pop-in relative flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-lg shadow-brand/30">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>
    </div>
  );
}

function ExpiredIcon() {
  return (
    <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
      <div className="absolute inset-0 rounded-full bg-amber-100" />
      <div className="animate-pop-in relative flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg shadow-amber-500/30">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 9v4M12 17h.01" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      </div>
    </div>
  );
}

const COPY: Record<Status, { title: string; subtitle: string }> = {
  verified: {
    title: 'Email verified',
    subtitle: 'Your account is ready. Jump straight to your dashboard, or sign in manually any time.',
  },
  already: {
    title: 'Already verified',
    subtitle: 'This link has already been used. Sign in with your password to continue.',
  },
  expired: {
    title: 'Link expired',
    subtitle: 'This verification link is no longer valid. Sign in and we can send you a new one.',
  },
};

export function EmailVerified() {
  const navigate = useNavigate();
  const [status] = useState<Status>(readStatus);
  const [canGoToProfile] = useState<boolean>(() => status === 'verified' && consumeFreshVerify());
  const c = COPY[status];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-4">
      <div className="my-8 w-full max-w-sm rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-8">
        {status === 'expired' ? <ExpiredIcon /> : <SuccessIcon />}

        <h1 className="mt-5 text-center text-xl font-semibold tracking-tight">{c.title}</h1>
        <p className="mt-2 text-center text-sm text-muted">{c.subtitle}</p>

        <div className="mt-7 space-y-2.5">
          {canGoToProfile && (
            <button className={`${btnPrimary} w-full`} onClick={() => navigate('/dashboard', { replace: true })}>
              Go to my profile
            </button>
          )}
          <Link
            to="/client/login"
            replace
            className={`${canGoToProfile ? btnGhost : btnPrimary} w-full`}
          >
            {canGoToProfile ? 'Log in instead' : 'Go to login'}
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  );
}
