import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AuthProvider } from './contexts/AuthContextRobust';
import { ToastProvider } from './components/ui/Toast';
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
const CustomersPage = lazy(() => import('./pages/admin/CustomersPage'));
const CustomerProfilePage = lazy(() => import('./pages/admin/CustomerProfilePage'));
const MessageTemplatesPage = lazy(() => import('./pages/admin/MessageTemplatesPage'));
const MessageThreadHarness = lazy(() => import('./pages/e2e/MessageThreadHarness'));
const BoardHarness = lazy(() => import('./pages/e2e/BoardHarness'));

// --- React Query Client ---
export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
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
              <Route path="customers" element={<CustomersPage />} />
              <Route path="customers/:id" element={<CustomerProfilePage />} />
              <Route path="templates" element={<MessageTemplatesPage />} />
              {/* Future admin routes can be added here, e.g., <Route path="users" element={<Users />} /> */}
            </Route>

            {import.meta.env.DEV && (
              <Route element={<Suspense fallback={<div>Loading...</div>}><Outlet /></Suspense>}>
                <Route path="/e2e/message-thread/:appointmentId" element={<MessageThreadHarness />} />
                <Route path="/e2e/board" element={<BoardHarness />} />
              </Route>
            )}

            {/* === Catch-all / Not Found Route === */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}