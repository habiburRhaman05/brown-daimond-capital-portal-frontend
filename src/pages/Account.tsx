import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { api, apiUpload, errorMessage } from '../lib/api';
import { getSession, setSession, type Session } from '../lib/session';
import { useAuth } from '../auth/AuthProvider';
import { useToast } from '../components/Toast';
import { Button, Card, inputCls, Notice, PageHeader } from '../components/ui';
import type { Me } from '../lib/types';

const AVATAR_COLORS = ['#4F8A6E', '#7C6B4F', '#5B6DAF', '#A0635A', '#8B6BAF', '#4F7C94', '#94794F', '#6B8A5B'];

function hashColor(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function updateSessionUser(patch: Record<string, string>) {
  const s = getSession();
  if (!s) return;
  setSession({ ...s, user: { ...s.user, ...patch } });
}

export function Account() {
  const { state } = useAuth();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwDone, setPwDone] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);

  if (state.status !== 'ready') return null;
  const user = state.user;

  if (!profileLoaded) {
    setFullName(user.fullName || '');
    setPhone(user.phone || '');
    setProfileLoaded(true);
  }

  const avatarUrl = avatarPreview || user.avatarUrl;
  const initials = (user.fullName || user.email.split('@')[0])
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('') || 'A';

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Maximum file size is 2 MB.');
      return;
    }
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function uploadAvatar() {
    if (!avatarFile) return;
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append('file', avatarFile);
      const res = await apiUpload<Me>('/api/auth/avatar', fd);
      updateSessionUser({ avatarUrl: res.user.avatarUrl });
      setAvatarPreview(null);
      setAvatarFile(null);
      toast.success('Profile picture updated.');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function removeAvatar() {
    setRemovingAvatar(true);
    try {
      await api('/api/auth/avatar', { method: 'DELETE' });
      updateSessionUser({ avatarUrl: '' });
      setAvatarPreview(null);
      setAvatarFile(null);
      toast.success('Profile picture removed.');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRemovingAvatar(false);
    }
  }

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await api<Me>('/api/auth/profile', {
        method: 'PUT',
        body: { fullName, phone },
      });
      updateSessionUser({ fullName: res.user.fullName, phone: res.user.phone });
      toast.success('Profile updated.');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSavingProfile(false);
    }
  }

  async function submitPassword(e: FormEvent) {
    e.preventDefault();
    setPwError('');
    setPwDone(false);
    if (next.length < 8) return setPwError('Use at least 8 characters.');
    if (next !== confirm) return setPwError('The two new passwords do not match.');
    setPwBusy(true);
    try {
      const res = await api<{ session: Session }>('/api/auth/change-password', {
        method: 'POST',
        body: { currentPassword: current, newPassword: next },
      });
      setSession(res.session);
      setCurrent('');
      setNext('');
      setConfirm('');
      setPwDone(true);
      toast.success('Password changed.');
    } catch (err) {
      const msg = errorMessage(err);
      setPwError(msg);
      toast.error(msg);
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Account" subtitle={user.email} />
      <div className="max-w-xl space-y-6">
        {/* Profile picture */}
        <Card title="Profile picture">
          <div className="flex items-center gap-5">
            <div className="relative">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="h-20 w-20 rounded-2xl border-2 border-line object-cover"
                />
              ) : (
                <div
                  className="flex h-20 w-20 items-center justify-center rounded-2xl text-xl font-bold text-white"
                  style={{ backgroundColor: hashColor(user.email) }}
                >
                  {initials}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleFileSelect}
              />
              <div className="flex flex-wrap gap-2">
                {avatarFile ? (
                  <>
                    <Button onClick={uploadAvatar} loading={uploadingAvatar} loadingText="Uploading…">
                      Save picture
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => { setAvatarPreview(null); setAvatarFile(null); }}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" onClick={() => fileRef.current?.click()}>
                      {avatarUrl ? 'Change picture' : 'Upload picture'}
                    </Button>
                    {avatarUrl && !avatarPreview && (
                      <Button
                        variant="ghost"
                        onClick={removeAvatar}
                        loading={removingAvatar}
                        loadingText="Removing…"
                        className="!text-red-600 hover:!bg-red-50"
                      >
                        Remove
                      </Button>
                    )}
                  </>
                )}
              </div>
              <p className="text-xs text-muted">JPEG, PNG, WebP or GIF. Max 2 MB.</p>
            </div>
          </div>
        </Card>

        {/* Profile info */}
        <Card title="Profile">
          <form onSubmit={saveProfile} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Full name</label>
              <input
                className={inputCls}
                type="text"
                placeholder="Your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Phone</label>
              <input
                className={inputCls}
                type="tel"
                placeholder="Phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Email</label>
              <input className={inputCls} type="email" value={user.email} disabled />
            </div>
            <Button type="submit" className="w-full sm:w-auto" loading={savingProfile} loadingText="Saving…">
              Save changes
            </Button>
          </form>
        </Card>

        {/* Change password */}
        <Card title="Change your password">
          <form onSubmit={submitPassword} className="space-y-3">
            <input className={inputCls} type="password" placeholder="Current password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
            <input className={inputCls} type="password" placeholder="New password" autoComplete="new-password" required value={next} onChange={(e) => setNext(e.target.value)} />
            <input className={inputCls} type="password" placeholder="Repeat new password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            {pwError && <p className="text-sm text-red-700" role="alert">{pwError}</p>}
            {pwDone && <Notice tone="ok">Password changed. Any other devices were signed out.</Notice>}
            <Button type="submit" className="w-full sm:w-auto" loading={pwBusy} loadingText="Saving…">Change password</Button>
          </form>
          <p className="mt-4 text-xs text-muted">Forgot it? Sign out and use "Forgot your password?" on the sign-in page to get an email link.</p>
        </Card>
      </div>
    </>
  );
}
