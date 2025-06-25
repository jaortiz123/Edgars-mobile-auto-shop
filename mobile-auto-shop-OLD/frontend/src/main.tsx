import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, AuthDispatchProvider } from './context/AuthContext'
import './index.css'

// Layouts and Pages
import AdminLayout from './admin/AdminLayout'
import Login from './admin/Login'
import Dashboard from './admin/Dashboard'
import PublicLayout from './layout/PublicLayout'
import Landing from './pages/Landing'
import Booking from './pages/Booking'
import Confirmation from './pages/Confirmation'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthDispatchProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<PublicLayout />}>
                <Route path="/" element={<Landing />} />
                <Route path="/booking" element={<Booking />} />
                <Route path="/confirmation" element={<Confirmation />} />
              </Route>
              <Route path="/admin/login" element={<Login />} />
              <Route path="/admin/*" element={<AdminLayout />}>
                <Route index element={<Dashboard />} />
              </Route>
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </BrowserRouter>
        </AuthDispatchProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
