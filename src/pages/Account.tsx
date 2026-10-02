import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '../lib/api';
import { setSession, type Session } from '../lib/session';
import { useAuth } from '../auth/AuthProvider';
import { Button, Card, inputCls, Notice, PageHeader } from '../components/ui';

// Same page for admins and clients: change your own password while signed in.
export function Account() {
  const { state } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (state.status !== 'ready') return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setDone(false);
    if (next.length < 8) return setError('Use at least 8 characters.');
    if (next !== confirm) return setError('The two new passwords do not match.');
    setBusy(true);
    try {
      const res = await api<{ session: Session }>('/api/auth/change-password', {
        method: 'POST',
        body: { currentPassword: current, newPassword: next },
      });
      // Other devices are signed out; this browser carries on with the fresh session.
      setSession(res.session);
      setCurrent('');
      setNext('');
      setConfirm('');
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Account" subtitle={state.user.email} />
      <div className="max-w-md">
        <Card title="Change your password">
          <form onSubmit={submit} className="space-y-3">
            <input className={inputCls} type="password" placeholder="Current password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
            <input className={inputCls} type="password" placeholder="New password" autoComplete="new-password" required value={next} onChange={(e) => setNext(e.target.value)} />
            <input className={inputCls} type="password" placeholder="Repeat new password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
            {done && <Notice tone="ok">Password changed. Any other devices were signed out.</Notice>}
            <Button type="submit" className="w-full sm:w-auto" loading={busy} loadingText="Saving…">Change password</Button>
          </form>
          <p className="mt-4 text-xs text-muted">Forgot it? Sign out and use “Forgot your password?” on the sign-in page to get an email link.</p>
        </Card>
      </div>
    </>
  );
}
