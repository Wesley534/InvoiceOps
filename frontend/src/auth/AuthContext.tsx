import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  apiLogin,
  apiLogout,
  apiMe,
  apiRegister,
  clearSession,
  getStoredToken,
  getStoredUser,
  setUnauthorizedHandler,
  type AuthSession,
} from '../lib/api';
import type { UserRecord } from '../lib/types';

interface AuthContextValue {
  /** Current authenticated user, or null when signed out. */
  user: UserRecord | null;
  /** True while the initial stored session is being validated. */
  booting: boolean;
  signIn: (email: string, password: string) => Promise<UserRecord>;
  signUp: (input: { email: string; name: string; password: string }) => Promise<UserRecord>;
  signOut: () => void;
  isApprover: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserRecord | null>(() => getStoredUser());
  const [booting, setBooting] = useState(() => Boolean(getStoredToken() && !getStoredUser()));

  const signOut = useCallback(() => {
    apiLogout();
    setUser(null);
  }, []);

  // A 401 anywhere in the app drops the session.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession();
      setUser(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  // Re-validate a persisted token on first load.
  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setBooting(false);
      return;
    }
    if (getStoredUser()) {
      setBooting(false);
      return;
    }
    let cancelled = false;
    apiMe()
      .then((record) => {
        if (!cancelled) {
          setUser(record);
          setBooting(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          clearSession();
          setBooting(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const session: AuthSession = await apiLogin(email, password);
    setUser(session.user);
    return session.user;
  }, []);

  const signUp = useCallback(
    async (input: { email: string; name: string; password: string }) => {
      const session = await apiRegister(input);
      setUser(session.user);
      return session.user;
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      booting,
      signIn,
      signUp,
      signOut,
      isApprover: user?.role === 'approver',
    }),
    [user, booting, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
