import { useState, useEffect } from 'react'
import { useAuthStore } from '../../store/auth.store'
import { apiClient } from '../../services/api.service'

interface RouteTest {
  path: string
  type: 'static' | 'dynamic'
  provider?: () => Promise<string>
  status: 'pending' | 'loading' | 'success' | 'error'
  error?: string
  loadTime?: number
}

interface ApiHealthCheck {
  name: string
  endpoint: string
  status: 'pending' | 'loading' | 'success' | 'error'
  error?: string
  loadTime?: number
  responseData?: any
}

interface ConsoleError {
  message: string
  timestamp: number
  stack?: string
}

export default function SmokeTestPage() {
  const { user } = useAuthStore()
  const [tests, setTests] = useState<RouteTest[]>([])
  const [apiHealthChecks, setApiHealthChecks] = useState<ApiHealthCheck[]>([])
  const [consoleErrors, setConsoleErrors] = useState<ConsoleError[]>([])
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [activeTab, setActiveTab] = useState<'routes' | 'api' | 'console'>('api')

  const providers = {
    customerId: async () => {
      const res = await apiClient.get('/customers?limit=1')
      return res.data.data?.customers?.[0]?.id || res.data.data?.[0]?.id || res.data[0]?.id
    },
    productId: async () => {
      const res = await apiClient.get('/products?limit=1')
      return res.data.data?.products?.[0]?.id || res.data.data?.[0]?.id || res.data[0]?.id
    },
    orderId: async () => {
      const res = await apiClient.get('/orders?limit=1')
      return res.data.data?.orders?.[0]?.id || res.data.data?.[0]?.id || res.data[0]?.id
    },
    vanId: async () => {
      const res = await apiClient.get('/vans?limit=1')
      return res.data.data?.[0]?.id || res.data[0]?.id
    },
    routeId: async () => {
      const res = await apiClient.get('/routes?limit=1')
      return res.data.data?.[0]?.id || res.data[0]?.id
    },
  }

  const routeRegistry: Omit<RouteTest, 'status'>[] = [
    { path: '/customers/:id', type: 'dynamic', provider: providers.customerId },
    { path: '/products/:id', type: 'dynamic', provider: providers.productId },
    { path: '/orders/:id', type: 'dynamic', provider: providers.orderId },
    
    { path: '/van-sales/routes/:id', type: 'dynamic', provider: providers.routeId },
    { path: '/van-sales/orders/create', type: 'static' },
    { path: '/van-sales/orders/new', type: 'static' },
    { path: '/van-sales/returns/create', type: 'static' },
    { path: '/van-sales/van-loads/create', type: 'static' },
    { path: '/van-sales/cash-reconciliation/create', type: 'static' },
    
    { path: '/inventory/adjustments/create', type: 'static' },
    { path: '/inventory/issues/create', type: 'static' },
    { path: '/inventory/receipts/create', type: 'static' },
    { path: '/inventory/stock-counts/create', type: 'static' },
    { path: '/inventory/transfers/create', type: 'static' },
    
    { path: '/sales/orders/create', type: 'static' },
    { path: '/sales/invoices/create', type: 'static' },
    { path: '/sales/payments/create', type: 'static' },
    { path: '/sales/credit-notes/create', type: 'static' },
    { path: '/sales/returns/create', type: 'static' },
    
    { path: '/marketing/campaigns/create', type: 'static' },
    { path: '/marketing/events/create', type: 'static' },
    { path: '/marketing/activations/create', type: 'static' },
    { path: '/marketing/promotions/create', type: 'static' },
    
    { path: '/crm/customers/create', type: 'static' },
    { path: '/crm/kyc-cases/create', type: 'static' },
    { path: '/crm/surveys/create', type: 'static' },
    
    { path: '/finance/cash-reconciliation/create', type: 'static' },
    
    { path: '/field-operations/boards/create', type: 'static' },
    { path: '/field-operations/products/create', type: 'static' },
    { path: '/field-operations/visits/create', type: 'static' },
  ]

  useEffect(() => {
    setTests(routeRegistry.map(r => ({ ...r, status: 'pending' })))
    
    const healthChecks: Omit<ApiHealthCheck, 'status'>[] = [
      { name: 'Database Health', endpoint: '/db/health' },
      { name: 'Users API', endpoint: '/users?limit=1' },
      { name: 'Customers API', endpoint: '/customers?limit=1' },
      { name: 'Products API', endpoint: '/products?limit=1' },
      { name: 'Orders API', endpoint: '/orders?limit=1' },
      { name: 'RBAC Roles', endpoint: '/rbac/roles' },
      { name: 'GPS Tracking', endpoint: '/gps/agents/active' },
      { name: 'Audit Logs', endpoint: '/audit-logs?limit=1' },
      { name: 'Analytics Sales', endpoint: '/analytics-new/sales?period=daily' },
    ]
    setApiHealthChecks(healthChecks.map(h => ({ ...h, status: 'pending' })))
    
    const originalConsoleError = console.error
    const errors: ConsoleError[] = []
    console.error = (...args: any[]) => {
      errors.push({
        message: args.map(a => String(a)).join(' '),
        timestamp: Date.now(),
        stack: new Error().stack
      })
      setConsoleErrors([...errors])
      originalConsoleError(...args)
    }
    
    return () => {
      console.error = originalConsoleError
    }
  }, [])

  const runApiHealthChecks = async () => {
    setRunning(true)
    setProgress(0)
    setConsoleErrors([])

    for (let i = 0; i < apiHealthChecks.length; i++) {
      const check = apiHealthChecks[i]
      
      setApiHealthChecks(prev => prev.map((c, idx) => 
        idx === i ? { ...c, status: 'loading' } : c
      ))

      try {
        const startTime = Date.now()
        const response = await apiClient.get(check.endpoint)
        const loadTime = Date.now() - startTime

        setApiHealthChecks(prev => prev.map((c, idx) => 
          idx === i ? { 
            ...c, 
            status: 'success', 
            loadTime,
            responseData: response.data 
          } : c
        ))
      } catch (error: any) {
        setApiHealthChecks(prev => prev.map((c, idx) => 
          idx === i ? { 
            ...c, 
            status: 'error', 
            error: error.message || 'Unknown error' 
          } : c
        ))
      }

      setProgress(((i + 1) / apiHealthChecks.length) * 100)
    }

    setRunning(false)
  }

  const runRouteTests = async () => {
    setRunning(true)
    setProgress(0)

    for (let i = 0; i < tests.length; i++) {
      const test = tests[i]
      
      setTests(prev => prev.map((t, idx) => 
        idx === i ? { ...t, status: 'loading' } : t
      ))

      try {
        const startTime = Date.now()
        let testPath = test.path

        if (test.type === 'dynamic' && test.provider) {
          try {
            const id = await test.provider()
            if (!id) {
              throw new Error('No ID available from provider')
            }
            testPath = test.path.replace(':id', id)
          } catch (err: any) {
            throw new Error(`Provider failed: ${err.message}`)
          }
        }

        const loadTime = Date.now() - startTime

        setTests(prev => prev.map((t, idx) => 
          idx === i ? { ...t, status: 'success', loadTime } : t
        ))
      } catch (error: any) {
        setTests(prev => prev.map((t, idx) => 
          idx === i ? { 
            ...t, 
            status: 'error', 
            error: error.message || 'Unknown error' 
          } : t
        ))
      }

      setProgress(((i + 1) / tests.length) * 100)
    }

    setRunning(false)
  }

  const routeSuccessCount = tests.filter(t => t.status === 'success').length
  const routeErrorCount = tests.filter(t => t.status === 'error').length
  const routePendingCount = tests.filter(t => t.status === 'pending').length
  
  const apiSuccessCount = apiHealthChecks.filter(c => c.status === 'success').length
  const apiErrorCount = apiHealthChecks.filter(c => c.status === 'error').length
  const apiPendingCount = apiHealthChecks.filter(c => c.status === 'pending').length

  const successCount = routeSuccessCount + apiSuccessCount
  const errorCount = routeErrorCount + apiErrorCount
  const pendingCount = routePendingCount + apiPendingCount

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">QA & Test Micro-Frontend</h1>
        <p className="text-gray-600 mt-2">
          Comprehensive testing suite for API health, routes, and console errors
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-100">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('api')}
            className={`${
              activeTab === 'api'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            API Health Checks ({apiHealthChecks.length})
          </button>
          <button
            onClick={() => setActiveTab('routes')}
            className={`${
              activeTab === 'routes'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Route Tests ({tests.length})
          </button>
          <button
            onClick={() => setActiveTab('console')}
            className={`${
              activeTab === 'console'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Console Errors ({consoleErrors.length})
          </button>
        </nav>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-gray-900">{tests.length}</div>
          <div className="text-sm text-gray-600">Total Routes</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-green-600">{successCount}</div>
          <div className="text-sm text-gray-600">Passed</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-red-600">{errorCount}</div>
          <div className="text-sm text-gray-600">Failed</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-gray-400">{pendingCount}</div>
          <div className="text-sm text-gray-600">Pending</div>
        </div>
      </div>

      {/* Progress */}
      {running && (
        <div className="mb-6">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Testing... {Math.round(progress)}% complete
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="mb-6">
        <button
          onClick={() => { runApiHealthChecks(); runRouteTests(); }}
          disabled={running}
          className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {running ? 'Running Tests...' : 'Run Smoke Test'}
        </button>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-surface-secondary">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Route
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Load Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Error
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {tests.map((test, idx) => (
              <tr key={idx} className={test.status === 'loading' ? 'bg-blue-50' : ''}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {test.path}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {test.type}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {test.status === 'pending' && (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                      Pending
                    </span>
                  )}
                  {test.status === 'loading' && (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      Loading...
                    </span>
                  )}
                  {test.status === 'success' && (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      Success
                    </span>
                  )}
                  {test.status === 'error' && (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                      Error
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {test.loadTime ? `${test.loadTime}ms` : '-'}
                </td>
                <td className="px-6 py-4 text-sm text-red-600">
                  {test.error || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Export Results */}
      {!running && (successCount > 0 || errorCount > 0) && (
        <div className="mt-6">
          <button
            onClick={() => {
              const results = tests.map(t => ({
                route: t.path,
                type: t.type,
                status: t.status,
                loadTime: t.loadTime,
                error: t.error
              }))
              const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `smoke-test-results-${new Date().toISOString()}.json`
              a.click()
            }}
            className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
          >
            Export Results as JSON
          </button>
        </div>
      )}
    </div>
  )
}
