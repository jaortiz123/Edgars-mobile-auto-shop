import React, { createContext, useReducer, useCallback, useEffect, useMemo, useRef } from 'react';
import { authService, AuthError, NetworkError, ValidationError } from '../services/authService';
import type { ProfileData } from '../services/authService';

interface User {
  id: string;
  email: string;
  profile?: ProfileData;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;
}

type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_INITIALIZED'; payload: boolean }
  | { type: 'UPDATE_PROFILE'; payload: ProfileData };

const initialState: AuthState = {
  user: null,
  isLoading: false,
  error: null,
  isInitialized: false,
};

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    case 'SET_USER':
      return {
        ...state,
        user: action.payload,
        isLoading: false,
        error: null
      };
    case 'SET_INITIALIZED':
      return { ...state, isInitialized: action.payload };
    case 'UPDATE_PROFILE':
      return {
        ...state,
        user: state.user ? { ...state.user, profile: action.payload } : null
      };
    default:
      return state;
  }
};

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateProfile: (profileData: ProfileData) => Promise<void>;
  clearError: () => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const initializeRef = useRef(false);

  // Handle authentication errors with user-friendly messages
  const handleAuthError = useCallback((error: unknown): string => {
    if (error instanceof ValidationError) {
      return error.message;
    }
    if (error instanceof AuthError) {
      return error.message;
    }
    if (error instanceof NetworkError) {
      return 'Network error. Please check your connection and try again.';
    }
    if (error instanceof Error) {
      return error.message;
    }
    return 'An unexpected error occurred. Please try again.';
  }, []);

  // Initialize authentication state
  const initializeAuth = useCallback(async () => {
    if (initializeRef.current) return;
    initializeRef.current = true;

    try {
      if (authService.isLoggedIn()) {
        interface DecodedMaybeAdvisor { sub: string; email?: string; role?: string; [k: string]: unknown }
        const decoded = authService.parseToken() as DecodedMaybeAdvisor | null;
        if (decoded) {
          if (decoded.role === 'Advisor') {
            dispatch({
              type: 'SET_USER',
              payload: {
                id: decoded.sub,
                email: decoded.email || 'advisor@example.com',
                profile: { email: decoded.email || 'advisor@example.com' } as ProfileData
              }
            });
          } else {
            const profile = await authService.getProfile();
            dispatch({
              type: 'SET_USER',
              payload: {
                id: decoded.sub,
                email: decoded.email || profile.email,
                profile
              }
            });
          }
        }
      }
    } catch (error) {
      console.warn('Failed to initialize auth:', error);
      // Do not clear token if it's an Advisor token (admin dashboard usage) – allow downstream admin APIs to function.
      try {
        const decoded = authService.parseToken() as { role?: string } | null;
        if (!decoded || decoded.role !== 'Advisor') {
          authService.clearToken();
        }
      } catch { /* ignore */ }
    } finally {
      dispatch({ type: 'SET_INITIALIZED', payload: true });
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Token refresh interval
  useEffect(() => {
    if (!state.user) return;

    const interval = setInterval(() => {
      if (authService.shouldRefreshToken()) {
        // In a real app, you would call a refresh endpoint here
        console.log('Token should be refreshed');
      }

      if (!authService.isLoggedIn()) {
        dispatch({ type: 'SET_USER', payload: null });
        dispatch({ type: 'SET_ERROR', payload: 'Session expired. Please log in again.' });
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [state.user]);

  const login = useCallback(async (email: string, password: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      await authService.login(email, password);
      const decoded = authService.parseToken();

      if (decoded) {
        const profile = await authService.getProfile();
        dispatch({
          type: 'SET_USER',
          payload: {
            id: decoded.sub,
            email: decoded.email || profile.email,
            profile
          }
        });
      }
    } catch (error) {
      const errorMessage = handleAuthError(error);
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      throw error; // Re-throw for component handling
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [handleAuthError]);

  const register = useCallback(async (email: string, password: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      await authService.register(email, password);
      // Auto-login after successful registration
      await login(email, password);
    } catch (error) {
      const errorMessage = handleAuthError(error);
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      throw error; // Re-throw for component handling
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [login, handleAuthError]);

  const logout = useCallback(() => {
    authService.clearToken();
    dispatch({ type: 'SET_USER', payload: null });
    dispatch({ type: 'SET_ERROR', payload: null });
  }, []);

  const updateProfile = useCallback(async (profileData: ProfileData) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      await authService.updateProfile(profileData);
      dispatch({ type: 'UPDATE_PROFILE', payload: profileData });
    } catch (error) {
      const errorMessage = handleAuthError(error);
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      throw error; // Re-throw for component handling
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [handleAuthError]);

  const clearError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: null });
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    user: state.user,
    isLoading: state.isLoading,
    error: state.error,
    isInitialized: state.isInitialized,
    login,
    register,
    logout,
    updateProfile,
    clearError
  }), [
    state.user,
    state.isLoading,
    state.error,
    state.isInitialized,
    login,
    register,
    logout,
    updateProfile,
    clearError
  ]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
