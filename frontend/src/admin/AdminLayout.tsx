import { Link, Outlet, useNavigate } from 'react-router-dom'
import { authAPI } from '../services/api'

export default function AdminLayout() {
  const navigate = useNavigate()
  const logout = async () => {
    await authAPI.logout()
    navigate('/admin/login')
  }
  return (
    <div className="flex min-h-screen">
      <aside className="w-60 bg-gray-200 p-4 space-y-2">
        <Link to="/admin">Dashboard</Link>
        <button onClick={logout}>Logout</button>
      </aside>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  )
}
