import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LoadingButton } from '../components/LoadingSpinner';
import { useToast } from '../hooks/useToast';

interface LocationState {
  from?: {
    pathname: string;
  };
}

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading, error } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  
  const state = location.state as LocationState;
  const from = state?.from?.pathname || '/profile';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Client-side validation
    if (!email.trim()) {
      showToast({
        type: 'error',
        title: 'Email required',
        message: 'Please enter your email address.',
        duration: 3000
      });
      return;
    }
    
    if (!password.trim()) {
      showToast({
        type: 'error',
        title: 'Password required',
        message: 'Please enter your password.',
        duration: 3000
      });
      return;
    }
    
    try {
      await login(email.trim(), password);
      showToast({
        type: 'success',
        title: 'Welcome back!',
        message: 'You have been successfully signed in.',
        duration: 3000
      });
      navigate(from, { replace: true });
    } catch (loginError) {
      // Error is already handled in AuthContext, but we can show additional feedback
      let errorMessage = 'Please check your email and password and try again.';
      if (loginError instanceof Error) {
        errorMessage = loginError.message;
      }
      
      showToast({
        type: 'error',
        title: 'Sign in failed',
        message: errorMessage,
        duration: 5000
      });
    }
  };

  const isFormValid = email.trim() && password.trim();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-sp-12 px-sp-4 sm:px-sp-6 lg:px-sp-8">
      <div className="max-w-md w-full space-y-sp-8">
        <div>
          <h2 className="mt-sp-6 text-center text-fs-4 font-extrabold text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-sp-2 text-center text-fs-1 text-gray-600">
            Or{' '}
            <Link
              to="/register"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              create a new account
            </Link>
          </p>
        </div>
        
        <form className="mt-sp-8 space-y-sp-6" onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="rounded-md bg-red-50 p-sp-4" role="alert" aria-live="polite">
              <div className="text-fs-1 text-red-800">{error}</div>
            </div>
          )}
          
          <div className="space-y-sp-4">
            <div>
              <label htmlFor="email" className="block text-fs-1 font-medium text-gray-700">
                Email address *
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-sp-1 appearance-none relative block w-full px-sp-3 py-sp-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-fs-1"
                placeholder="Enter your email"
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-fs-1 font-medium text-gray-700">
                Password *
              </label>
              <div className="mt-sp-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none relative block w-full px-sp-3 py-sp-2 pr-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-fs-1"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-sp-3 flex items-center hover:text-gray-600 focus:outline-none focus:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  id="password-toggle"
                >
                  {showPassword ? (
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L7.03 12.727m2.848-2.849L12 7.5m0 0l2.122 2.378M12 7.5v6m0-6l-2.122 2.378" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div>
            <LoadingButton
              type="submit"
              loading={isLoading}
              disabled={!isFormValid}
              className="group relative w-full flex justify-center py-sp-2 px-sp-4 border border-transparent text-fs-1 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </LoadingButton>
          </div>

          <div className="text-center">
            <Link
              to="/forgot-password"
              className="text-fs-1 text-blue-600 hover:text-blue-500"
            >
              Forgot your password?
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
