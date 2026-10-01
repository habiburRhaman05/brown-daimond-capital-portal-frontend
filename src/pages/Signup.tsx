import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../lib/api';
import { Button, inputCls } from '../components/ui';
import { AuthCard } from './Login';

// Self-signup. The backend asks Supabase to email a verification link; the account can only
// sign in after that link is clicked.
export function Signup() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('Use at least 8 characters for your password.');
    if (password !== confirm) return setError('The two passwords do not match.');
    setBusy(true);
    try {
      await api('/api/auth/signup', {
        method: 'POST',
        body: { fullName: fullName.trim(), email: email.trim().toLowerCase(), password },
      });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setResending(true);
    setResent(false);
    try {
      await api('/api/auth/resend-verification', { method: 'POST', body: { email: email.trim().toLowerCase() } });
      setResent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setResending(false);
    }
  }

  if (sent) {
    return (
      <AuthCard title="Check your email" subtitle="One more step to activate your account.">
        <p className="text-center text-sm text-muted">
          We sent a verification link to <span className="break-all font-medium text-ink">{email.trim().toLowerCase()}</span>.
          Click it, then come back and sign in.
        </p>
        {error && <p className="mt-3 text-center text-sm text-red-700" role="alert">{error}</p>}
        <div className="mt-5 space-y-3">
          <Link to="/client/login" className="inline-flex w-full items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
            Go to sign in
          </Link>
          {resent ? (
            <p className="text-center text-sm text-green-800">Sent again. Check your inbox and spam folder.</p>
          ) : (
            <Button variant="ghost" className="w-full" loading={resending} loadingText="Sending…" onClick={resend}>Resend the email</Button>
          )}
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Create your account" subtitle="We will email you a link to verify your address.">
      <form onSubmit={submit} className="space-y-3">
        <input className={inputCls} type="text" placeholder="Full name" autoComplete="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <input className={inputCls} type="email" placeholder="Email address" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={inputCls} type="password" placeholder="Password (8+ characters)" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        <input className={inputCls} type="password" placeholder="Repeat password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
        <Button type="submit" className="w-full" loading={busy} loadingText="Creating account…">Create account</Button>
      </form>
      <p className="mt-6 text-center text-sm">
        Already have an account? <Link to="/client/login" className="text-brand hover:underline">Sign in</Link>
      </p>
    </AuthCard>
  );
}
