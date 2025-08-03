/**
 * P2-T-004 Coverage Tests - Authentication Service
 * Tests specifically designed to achieve coverage on critical authService functions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('AuthService Coverage Tests', () => {
  let authService: any;
  let AuthError: any;
  let NetworkError: any;
  let ValidationError: any;

  // Mock localStorage
  const mockLocalStorage = {
    store: {} as Record<string, string>,
    getItem: vi.fn((key: string) => mockLocalStorage.store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      mockLocalStorage.store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete mockLocalStorage.store[key];
    }),
    clear: vi.fn(() => {
      mockLocalStorage.store = {};
    })
  };

  // Mock fetch
  const mockFetch = vi.fn();

  // Mock jwtDecode
  const mockJwtDecode = vi.fn();

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();
    mockLocalStorage.clear();
    
    // Setup localStorage mock
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true
    });
    
    // Setup fetch mock
    global.fetch = mockFetch;
    
    // Mock jwt-decode module
    vi.doMock('jwt-decode', () => ({
      jwtDecode: mockJwtDecode
    }));
    
    // Dynamic import to get fresh module
    const authModule = await import('../../services/authService.ts');
    authService = authModule.authService;
    AuthError = authModule.AuthError;
    NetworkError = authModule.NetworkError;
    ValidationError = authModule.ValidationError;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Error Classes', () => {
    it('should create AuthError with message and status', () => {
      const error = new AuthError('Test error', 401);
      expect(error.message).toBe('Test error');
      expect(error.status).toBe(401);
      expect(error.name).toBe('AuthError');
      expect(error).toBeInstanceOf(Error);
    });

    it('should create NetworkError with default message', () => {
      const error = new NetworkError();
      expect(error.message).toBe('Network request failed');
      expect(error.name).toBe('NetworkError');
      expect(error).toBeInstanceOf(Error);
    });

    it('should create ValidationError with message', () => {
      const error = new ValidationError('Invalid input');
      expect(error.message).toBe('Invalid input');
      expect(error.name).toBe('ValidationError');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('Token Management', () => {
    const validToken = 'valid.jwt.token';
    const mockDecodedToken = {
      sub: 'user123',
      email: 'test@example.com',
      exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
    };

    it('should get token from localStorage', () => {
      mockLocalStorage.store['auth_token'] = validToken;
      const token = authService.getToken();
      expect(token).toBe(validToken);
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('auth_token');
    });

    it('should return null when no token exists', () => {
      const token = authService.getToken();
      expect(token).toBeNull();
    });

    it('should handle localStorage access errors gracefully', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('Storage access denied');
      });
      
      const token = authService.getToken();
      expect(token).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to access localStorage:', expect.any(Error));
      
      consoleWarnSpy.mockRestore();
    });

    it('should set valid token successfully', () => {
      mockJwtDecode.mockReturnValue(mockDecodedToken);
      
      authService.setToken(validToken);
      
      expect(mockJwtDecode).toHaveBeenCalledWith(validToken);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('auth_token', validToken);
    });

    it('should reject expired token', () => {
      const expiredToken = { ...mockDecodedToken, exp: Math.floor(Date.now() / 1000) - 3600 };
      mockJwtDecode.mockReturnValue(expiredToken);
      
      expect(() => authService.setToken(validToken)).toThrow(AuthError);
      expect(() => authService.setToken(validToken)).toThrow('Invalid or expired token');
    });

    it('should clear token from localStorage', () => {
      mockLocalStorage.store['auth_token'] = validToken;
      
      authService.clearToken();
      
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('auth_token');
      expect(mockLocalStorage.store['auth_token']).toBeUndefined();
    });
  });

  describe('Token Parsing and Validation', () => {
    const validToken = 'valid.jwt.token';
    const mockDecodedToken = {
      sub: 'user123',
      email: 'test@example.com',
      exp: Math.floor(Date.now() / 1000) + 3600
    };

    it('should parse valid token successfully', () => {
      mockLocalStorage.store['auth_token'] = validToken;
      mockJwtDecode.mockReturnValue(mockDecodedToken);
      
      const parsed = authService.parseToken();
      
      expect(parsed).toEqual(mockDecodedToken);
      expect(mockJwtDecode).toHaveBeenCalledWith(validToken);
    });

    it('should return null when no token exists', () => {
      const parsed = authService.parseToken();
      expect(parsed).toBeNull();
    });

    it('should check if user is logged in with valid token', () => {
      mockLocalStorage.store['auth_token'] = validToken;
      mockJwtDecode.mockReturnValue(mockDecodedToken);
      
      const isLoggedIn = authService.isLoggedIn();
      expect(isLoggedIn).toBe(true);
    });

    it('should return false for expired token', () => {
      const expiredToken = { ...mockDecodedToken, exp: Math.floor(Date.now() / 1000) - 3600 };
      mockLocalStorage.store['auth_token'] = validToken;
      mockJwtDecode.mockReturnValue(expiredToken);
      
      const isLoggedIn = authService.isLoggedIn();
      expect(isLoggedIn).toBe(false);
    });
  });

  describe('Login Functionality', () => {
    const mockLoginResponse = { token: 'new.jwt.token' };
    const mockDecodedToken = {
      sub: 'user123',
      exp: Math.floor(Date.now() / 1000) + 3600
    };

    beforeEach(() => {
      mockJwtDecode.mockReturnValue(mockDecodedToken);
    });

    it('should login successfully with valid credentials', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockLoginResponse)
      });
      
      await authService.login('test@example.com', 'password123');
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/customers/login'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({ email: 'test@example.com', password: 'password123' })
        })
      );
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('auth_token', 'new.jwt.token');
    });

    it('should throw ValidationError for empty email', async () => {
      await expect(authService.login('', 'password123')).rejects.toThrow(ValidationError);
      await expect(authService.login('', 'password123')).rejects.toThrow('Email is required');
    });

    it('should throw ValidationError for empty password', async () => {
      await expect(authService.login('test@example.com', '')).rejects.toThrow(ValidationError);
      await expect(authService.login('test@example.com', '')).rejects.toThrow('Password is required');
    });

    it('should handle login failure with error message', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: vi.fn().mockResolvedValue({ message: 'Invalid credentials' })
      });
      
      await expect(authService.login('test@example.com', 'wrongpassword')).rejects.toThrow(AuthError);
      await expect(authService.login('test@example.com', 'wrongpassword')).rejects.toThrow('Invalid credentials');
    });
  });

  describe('Registration Functionality', () => {
    it('should register successfully with valid data', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ message: 'Registration successful' })
      });
      
      await authService.register('test@example.com', 'password123');
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/customers/register'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'test@example.com', password: 'password123' })
        })
      );
    });

    it('should throw ValidationError for empty email', async () => {
      await expect(authService.register('', 'password123')).rejects.toThrow(ValidationError);
      await expect(authService.register('', 'password123')).rejects.toThrow('Email is required');
    });

    it('should throw ValidationError for short password', async () => {
      await expect(authService.register('test@example.com', '1234567')).rejects.toThrow(ValidationError);
      await expect(authService.register('test@example.com', '1234567')).rejects.toThrow('Password must be at least 8 characters long');
    });
  });

  describe('Profile Management', () => {
    const validToken = 'valid.jwt.token';
    const mockProfileData = {
      email: 'test@example.com',
      vehicles: [
        { id: '1', make: 'Toyota', model: 'Camry', year: 2020 }
      ]
    };

    beforeEach(() => {
      mockLocalStorage.store['auth_token'] = validToken;
    });

    it('should get profile successfully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockProfileData)
      });
      
      const profile = await authService.getProfile();
      
      expect(profile).toEqual(mockProfileData);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/customers/profile'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${validToken}`
          })
        })
      );
    });

    it('should throw AuthError when no token exists', async () => {
      mockLocalStorage.store = {};
      
      await expect(authService.getProfile()).rejects.toThrow(AuthError);
      await expect(authService.getProfile()).rejects.toThrow('No authentication token');
    });

    it('should handle 401 response and clear token', async () => {
      // First set a token so getProfile will attempt the API call
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjk5OTk5OTk5OTl9.token';
      mockLocalStorage.setItem('auth_token', token);
      mockJwtDecode.mockReturnValue({
        sub: '1234567890',
        name: 'John Doe',
        iat: 1516239022,
        exp: 9999999999
      });
      
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: vi.fn().mockResolvedValue({ message: 'Unauthorized' })
      });
      
      // Make the call and check both the error type and message in one call
      let thrownError: Error | null = null;
      try {
        await authService.getProfile();
      } catch (error) {
        thrownError = error as Error;
      }
      
      expect(thrownError).toBeInstanceOf(AuthError);
      expect(thrownError?.message).toBe('Session expired. Please log in again.');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('auth_token');
    });
  });

  describe('Network Error Handling', () => {
    it('should handle fetch rejection', async () => {
      mockFetch.mockRejectedValue(new Error('Network failed'));
      
      await expect(authService.login('test@example.com', 'password123')).rejects.toThrow(NetworkError);
      await expect(authService.login('test@example.com', 'password123')).rejects.toThrow('Network error: Network failed');
    });
  });

  describe('Additional Coverage Tests', () => {
    it('should handle malformed token in parseToken', () => {
      mockLocalStorage.setItem('auth_token', 'invalid.token.format');
      mockJwtDecode.mockImplementation(() => {
        throw new Error('Invalid token');
      });
      
      const result = authService.parseToken();
      expect(result).toBeNull();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('auth_token');
    });

    it('should return null for token without required fields', () => {
      const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiSm9obiBEb2UifQ.token';
      mockLocalStorage.setItem('auth_token', invalidToken);
      mockJwtDecode.mockReturnValue({
        name: 'John Doe'
        // Missing sub and exp
      });
      
      const result = authService.parseToken();
      expect(result).toBeNull();
    });

    it('should check token refresh requirement', () => {
      const nearExpiry = Math.floor(Date.now() / 1000) + 120; // 2 minutes from now
      mockLocalStorage.setItem('auth_token', 'token');
      mockJwtDecode.mockReturnValue({
        sub: '1234567890',
        exp: nearExpiry
      });
      
      const shouldRefresh = authService.shouldRefreshToken();
      expect(shouldRefresh).toBe(true);
    });

    it('should not require refresh for fresh token', () => {
      const farExpiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      mockLocalStorage.setItem('auth_token', 'token');
      mockJwtDecode.mockReturnValue({
        sub: '1234567890',
        exp: farExpiry
      });
      
      const shouldRefresh = authService.shouldRefreshToken();
      expect(shouldRefresh).toBe(false);
    });

    it('should return false for shouldRefreshToken when no token', () => {
      mockLocalStorage.clear();
      const shouldRefresh = authService.shouldRefreshToken();
      expect(shouldRefresh).toBe(false);
    });

    it('should handle isLoggedIn with expired token (with buffer)', () => {
      const expiredToken = Math.floor(Date.now() / 1000) - 60; // 1 minute ago
      mockLocalStorage.setItem('auth_token', 'token');
      mockJwtDecode.mockReturnValue({
        sub: '1234567890',
        exp: expiredToken
      });
      
      const isLoggedIn = authService.isLoggedIn();
      expect(isLoggedIn).toBe(false);
    });

    it('should handle isLoggedIn with token expiring within buffer', () => {
      const soonExpiry = Math.floor(Date.now() / 1000) + 15; // 15 seconds from now (within 30s buffer)
      mockLocalStorage.setItem('auth_token', 'token');
      mockJwtDecode.mockReturnValue({
        sub: '1234567890',
        exp: soonExpiry
      });
      
      const isLoggedIn = authService.isLoggedIn();
      expect(isLoggedIn).toBe(false);
    });
  });
});
