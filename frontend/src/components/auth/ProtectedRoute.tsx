import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore, hasRole, hasExactRole, hasPermission } from '../../store/auth.store'

interface ProtectedRouteProps {
  children: ReactNode
  requiredRole?: string
  // Strict role match — bypasses the admin-equivalence (backoffice_admin/general_manager/
  // super_admin) that requiredRole grants. Only for surfaces meant for that role alone.
  exactRole?: string
  requiredPermission?: string
  fallback?: ReactNode
}

export default function ProtectedRoute({
  children,
  requiredRole,
  exactRole,
  requiredPermission,
  fallback
}: ProtectedRouteProps) {
  const { isAuthenticated, user, hydrated } = useAuthStore()
  const location = useLocation()

  // Wait for hydration to complete before making auth decisions
  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-secondary">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Not authenticated - redirect to login
  if (!isAuthenticated || !user) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />
  }

  // Check exact role requirement (no admin-equivalence)
  if (exactRole && !hasExactRole(exactRole)) {
    if (fallback) {
      return <>{fallback}</>
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-secondary">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Access Denied
          </h1>
          <p className="text-gray-600 mb-4">
            You don't have permission to access this page.
          </p>
          <button
            onClick={() => window.history.back()}
            className="btn-primary"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  // Check role requirement
  if (requiredRole && !hasRole(requiredRole)) {
    if (fallback) {
      return <>{fallback}</>
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-secondary">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Access Denied
          </h1>
          <p className="text-gray-600 mb-4">
            You don't have permission to access this page.
          </p>
          <button
            onClick={() => window.history.back()}
            className="btn-primary"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  // Check permission requirement
  if (requiredPermission && !hasPermission(requiredPermission)) {
    if (fallback) {
      return <>{fallback}</>
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-secondary">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Insufficient Permissions
          </h1>
          <p className="text-gray-600 mb-4">
            You don't have the required permissions to access this feature.
          </p>
          <button
            onClick={() => window.history.back()}
            className="btn-primary"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
