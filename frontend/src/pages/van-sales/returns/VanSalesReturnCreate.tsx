import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Send, RotateCcw, Package } from 'lucide-react'
import LineItemsEditor, { LineItem, LineItemsTotals, TotalsSummary } from '../../../components/transactions/LineItemsEditor'
import { vanSalesService } from '../../../services/van-sales.service'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { useToast } from '../../../components/ui/Toast'

interface Order {
  id: string
  order_number: string
  customer_name: string
  items?: any[]
}

interface Product {
  id: string
  name: string
  price: number
  selling_price?: number
  tax_rate?: number
}

export default function VanSalesReturnCreate() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [selectedOrder, setSelectedOrder] = useState('')
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0])
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [totals, setTotals] = useState<LineItemsTotals>({ subtotal: 0, discount_amount: 0, tax_amount: 0, total_amount: 0, item_count: 0 })

  useEffect(() => {
    loadFormData()
  }, [])

  const loadFormData = async () => {
    try {
      setLoading(true)
      const [ordersRes, productsRes] = await Promise.all([
        vanSalesService.getOrders(),
        vanSalesService.getProducts()
      ])
      const ordersData = ordersRes.data || ordersRes.orders || []
      setOrders(ordersData.filter((o: any) => ['fulfilled', 'delivered', 'completed'].includes(o.status)))
      setProducts(productsRes.data || productsRes.products || [])
    } catch (error) {
      console.error('Failed to load form data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (submit: boolean = false) => {
    if (!selectedOrder) {
      toast.info('Please select an order')
      return
    }
    if (!reason) {
      toast.info('Please select a return reason')
      return
    }
    if (lineItems.length === 0 || !lineItems.some(item => item.product_id)) {
      toast.info('Please add at least one product to return')
      return
    }

    try {
      setSaving(true)
      const returnData = {
        order_id: selectedOrder,
        return_date: returnDate,
        reason,
        notes,
        submit,
        items: lineItems.filter(item => item.product_id).map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price
        })),
        subtotal: totals.subtotal,
        tax_amount: totals.tax_amount,
        total_amount: totals.total_amount
      }

      await vanSalesService.createReturn(returnData)
      navigate('/van-sales/returns')
    } catch (error: any) {
      console.error('Failed to create return:', error)
      toast.error(error.message || 'Failed to create return')
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
          <button onClick={() => navigate('/van-sales/returns')} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create Van Sales Return</h1>
            <p className="text-sm text-gray-600">Process a return from van sales</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => handleSubmit(false)} disabled={saving} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-surface-secondary flex items-center gap-2">
            <Save className="w-4 h-4" /> Save as Draft
          </button>
          <button onClick={() => handleSubmit(true)} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
            <Send className="w-4 h-4" /> Process Return
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <RotateCcw className="w-5 h-5" /> Return Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Original Order *</label>
                <select value={selectedOrder} onChange={(e) => setSelectedOrder(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="">Select an order</option>
                  {orders.map((order) => (
                    <option key={order.id} value={order.id}>{order.order_number} - {order.customer_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Return Date</label>
                <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Return Reason *</label>
                <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="">Select reason</option>
                  <option value="damaged">Damaged Product</option>
                  <option value="expired">Expired Product</option>
                  <option value="wrong_item">Wrong Item</option>
                  <option value="customer_request">Customer Request</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Return notes..." className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
            </div>
          </div>

          <LineItemsEditor
            products={products}
            lineItems={lineItems}
            onLineItemsChange={setLineItems}
            onTotalsChange={setTotals}
            title="Return Items"
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
                <Send className="w-4 h-4" /> {saving ? 'Processing...' : 'Process Return'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
