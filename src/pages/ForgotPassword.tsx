import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Button, inputCls } from '../components/ui';
import { AuthCard } from './Login';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    // The answer is the same whether or not the address has an account.
    try {
      await api('/api/auth/forgot-password', { method: 'POST', body: { email: email.trim().toLowerCase() } });
    } catch {
      /* the backend always answers ok; ignore transport errors */
    }
    setBusy(false);
    setSent(true);
  }

  return (
    <AuthCard title="Reset your password" subtitle="We will email you a link to choose a new one.">
      {sent ? (
        <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-900">If that email has an account, a reset link is on its way.</p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <input className={inputCls} type="email" placeholder="Email address" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" className="w-full" loading={busy} loadingText="Sending…">Send reset link</Button>
        </form>
      )}
      <p className="mt-4 text-center text-sm">
        <Link to="/login" className="text-brand hover:underline">Back to sign in</Link>
      </p>
    </AuthCard>
  );
}
