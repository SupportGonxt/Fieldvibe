import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Send, Truck, Package } from 'lucide-react'
import LineItemsEditor, { LineItem, LineItemsTotals, TotalsSummary } from '../../../components/transactions/LineItemsEditor'
import { vanSalesService } from '../../../services/van-sales.service'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { useToast } from '../../../components/ui/Toast'
import SearchableSelect from '../../../components/ui/SearchableSelect'

interface Van {
  id: string
  van_number: string
  driver_name?: string
}

interface Route {
  id: string
  name: string
}

interface Product {
  id: string
  name: string
  price: number
  selling_price?: number
  tax_rate?: number
}

export default function VanLoadCreate() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [vans, setVans] = useState<Van[]>([])
  const [routes, setRoutes] = useState<Route[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [selectedVan, setSelectedVan] = useState('')
  const [selectedRoute, setSelectedRoute] = useState('')
  const [loadDate, setLoadDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [totals, setTotals] = useState<LineItemsTotals>({ subtotal: 0, discount_amount: 0, tax_amount: 0, total_amount: 0, item_count: 0 })

  useEffect(() => {
    loadFormData()
  }, [])

  const loadFormData = async () => {
    try {
      setLoading(true)
      const [vansRes, routesRes, productsRes] = await Promise.all([
        vanSalesService.getVans(),
        vanSalesService.getRoutes(),
        vanSalesService.getProducts()
      ])
      setVans(vansRes.data || vansRes.vans || [])
      setRoutes(routesRes.data || routesRes.routes || [])
      setProducts(productsRes.data || productsRes.products || [])
    } catch (error) {
      console.error('Failed to load form data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (submit: boolean = false) => {
    if (!selectedVan) {
      toast.info('Please select a van')
      return
    }
    if (!selectedRoute) {
      toast.info('Please select a route')
      return
    }
    if (lineItems.length === 0 || !lineItems.some(item => item.product_id)) {
      toast.info('Please add at least one product to load')
      return
    }

    try {
      setSaving(true)
      const loadData = {
        van_id: selectedVan,
        route_id: selectedRoute,
        load_date: loadDate,
        notes,
        submit,
        items: lineItems.filter(item => item.product_id).map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price
        })),
        total_items: totals.item_count,
        total_value: totals.total_amount
      }

      await vanSalesService.createVanLoad(loadData)
      navigate('/van-sales/van-loads')
    } catch (error: any) {
      console.error('Failed to create van load:', error)
      toast.error(error.message || 'Failed to create van load')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/van-sales/van-loads')} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create Van Load</h1>
            <p className="text-sm text-gray-600">Load products onto a van for delivery</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => handleSubmit(false)} disabled={saving} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-surface-secondary flex items-center gap-2">
            <Save className="w-4 h-4" /> Save as Draft
          </button>
          <button onClick={() => handleSubmit(true)} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
            <Send className="w-4 h-4" /> Confirm Load
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Truck className="w-5 h-5" /> Load Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Van *</label>
                <SearchableSelect
                  options={[
                    { value: '', label: 'Select a van' },
                    ...vans.map((van: Van) => ({
                      value: van.id,
                      label: `${van.van_number}${van.driver_name ? ` - ${van.driver_name}` : ''}`
                    }))
                  ]}
                  value={selectedVan || null}
                  onChange={(val) => setSelectedVan(val as string || '')}
                  placeholder="Search vans..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Route *</label>
                <SearchableSelect
                  options={[
                    { value: '', label: 'Select a route' },
                    ...routes.map((route: Route) => ({
                      value: route.id,
                      label: route.name
                    }))
                  ]}
                  value={selectedRoute || null}
                  onChange={(val) => setSelectedRoute(val as string || '')}
                  placeholder="Search routes..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Load Date</label>
                <input type="date" value={loadDate} onChange={(e) => setLoadDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Load notes..." className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
            </div>
          </div>

          <LineItemsEditor
            products={products}
            lineItems={lineItems}
            onLineItemsChange={setLineItems}
            onTotalsChange={setTotals}
            title="Products to Load"
          />
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-6">
            <TotalsSummary totals={totals} />
            <div className="bg-white rounded-lg shadow p-6 space-y-3">
              <button onClick={() => handleSubmit(false)} disabled={saving} className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-surface-secondary flex items-center justify-center gap-2">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save as Draft'}
              </button>
              <button onClick={() => handleSubmit(true)} disabled={saving} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2">
                <Send className="w-4 h-4" /> {saving ? 'Confirming...' : 'Confirm Load'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
