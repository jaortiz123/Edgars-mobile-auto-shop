import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthState } from '../hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  fallback = '/login' 
}) => {
  const { user, isLoading } = useAuthState();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    // Redirect to login page with return url
    return <Navigate to={fallback} state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
