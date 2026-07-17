import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { apiFetch } from '@/lib/api';

export interface AuthUser {
  id: string;
  firstName: string | null;
  profileImgUrl: string | null;
  maxHr: number | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // /auth/me answers 200 for everyone; an empty body means "no session"
    // (a 401 here would make the browser log a console error on every
    // logged-out page load)
    apiFetch('/auth/me')
      .then((res) => (res.ok ? res.text() : ''))
      .then((text) => setUser(text ? (JSON.parse(text) as AuthUser) : null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function logout(): Promise<void> {
    await apiFetch('/auth/logout', { method: 'POST' });
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
