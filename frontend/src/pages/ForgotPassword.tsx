import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../hooks/useToast';
import { LoadingButton } from '../components/LoadingSpinner';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      showToast({
        type: 'error',
        title: 'Email required',
        message: 'Please enter your email address.',
        duration: 3000
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Simulate API call for password reset
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setIsSubmitted(true);
      showToast({
        type: 'success',
        title: 'Reset link sent!',
        message: 'Check your email for password reset instructions.',
        duration: 5000
      });
    } catch {
      showToast({
        type: 'error',
        title: 'Reset failed',
        message: 'There was an error sending the reset email. Please try again.',
        duration: 5000
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Check your email
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              We've sent a password reset link to
            </p>
            <p className="mt-1 text-sm font-medium text-gray-900">
              {email}
            </p>
            <p className="mt-4 text-sm text-gray-600">
              Didn't receive the email? Check your spam folder or
            </p>
            <button
              onClick={() => {
                setIsSubmitted(false);
                setEmail('');
              }}
              className="mt-2 text-sm text-blue-600 hover:text-blue-500 font-medium"
            >
              try again with a different email
            </button>
          </div>
          
          <div className="text-center">
            <Link
              to="/login"
              className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Forgot your password?
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
              placeholder="Enter your email address"
            />
          </div>

          <div>
            <LoadingButton
              type="submit"
              loading={isLoading}
              disabled={!email.trim()}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {isLoading ? 'Sending reset link...' : 'Send reset link'}
            </LoadingButton>
          </div>

          <div className="text-center">
            <Link
              to="/login"
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              Remember your password? Sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ForgotPassword;
