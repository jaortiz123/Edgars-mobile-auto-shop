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
    // No need to check localStorage for tokens - they are now httpOnly cookies
    // The server will handle authentication via cookies automatically
    // TODO: hit /me endpoint to check current auth status when available
  }, []);

  const setToken = useCallback((t: string | null) => {
    setTokenState(t);
    // No localStorage needed - tokens are now httpOnly cookies managed by server
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/customers/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include httpOnly cookies
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
      }

      const data = await response.json();
      setUser({ id: data.customer_id, email, name: data.name });
      // No token in localStorage - using httpOnly cookies
      setToken(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setToken]);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include', // Include httpOnly cookies to clear them
      });
    } catch (err) {
      console.warn('Logout API call failed:', err);
      // Continue with local logout even if API fails
    }

    setUser(null);
    setToken(null);
    setError(null);
  }, [setToken]);

  const register = useCallback(async (email: string, password: string, name?: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/customers/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include httpOnly cookies
        body: JSON.stringify({
          email,
          password,
          name: name || '',
          phone: '' // Add required phone field with empty default
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Registration failed');
      }

      const data = await response.json();
      setUser({ id: data.customer_id, email, name: name || data.name });
      // No token in localStorage - using httpOnly cookies
      setToken(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
      throw err;
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
