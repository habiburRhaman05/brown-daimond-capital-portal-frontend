import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../auth/AuthProvider';
import { Button, inputCls, Spinner } from '../components/ui';
import { AuthCard } from './Login';

// Landing page for both the signup (invite) link and the password-reset link.
// The tokens in the URL are turned into a session before render (see lib/session.ts).
export function SetPassword() {
  const { state, hasSession } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (state.status === 'loading') return <Spinner full />;

  if (!hasSession) {
    return (
      <AuthCard title="This link has expired" subtitle="Signup and reset links can only be used once.">
        <p className="text-center text-sm">
          <Link to="/forgot-password" className="text-brand hover:underline">Send me a new link</Link>
          {' · '}
          <Link to="/login" className="text-brand hover:underline">Sign in</Link>
        </p>
      </AuthCard>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('Use at least 8 characters.');
    if (password !== confirm) return setError('The two passwords do not match.');
    setBusy(true);
    try {
      await api('/api/auth/set-password', { method: 'POST', body: { password } });
    } catch (err) {
      setBusy(false);
      return setError(errorMessage(err));
    }
    navigate('/', { replace: true });
  }

  return (
    <AuthCard title="Choose your password" subtitle="You will use it to sign in from now on.">
      <form onSubmit={submit} className="space-y-3">
        <input className={inputCls} type="password" placeholder="New password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <input className={inputCls} type="password" placeholder="Repeat password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
        <Button type="submit" className="w-full" loading={busy} loadingText="Saving…">Save password</Button>
      </form>
    </AuthCard>
  );
}
