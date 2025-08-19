import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';

export interface User {
  id: string;
  email: string;
  name?: string | null;
  profile?: any; // Add profile property for UserDashboard and Profile pages
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  isLoading: boolean; // Alias for loading used by pages
  error: string | null; // Add error state
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setToken: (t: string | null) => void;
  register?: (email: string, password: string, name?: string) => Promise<void>; // Add register
  updateProfile?: (data: any) => Promise<void>; // Add updateProfile
}

const Ctx = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem('auth.token');
    if (t) {
      setTokenState(t);
      // TODO: hit /me endpoint when available
    }
  }, []);

  const setToken = useCallback((t: string | null) => {
    setTokenState(t);
    if (t) localStorage.setItem('auth.token', t);
    else localStorage.removeItem('auth.token');
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      // TODO: call backend when auth is ready
      console.log('Login attempt:', { email, password: password.replace(/./g, '*') });
      setUser({ id: 'local', email });
      setToken('dev-token');
    } finally {
      setLoading(false);
    }
  }, [setToken]);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setError(null);
  }, [setToken]);

  const register = useCallback(async (email: string, password: string, name?: string) => {
    setLoading(true);
    setError(null);
    try {
      // TODO: call backend when auth is ready
      console.log('Register attempt:', { email, password: password.replace(/./g, '*'), name });
      setUser({ id: 'local', email, name });
      setToken('dev-token');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }, [setToken]);

  const updateProfile = useCallback(async (data: any) => {
    setLoading(true);
    setError(null);
    try {
      // TODO: call backend when auth is ready
      console.log('Update profile:', data);
      if (user) {
        setUser({ ...user, profile: data });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Profile update failed');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isLoading: loading, // Alias for loading
      error,
      login,
      logout,
      setToken,
      register,
      updateProfile
    }),
    [user, token, loading, error, login, logout, setToken, register, updateProfile]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used within <AuthProvider>');
  return v;
}
