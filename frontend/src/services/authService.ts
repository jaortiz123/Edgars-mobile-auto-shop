import { jwtDecode } from 'jwt-decode';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export interface DecodedToken {
  sub: string;
  email?: string;
  exp: number;
  [key: string]: unknown;
}

export interface LoginResponse {
  token: string;
  message?: string;
}

export interface RegisterResponse {
  message: string;
}

export interface ProfileData {
  email: string;
  vehicles?: Array<{
    id?: string;
    make: string;
    model: string;
    year: number;
    license_plate?: string;
  }>;
}

// Custom error types for better error handling
export class AuthError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'AuthError';
  }
}

export class NetworkError extends Error {
  constructor(message: string = 'Network request failed') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const TOKEN_KEY = 'auth_token';

// Helper function for robust API calls
const makeApiCall = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new NetworkError('Request timeout');
      }
      throw new NetworkError(`Network error: ${error.message}`);
    }
    throw new NetworkError('Unknown network error');
  }
};

export const authService = {
  async login(email: string, password: string): Promise<void> {
    // Input validation
    if (!email?.trim()) {
      throw new ValidationError('Email is required');
    }
    if (!password?.trim()) {
      throw new ValidationError('Password is required');
    }
    
    const response = await makeApiCall(`${API_URL}/customers/login`, {
      method: 'POST',
      body: JSON.stringify({ email: email.trim(), password }),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Login failed' }));
      throw new AuthError(error.message || 'Login failed', response.status);
    }
    
    const data: LoginResponse = await response.json();
    if (!data.token) {
      throw new AuthError('Invalid response: missing token');
    }
    
    this.setToken(data.token);
  },

  async register(email: string, password: string): Promise<void> {
    // Input validation
    if (!email?.trim()) {
      throw new ValidationError('Email is required');
    }
    if (!password?.trim()) {
      throw new ValidationError('Password is required');
    }
    if (password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long');
    }
    
    const response = await makeApiCall(`${API_URL}/customers/register`, {
      method: 'POST',
      body: JSON.stringify({ email: email.trim(), password }),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Registration failed' }));
      throw new AuthError(error.message || 'Registration failed', response.status);
    }
  },

  async getProfile(): Promise<ProfileData> {
    const token = this.getToken();
    if (!token) throw new AuthError('No authentication token');

    const response = await makeApiCall(`${API_URL}/customers/profile`, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${token}`
      },
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        this.clearToken(); // Clear invalid token
        throw new AuthError('Session expired. Please log in again.', 401);
      }
      const error = await response.json().catch(() => ({ message: 'Failed to fetch profile' }));
      throw new AuthError(error.message || 'Failed to fetch profile', response.status);
    }
    
    return response.json();
  },

  async updateProfile(profileData: Partial<ProfileData>): Promise<void> {
    const token = this.getToken();
    if (!token) throw new AuthError('No authentication token');

    // Input validation
    if (profileData.email && !profileData.email.trim()) {
      throw new ValidationError('Email cannot be empty');
    }

    const response = await makeApiCall(`${API_URL}/customers/profile`, {
      method: 'PUT',
      headers: { 
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(profileData),
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        this.clearToken(); // Clear invalid token
        throw new AuthError('Session expired. Please log in again.', 401);
      }
      const error = await response.json().catch(() => ({ message: 'Failed to update profile' }));
      throw new AuthError(error.message || 'Failed to update profile', response.status);
    }
  },

  getToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch (error) {
      console.warn('Failed to access localStorage:', error);
      return null;
    }
  },

  setToken(token: string): void {
    try {
      // Validate token format before storing
      const decoded = jwtDecode<DecodedToken>(token);
      if (!decoded.exp || decoded.exp * 1000 <= Date.now()) {
        throw new AuthError('Invalid or expired token');
      }
      localStorage.setItem(TOKEN_KEY, token);
    } catch (error) {
      if (error instanceof AuthError) throw error;
      console.warn('Failed to store token:', error);
      throw new AuthError('Invalid token format');
    }
  },

  clearToken(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch (error) {
      console.warn('Failed to clear token:', error);
    }
  },

  parseToken(): DecodedToken | null {
    const token = this.getToken();
    if (!token) return null;
    try {
      const decoded = jwtDecode<DecodedToken>(token);
      // Validate token structure
      if (!decoded.sub || !decoded.exp) {
        return null;
      }
      return decoded;
    } catch (error) {
      console.warn('Failed to parse token:', error);
      this.clearToken(); // Clear invalid token
      return null;
    }
  },

  isLoggedIn(): boolean {
    const decoded = this.parseToken();
    if (!decoded) return false;
    
    // Check if token is expired (with 30 second buffer)
    const expirationTime = decoded.exp * 1000;
    const currentTime = Date.now();
    const bufferTime = 30 * 1000; // 30 seconds
    
    return expirationTime > (currentTime + bufferTime);
  },

  // Method to refresh token before expiration
  shouldRefreshToken(): boolean {
    const decoded = this.parseToken();
    if (!decoded) return false;
    
    const expirationTime = decoded.exp * 1000;
    const currentTime = Date.now();
    const refreshThreshold = 5 * 60 * 1000; // 5 minutes
    
    return expirationTime - currentTime < refreshThreshold;
  }
};
