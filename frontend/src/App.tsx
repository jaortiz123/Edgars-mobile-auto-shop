import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, lazy } from 'react';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/ToastProvider';
import ProtectedRoute from './components/ProtectedRoute';

// --- Layouts ---
// A single Suspense boundary can be placed within the layout itself.
import PublicLayout from './layout/PublicLayout'; 
import AdminLayout from './admin/AdminLayout';

// --- Page Components (Lazy Loaded) ---
const Landing = lazy(() => import('./pages/Landing'));
const Booking = lazy(() => import('./pages/Booking'));
const Confirmation = lazy(() => import('./pages/Confirmation'));
const NotFound = lazy(() => import('./pages/NotFound')); // A new, dedicated Not Found page
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const Profile = lazy(() => import('./pages/Profile'));
const AdminLogin = lazy(() => import('./admin/Login'));
const Dashboard = lazy(() => import('./admin/Dashboard'));
const About = lazy(() => import('./pages/About'));
const ServiceAreas = lazy(() => import('./pages/ServiceAreas'));
const EmergencyService = lazy(() => import('./pages/EmergencyService'));
const AdminAppointments = lazy(() => import('./pages/AdminAppointments'));

// --- React Query Client ---
const queryClient = new QueryClient();

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
          <Routes>
            {/* === Public Routes === */}
            {/* The PublicLayout now provides the Suspense boundary for all its children. */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Landing />} />
              <Route path="/about" element={<About />} />
              <Route path="/service-areas" element={<ServiceAreas />} />
              <Route path="/booking" element={<Booking />} />
              <Route path="/confirmation" element={<Confirmation />} />
              <Route path="/emergency" element={<EmergencyService />} />
            </Route>

            {/* === Auth Routes === */}
            {/* Grouping auth routes under a simple Outlet for structural consistency. */}
            <Route element={<Suspense fallback={<div>Loading...</div>}><Outlet /></Suspense>}>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/admin/login" element={<AdminLogin />} />
            </Route>

            {/* === Protected Customer Routes === */}
            <Route element={<Suspense fallback={<div>Loading...</div>}><Outlet /></Suspense>}>
              <Route path="/profile" element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } />
            </Route>

            {/* === Protected Admin Routes === */}
            {/* AdminLayout provides its own Suspense boundary. */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="appointments" element={<AdminAppointments />} />
              {/* Future admin routes can be added here, e.g., <Route path="users" element={<Users />} /> */}
            </Route>

            {/* === Catch-all / Not Found Route === */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
      </ToastProvider>
    </AuthProvider>
  );
}