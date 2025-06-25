import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PublicLayout from './layout/PublicLayout'
import { Suspense, lazy } from 'react'
import AdminLayout from './admin/AdminLayout'

const Landing = lazy(() => import('./pages/Landing'))
const Booking = lazy(() => import('./pages/Booking'))
const Confirmation = lazy(() => import('./pages/Confirmation'))
const Login = lazy(() => import('./admin/Login'))
const Dashboard = lazy(() => import('./admin/Dashboard'))

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Suspense fallback={null}><Landing /></Suspense>} />
            <Route path="/booking" element={<Suspense fallback={null}><Booking /></Suspense>} />
            <Route path="/confirmation" element={<Suspense fallback={null}><Confirmation /></Suspense>} />
          </Route>
          <Route path="/admin/login" element={<Suspense fallback={null}><Login /></Suspense>} />
          <Route path="/admin/*" element={<AdminLayout />}>
            <Route index element={<Suspense fallback={null}><Dashboard /></Suspense>} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
