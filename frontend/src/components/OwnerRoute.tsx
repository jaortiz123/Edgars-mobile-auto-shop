import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
// Use the unified robust auth hook to avoid context mismatch errors
import { useAuth } from '../hooks/useAuth';

interface OwnerRouteProps { children: React.ReactNode }

// Wrap ProtectedRoute semantics but enforce Owner role via user.profile?.role === 'Owner'
export const OwnerRoute: React.FC<OwnerRouteProps> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <div className="p-6 text-sm">Loading…</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  const role = typeof (user.profile as { role?: string } | undefined)?.role === 'string'
    ? (user.profile as { role?: string })!.role
    : undefined;
  if (role !== 'Owner') {
    return <div className="p-6 text-sm text-red-600">Access denied: Owner role required.</div>;
  }
  return <>{children}</>;
};

export default OwnerRoute;
