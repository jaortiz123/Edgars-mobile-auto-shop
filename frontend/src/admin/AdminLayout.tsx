import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { 
  LayoutDashboard, 
  Users, 
  MessageSquare, 
  LogOut,
  BarChart3
} from 'lucide-react';

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout: authLogout } = useAuth();
  
  const logout = async () => {
    authLogout();
    navigate('/admin/login');
  };

  const navigation = [
    {
      name: 'Dashboard',
      href: '/admin/dashboard',
      icon: LayoutDashboard,
      current: location.pathname === '/admin/dashboard' || location.pathname === '/admin'
    },
    {
      name: 'Customers',
      href: '/admin/customers',
      icon: Users,
      current: location.pathname === '/admin/customers'
    },
    {
      name: 'SMS Notifications',
      href: '/admin/notifications',
      icon: MessageSquare,
      current: location.pathname === '/admin/notifications'
    },
    {
      name: 'Analytics',
      href: '/admin/analytics',
      icon: BarChart3,
      current: location.pathname === '/admin/analytics'
    }
  ];

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-800">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-sm border-r border-gray-200">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-sp-6 py-sp-4 border-b border-gray-200">
            <h1 className="text-fs-2 font-bold text-gray-900">Edgar's Admin</h1>
            <p className="text-fs-0 text-gray-500">Mobile Auto Shop</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-sp-4 py-sp-6 space-y-sp-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`
                  group flex items-center px-sp-3 py-sp-2 text-fs-1 font-medium rounded-md transition-colors
                  ${item.current
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
              >
                <item.icon
                  className={`
                    mr-sp-3 h-5 w-5 flex-shrink-0
                    ${item.current ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}
                  `}
                />
                {item.name}
              </Link>
            ))}
          </nav>

          {/* Footer */}
          <div className="px-sp-4 py-sp-4 border-t border-gray-200">
            <button
              onClick={logout}
              className="group flex items-center w-full px-sp-3 py-sp-2 text-fs-1 font-medium text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              <LogOut className="mr-sp-3 h-5 w-5 text-gray-400 group-hover:text-gray-500" />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="px-sp-8 py-sp-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
