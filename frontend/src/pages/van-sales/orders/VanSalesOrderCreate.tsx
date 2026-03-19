import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Send, User, Truck } from 'lucide-react'
import LineItemsEditor, { LineItem, LineItemsTotals, TotalsSummary, createEmptyLineItem, calculateTotals, Discount } from '../../../components/transactions/LineItemsEditor'
import { vanSalesService } from '../../../services/van-sales.service'
import { discountsService } from '../../../services/discounts.service'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { useToast } from '../../../components/ui/Toast'
import SearchableSelect from '../../../components/ui/SearchableSelect'

interface Customer {
  id: string
  name: string
  code?: string
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

export default function VanSalesOrderCreate() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [routes, setRoutes] = useState<Route[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [discounts, setDiscounts] = useState<Discount[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [selectedRoute, setSelectedRoute] = useState('')
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0])
  const [deliveryDate, setDeliveryDate] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [notes, setNotes] = useState('')
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [totals, setTotals] = useState<LineItemsTotals>({ subtotal: 0, discount_amount: 0, tax_amount: 0, total_amount: 0, item_count: 0 })

  useEffect(() => {
    loadFormData()
  }, [])

  const loadFormData = async () => {
    try {
      setLoading(true)
      const [customersRes, routesRes, productsRes, discountsRes] = await Promise.all([
        vanSalesService.getCustomers(),
        vanSalesService.getRoutes(),
        vanSalesService.getProducts(),
        discountsService.getDiscounts({ is_active: true })
      ])
      const rawCustomers = customersRes.data || customersRes
      setCustomers(Array.isArray(rawCustomers) ? rawCustomers : (rawCustomers.customers || []))
      const rawRoutes = routesRes.data || routesRes
      setRoutes(Array.isArray(rawRoutes) ? rawRoutes : (rawRoutes.routes || []))
      const rawProducts = productsRes.data || productsRes
      setProducts(Array.isArray(rawProducts) ? rawProducts : (rawProducts.products || []))
      setDiscounts(discountsRes.map((d: any) => ({ id: d.id, name: d.name, value: d.value, discount_type: d.discount_type })))
    } catch (error) {
      console.error('Failed to load form data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (submit: boolean = false) => {
    if (!selectedCustomer) {
      toast.info('Please select a customer')
      return
    }
    if (!selectedRoute) {
      toast.info('Please select a route')
      return
    }
    if (lineItems.length === 0 || !lineItems.some(item => item.product_id)) {
      toast.info('Please add at least one product')
      return
    }

    try {
      setSaving(true)
      const orderData = {
        customer_id: selectedCustomer,
        route_id: selectedRoute,
        order_date: orderDate,
        delivery_date: deliveryDate,
        payment_method: paymentMethod,
        notes,
        submit,
        items: lineItems.filter(item => item.product_id).map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percentage: item.discount_percentage
        })),
        subtotal: totals.subtotal,
        discount_amount: totals.discount_amount,
        tax_amount: totals.tax_amount,
        total_amount: totals.total_amount
      }

      await vanSalesService.createOrder(orderData)
      navigate('/van-sales/orders')
    } catch (error: any) {
      console.error('Failed to create order:', error)
      toast.error(error.message || 'Failed to create order')
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
          <button onClick={() => navigate('/van-sales/orders')} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create Van Sales Order</h1>
            <p className="text-sm text-gray-600">Add products and calculate pricing</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => handleSubmit(false)} disabled={saving} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-surface-secondary flex items-center gap-2">
            <Save className="w-4 h-4" /> Save as Draft
          </button>
          <button onClick={() => handleSubmit(true)} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
            <Send className="w-4 h-4" /> Submit Order
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5" /> Order Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
                <SearchableSelect
                  options={[
                    { value: '', label: 'Select a customer' },
                    { value: 'customer.id', label: '{customer.name}' },
                  ]}
                  value={selectedCustomer || null}
                  onChange={(val) => setSelectedCustomer(val || '')}
                  placeholder="Select a customer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Route *</label>
                <SearchableSelect
                  options={[
                    { value: '', label: 'Select a route' },
                    { value: 'route.id', label: '{route.name}' },
                  ]}
                  value={selectedRoute || null}
                  onChange={(val) => setSelectedRoute(val || '')}
                  placeholder="Select a route"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Order Date</label>
                <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Date</label>
                <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <SearchableSelect
                  options={[
                    { value: 'cash', label: 'Cash' },
                    { value: 'credit', label: 'Credit' },
                    { value: 'mobile_money', label: 'Mobile Money' },
                  ]}
                  value={paymentMethod}
              onChange={(val) => setPaymentMethod(val)}
                  placeholder="Cash"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Order notes..." className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
            </div>
          </div>

          <LineItemsEditor
            products={products}
            discounts={discounts}
            lineItems={lineItems}
            onLineItemsChange={setLineItems}
            onTotalsChange={setTotals}
            title="Order Items"
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
                <Send className="w-4 h-4" /> {saving ? 'Submitting...' : 'Submit Order'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
