import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Send, RotateCcw, FileText } from 'lucide-react'
import LineItemsEditor, { LineItem, LineItemsTotals, TotalsSummary } from '../../../components/transactions/LineItemsEditor'
import { salesService } from '../../../services/sales.service'
import { productsService } from '../../../services/products.service'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { useToast } from '../../../components/ui/Toast'
import SearchableSelect from '../../../components/ui/SearchableSelect'

interface Order {
  id: string
  order_number: string
  customer_name: string
  status: string
}

interface Product {
  id: string
  name: string
  price: number
  selling_price?: number
  tax_rate?: number
}

export default function SalesReturnCreate() {
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
      // Use Promise.allSettled to handle partial failures gracefully
      const [ordersRes, productsRes] = await Promise.allSettled([
        salesService.getOrders(),
        productsService.getProducts()
      ])
      if (ordersRes.status === 'fulfilled') {
        const resp = ordersRes.value
        const allOrders = resp?.data?.data?.orders || resp?.data?.data || resp?.data?.orders || resp?.data || []
        const orderList = Array.isArray(allOrders) ? allOrders : []
        // Include all orders (not just fulfilled) so the dropdown is populated; filter loosely
        const returnableOrders = orderList.filter((o: any) => 
          ['fulfilled', 'delivered', 'completed', 'FULFILLED', 'DELIVERED', 'COMPLETED', 'pending', 'PENDING', 'processing', 'PROCESSING'].includes(o.status)
        )
        setOrders(returnableOrders.length > 0 ? returnableOrders : orderList)
      }
      if (productsRes.status === 'fulfilled') {
        const prodData = productsRes.value
        setProducts(prodData.products || [])
      }
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
          unit_price: item.unit_price,
          reason: reason
        })),
        subtotal: totals.subtotal,
        tax_amount: totals.tax_amount,
        total_amount: totals.total_amount
      }

      await salesService.createReturn(returnData)
      navigate('/sales/returns')
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
          <button onClick={() => navigate('/sales/returns')} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create Sales Return</h1>
            <p className="text-sm text-gray-600">Select products to return from an order</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => handleSubmit(false)} disabled={saving} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-surface-secondary flex items-center gap-2">
            <Save className="w-4 h-4" /> Save as Draft
          </button>
          <button onClick={() => handleSubmit(true)} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
            <Send className="w-4 h-4" /> Submit Return
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-3 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-blue-600" /> Return Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Order *</label>
                <SearchableSelect
                  options={[
                    { value: '', label: 'Select an order' },
                    { value: 'order.id', label: '{order.order_number} - {order.customer_name}' },
                  ]}
                  value={selectedOrder || null}
                  onChange={(val) => setSelectedOrder(val || '')}
                  placeholder="Select an order"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Return Date</label>
                <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 hover:border-gray-300 transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Return Reason *</label>
                <SearchableSelect
                  options={[
                    { value: '', label: 'Select a reason' },
                    { value: 'defective', label: 'Defective Product' },
                    { value: 'wrong_item', label: 'Wrong Item' },
                    { value: 'damaged', label: 'Damaged in Transit' },
                    { value: 'not_needed', label: 'No Longer Needed' },
                    { value: 'quality', label: 'Quality Issues' },
                    { value: 'other', label: 'Other' },
                  ]}
                  value={reason || null}
                  onChange={(val) => setReason(val || '')}
                  placeholder="Select a reason"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Return notes..." className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 hover:border-gray-300 transition-colors" />
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

        <div className="xl:col-span-1">
          <div className="sticky top-6 space-y-6">
            <TotalsSummary totals={totals} />
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-3">
              <button onClick={() => handleSubmit(false)} disabled={saving} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2 text-gray-700 font-medium transition-colors">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save as Draft'}
              </button>
              <button onClick={() => handleSubmit(true)} disabled={saving} className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 font-medium transition-colors shadow-sm">
                <Send className="w-4 h-4" /> {saving ? 'Submitting...' : 'Submit Return'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
