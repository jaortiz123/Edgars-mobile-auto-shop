import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Suspense } from 'react';
// Lazy-load admin-specific neobrutal styles so public pages are unaffected
import '../styles/admin-neobrutal.css';
import { useAuth } from '@/hooks/useAuth';
import { 
  LayoutDashboard, 
  Users, 
  MessageSquare, 
  LogOut,
  BarChart3
} from 'lucide-react';
import { CardPreferencesProvider } from '@/contexts/CardPreferencesContext';

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
  <div className="admin-neobrutal overlay-faint flex min-h-screen">
      {/* Sidebar */}
  <aside className="w-64 nb-surface bg-white/85 backdrop-blur-sm">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-sp-6 py-sp-4 nb-border border-b">
            <h1 className="text-fs-2 font-bold">Edgar's Admin</h1>
            <p className="text-fs-0 opacity-70">Mobile Auto Shop</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-sp-4 py-sp-6 space-y-sp-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`
                  group flex items-center px-sp-3 py-sp-2 text-fs-1 font-medium rounded-md transition-all nb-border border-2
                  ${item.current
                    ? 'nb-link-active'
                    : 'nb-surface hover:nb-shadow'
                  }
                `}
              >
                <item.icon
                  className={`
                    mr-sp-3 h-5 w-5 flex-shrink-0
                    ${item.current ? '' : 'opacity-70 group-hover:opacity-100'}
                  `}
                />
                {item.name}
              </Link>
            ))}
          </nav>

          {/* Footer */}
          <div className="px-sp-4 py-sp-4 nb-border border-t">
            <button
              onClick={logout}
              className="group flex items-center w-full px-sp-3 py-sp-2 text-fs-1 font-medium rounded-md nb-surface hover:nb-shadow transition-all"
            >
              <LogOut className="mr-sp-3 h-5 w-5 opacity-70 group-hover:opacity-100" />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
  <main className="flex-1 overflow-auto bg-transparent">
        <CardPreferencesProvider>
          <div className="px-sp-8 py-sp-6">
            <Suspense fallback={<div className="p-4 text-sm opacity-70">Loading admin module…</div>}>
              <Outlet />
            </Suspense>
          </div>
        </CardPreferencesProvider>
      </main>
    </div>
  );
}
