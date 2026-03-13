import { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { 
  Home, 
  MapPin, 
  Package, 
  User,
  Menu,
  LogOut
} from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'

interface MobileLayoutProps {
  children: ReactNode
}

export default function MobileLayout({ children }: MobileLayoutProps) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/auth/login')
  }

  return (
    <div className="min-h-screen bg-surface-secondary flex flex-col">
      {/* Mobile Header */}
      <header className="bg-primary-600 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-md">
        <div className="flex items-center">
          <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center">
            <span className="text-sm font-bold text-primary-600">SS</span>
          </div>
          <span className="ml-2 text-lg font-bold">FieldVibe</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm">{user?.first_name}</span>
          <button
            onClick={handleLogout}
            className="p-2 hover:bg-primary-700 rounded-lg transition-colors"
            aria-label="Logout"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-2 shadow-lg z-50">
        <div className="flex items-center justify-around">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                isActive
                  ? 'text-primary-600 bg-primary-50'
                  : 'text-gray-600 hover:text-primary-600 hover:bg-surface-secondary'
              }`
            }
          >
            <Home className="h-6 w-6" />
            <span className="text-xs font-medium">Home</span>
          </NavLink>

          <NavLink
            to="/field-agents/workflow"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                isActive
                  ? 'text-primary-600 bg-primary-50'
                  : 'text-gray-600 hover:text-primary-600 hover:bg-surface-secondary'
              }`
            }
          >
            <MapPin className="h-6 w-6" />
            <span className="text-xs font-medium">Workflow</span>
          </NavLink>

          <NavLink
            to="/van-sales/workflow"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                isActive
                  ? 'text-primary-600 bg-primary-50'
                  : 'text-gray-600 hover:text-primary-600 hover:bg-surface-secondary'
              }`
            }
          >
            <Package className="h-6 w-6" />
            <span className="text-xs font-medium">Van Sales</span>
          </NavLink>

          <NavLink
            to="/field-operations/dashboard"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                isActive
                  ? 'text-primary-600 bg-primary-50'
                  : 'text-gray-600 hover:text-primary-600 hover:bg-surface-secondary'
              }`
            }
          >
            <User className="h-6 w-6" />
            <span className="text-xs font-medium">Profile</span>
          </NavLink>
        </div>
      </nav>
    </div>
  )
}
