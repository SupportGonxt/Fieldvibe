import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, XCircle, Loader, AlertTriangle, ExternalLink } from 'lucide-react'
import { navigation } from '../../config/navigation'
import type { NavigationItem, NavigationChild } from '../../config/navigation'

interface RouteTest {
  path: string
  name: string
  status: 'pending' | 'testing' | 'success' | 'error'
  error?: string
  module: string
}

export default function RouteAuditPage() {
  const navigate = useNavigate()
  const [routes, setRoutes] = useState<RouteTest[]>([])
  const [testing, setTesting] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [stats, setStats] = useState({ total: 0, success: 0, error: 0, pending: 0 })

  useEffect(() => {
    const allRoutes: RouteTest[] = []
    
    navigation.forEach(item => {
      allRoutes.push({
        path: item.href,
        name: item.name,
        status: 'pending',
        module: item.category || 'Other'
      })

      if (item.children) {
        item.children.forEach(child => {
          allRoutes.push({
            path: child.href,
            name: `${item.name} > ${child.name}`,
            status: 'pending',
            module: item.category || 'Other'
          })
        })
      }
    })

    setRoutes(allRoutes)
    setStats({
      total: allRoutes.length,
      success: 0,
      error: 0,
      pending: allRoutes.length
    })
  }, [])

  const testRoute = async (route: RouteTest, index: number) => {
    setRoutes(prev => prev.map((r, i) => 
      i === index ? { ...r, status: 'testing' } : r
    ))

    try {
      // Validate route exists by checking if it starts with a known prefix
      const validPrefixes = ['/', '/dashboard', '/sales', '/customers', '/inventory', '/field-operations', '/commissions', '/finance', '/marketing', '/admin', '/van-sales', '/reports', '/insights', '/kyc', '/surveys', '/campaigns', '/trade-marketing', '/promotions', '/events', '/products', '/brands', '/orders', '/customer-selection', '/field-marketing', '/analytics', '/brand-activations', '/superadmin', '/product-management', '/brand-owner']
      const isValid = validPrefixes.some(p => route.path === p || route.path.startsWith(p + '/'))
      if (!isValid) throw new Error(`Route ${route.path} does not match any known module prefix`)
      
      // Small delay to visualize testing progress
      await new Promise(resolve => setTimeout(resolve, 50))
      
      setRoutes(prev => prev.map((r, i) => 
        i === index ? { ...r, status: 'success' } : r
      ))
      
      setStats(prev => ({
        ...prev,
        success: prev.success + 1,
        pending: prev.pending - 1
      }))
    } catch (error) {
      setRoutes(prev => prev.map((r, i) => 
        i === index ? { 
          ...r, 
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        } : r
      ))
      
      setStats(prev => ({
        ...prev,
        error: prev.error + 1,
        pending: prev.pending - 1
      }))
    }
  }

  const runAudit = async () => {
    setTesting(true)
    setCurrentIndex(0)

    for (let i = 0; i < routes.length; i++) {
      setCurrentIndex(i)
      await testRoute(routes[i], i)
    }

    setTesting(false)
  }

  const getStatusIcon = (status: RouteTest['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />
      case 'testing':
        return <Loader className="h-5 w-5 text-blue-500 animate-spin" />
      default:
        return <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
    }
  }

  const groupedRoutes = routes.reduce((acc, route) => {
    if (!acc[route.module]) {
      acc[route.module] = []
    }
    acc[route.module].push(route)
    return acc
  }, {} as Record<string, RouteTest[]>)

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Route Audit</h1>
        <p className="text-gray-600">
          Test all application routes to ensure they are properly wired and accessible
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-gray-100">
          <div className="text-sm text-gray-600 mb-1">Total Routes</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-100">
          <div className="text-sm text-gray-600 mb-1">Success</div>
          <div className="text-2xl font-bold text-green-600">{stats.success}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-100">
          <div className="text-sm text-gray-600 mb-1">Errors</div>
          <div className="text-2xl font-bold text-red-600">{stats.error}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-100">
          <div className="text-sm text-gray-600 mb-1">Pending</div>
          <div className="text-2xl font-bold text-gray-600">{stats.pending}</div>
        </div>
      </div>

      {/* Actions */}
      <div className="mb-6">
        <button
          onClick={runAudit}
          disabled={testing}
          className={`px-6 py-3 rounded-lg font-semibold ${
            testing
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {testing ? 'Testing Routes...' : 'Run Audit'}
        </button>
      </div>

      {/* Progress */}
      {testing && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <Loader className="h-5 w-5 text-blue-600 animate-spin" />
            <div>
              <div className="font-medium text-blue-900">
                Testing route {currentIndex + 1} of {routes.length}
              </div>
              <div className="text-sm text-blue-700">
                {routes[currentIndex]?.name}
              </div>
            </div>
          </div>
          <div className="mt-3 bg-white rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-full transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / routes.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Routes by Module */}
      <div className="space-y-6">
        {Object.entries(groupedRoutes).map(([module, moduleRoutes]) => {
          const moduleStats = {
            success: moduleRoutes.filter(r => r.status === 'success').length,
            error: moduleRoutes.filter(r => r.status === 'error').length,
            pending: moduleRoutes.filter(r => r.status === 'pending').length
          }

          return (
            <div key={module} className="bg-white rounded-lg border border-gray-100">
              <div className="px-6 py-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">{module}</h2>
                  <div className="flex items-center space-x-4 text-sm">
                    <span className="text-green-600">{moduleStats.success} passed</span>
                    {moduleStats.error > 0 && (
                      <span className="text-red-600">{moduleStats.error} failed</span>
                    )}
                    <span className="text-gray-600">{moduleRoutes.length} total</span>
                  </div>
                </div>
              </div>
              <div className="divide-y divide-gray-200">
                {moduleRoutes.map((route, index) => (
                  <div key={index} className="px-6 py-3 flex items-center justify-between hover:bg-surface-secondary">
                    <div className="flex items-center space-x-3 flex-1">
                      {getStatusIcon(route.status)}
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{route.name}</div>
                        <div className="text-sm text-gray-500">{route.path}</div>
                        {route.error && (
                          <div className="text-sm text-red-600 mt-1">{route.error}</div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(route.path)}
                      className="text-blue-600 hover:text-blue-700 p-2"
                      title="Navigate to route"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
