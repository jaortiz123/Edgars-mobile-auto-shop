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

const TOKEN_KEY = 'auth_token';

export const authService = {
  async login(email: string, password: string): Promise<void> {
    const response = await fetch(`${API_URL}/customers/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }
    
    const data: LoginResponse = await response.json();
    this.setToken(data.token);
  },

  async register(email: string, password: string): Promise<void> {
    const response = await fetch(`${API_URL}/customers/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Registration failed');
    }
  },

  async getProfile(): Promise<ProfileData> {
    const token = this.getToken();
    if (!token) throw new Error('No authentication token');

    const response = await fetch(`${API_URL}/customers/profile`, {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch profile');
    }
    
    return response.json();
  },

  async updateProfile(profileData: Partial<ProfileData>): Promise<void> {
    const token = this.getToken();
    if (!token) throw new Error('No authentication token');

    const response = await fetch(`${API_URL}/customers/profile`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(profileData),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update profile');
    }
  },

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  },

  clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  },

  parseToken(): DecodedToken | null {
    const token = this.getToken();
    if (!token) return null;
    try {
      return jwtDecode<DecodedToken>(token);
    } catch {
      return null;
    }
  },

  isLoggedIn(): boolean {
    const decoded = this.parseToken();
    return !!decoded && decoded.exp * 1000 > Date.now();
  },
};
