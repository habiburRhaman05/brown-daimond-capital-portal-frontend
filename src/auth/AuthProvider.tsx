import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { clearPortalDraft, clearSession, getSession, subscribe, type Session } from '../lib/session';
import { api, ApiError } from '../lib/api';
import type { Me, MeUser } from '../lib/types';

type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'blocked'; code: string }
  | { status: 'ready'; user: MeUser };

interface AuthContextValue {
  state: AuthState;
  hasSession: boolean;
  signOut: () => Promise<void>;
  /** Merge fresh profile fields (from a profile/avatar response) into the signed-in user. */
  updateUser: (patch: Partial<MeUser>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSessionState] = useState<Session | null>(() => getSession());
  const [me, setMe] = useState<AuthState | null>(null);

  // The session store is the single source of truth; login/sign-out/refresh notify it.
  useEffect(() => {
    setSessionState(getSession());
    return subscribe(() => setSessionState(getSession()));
  }, []);

  // Ask the backend who this is (role + invite check) once per signed-in user, not per token refresh.
  const userId = session?.user?.id || null;
  useEffect(() => {
    if (!session) {
      setMe(null);
      return;
    }
    let cancelled = false;
    setMe({ status: 'loading' });
    api<Me>('/api/auth/me')
      .then((r) => !cancelled && setMe({ status: 'ready', user: r.user }))
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && (err.status === 403 || err.status === 401)) {
          setMe({ status: 'blocked', code: err.code });
        } else {
          setMe({ status: 'blocked', code: 'REQUEST_FAILED' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId, session?.access_token]);

  const signOut = useCallback(async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch {
      /* the browser forgets the session either way */
    }
    clearPortalDraft();
    clearSession();
    queryClient.clear();
    setMe(null);
  }, [queryClient]);

  const updateUser = useCallback((patch: Partial<MeUser>) => {
    setMe((prev) => (prev?.status === 'ready' ? { status: 'ready', user: { ...prev.user, ...patch } } : prev));
  }, []);

  const state: AuthState = useMemo(() => {
    if (!session) return { status: 'signedOut' };
    return me ?? { status: 'loading' };
  }, [session, me]);

  const value = useMemo(() => ({ state, hasSession: !!session, signOut, updateUser }), [state, session, signOut, updateUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
