import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit2, Printer, Download, Package, DollarSign, Calendar, User, MapPin, CheckCircle, XCircle, Clock, Truck, FileText, CreditCard, Save, X, Plus, Trash2, History, RefreshCw } from 'lucide-react'
import { ordersService } from '../../services/orders.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import ErrorState from '../../components/ui/ErrorState'
import { useToast } from '../../components/ui/Toast'
import toast from 'react-hot-toast'

interface OrderItem {
  id: string
  productId: string
  productName: string
  sku: string
  quantity: number
  unitPrice: number
  subtotal: number
  taxAmount: number
  totalAmount: number
}

interface Order {
  id: string
  orderNumber: string
  orderDate: string
  deliveryDate: string
  customerId: string
  customerName: string
  customerEmail: string
  customerPhone: string
  agentId: string
  agentName: string
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
  paymentStatus: 'pending' | 'partial' | 'paid' | 'refunded'
  paymentMethod: string
  shippingAddress: string
  billingAddress: string
  subtotal: number
  taxAmount: number
  shippingCost: number
  discount: number
  totalAmount: number
  notes: string
  items: OrderItem[]
  timeline: TimelineEvent[]
}

interface TimelineEvent {
  id: string
  timestamp: string
  event: string
  description: string
  user: string
}

export default function OrderDetailsPage() {
  const { toast } = useToast()
  const { id } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [activeTab, setActiveTab] = useState('details')
  const [availableTransitions, setAvailableTransitions] = useState<Array<{ status: string; label: string }>>([])
  const [statusHistory, setStatusHistory] = useState<any[]>([])
  const [transitioning, setTransitioning] = useState(false)

  useEffect(() => {
    fetchOrderDetails()
  }, [id])

  useEffect(() => {
    if (id) {
      loadTransitions()
      loadStatusHistory()
    }
  }, [id, order?.status])

  const loadTransitions = async () => {
    if (!id) return
    try {
      const data = await ordersService.getAvailableTransitions(id)
      setAvailableTransitions(data.available_transitions || [])
    } catch (error) {
      console.error('Failed to load transitions:', error)
    }
  }

  const loadStatusHistory = async () => {
    if (!id) return
    try {
      const history = await ordersService.getOrderStatusHistory(id)
      setStatusHistory(history)
    } catch (error) {
      console.error('Failed to load status history:', error)
    }
  }

  const fetchOrderDetails = async () => {
    try {
      setLoading(true)
      
      if (!id) {
        console.error('No order ID provided')
        setLoading(false)
        return
      }

      const orderData = await ordersService.getOrder(id)

      if (orderData) {
        const mappedOrder: Order = {
          id: orderData.id,
          orderNumber: orderData.order_number,
          orderDate: orderData.order_date || orderData.created_at,
          deliveryDate: orderData.delivery_date || '',
          customerId: orderData.customer_id,
          customerName: orderData.customer_name || orderData.customer?.name || 'Unknown Customer',
          customerEmail: orderData.customer_email || orderData.customer?.email || '',
          customerPhone: orderData.customer_phone || orderData.customer?.phone || '',
          agentId: orderData.agent_id || orderData.salesman_id || '',
          agentName: orderData.agent_name || 'Field Agent',
          status: orderData.status || orderData.order_status,
          paymentStatus: orderData.payment_status,
          paymentMethod: orderData.payment_method || '',
          shippingAddress: '',
          billingAddress: '',
          subtotal: orderData.subtotal,
          taxAmount: orderData.tax_amount,
          shippingCost: 0,
          discount: orderData.discount_amount,
          totalAmount: orderData.total_amount,
          notes: orderData.notes || '',
          items: (orderData.items || []).map((item: any) => ({
            id: item.id,
            productId: item.product_id,
            productName: item.product_name || item.product?.name || 'Unknown Product',
            sku: item.product_sku || item.product?.sku || '',
            quantity: item.quantity || 0,
            unitPrice: item.unit_price || 0,
            subtotal: (item.quantity || 0) * (item.unit_price || 0),
            taxAmount: item.tax_amount || 0,
            totalAmount: item.line_total || item.total_amount || (item.quantity || 0) * (item.unit_price || 0)
          })),
          timeline: [
            {
              id: '1',
              timestamp: orderData.created_at,
              event: 'Order Created',
              description: `Order ${orderData.order_number} was created`,
              user: 'System'
            }
          ]
        }
        
        setOrder(mappedOrder)
      }
    } catch (error) {
      console.error('Failed to fetch order details:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'bg-green-100 text-green-800'
      case 'shipped': return 'bg-blue-100 text-blue-800'
      case 'confirmed': return 'bg-purple-100 text-purple-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800'
      case 'partial': return 'bg-yellow-100 text-yellow-800'
      case 'pending': return 'bg-orange-100 text-orange-800'
      case 'refunded': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleDownload = () => {
  }

  const updateOrderStatus = async (newStatus: string) => {
    if (!id || transitioning) return
    try {
      setTransitioning(true)
      const result = await ordersService.transitionOrderStatus(id, newStatus)
      setOrder({ ...order!, status: result.new_status as any })
      setAvailableTransitions(result.allowed_transitions?.map((s: string) => ({ status: s, label: s.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) })) || [])
      await loadStatusHistory()
    } catch (error: any) {
      console.error('Failed to update order status:', error)
      toast.error(error.response?.data?.message || 'Failed to update order status')
    } finally {
      setTransitioning(false)
    }
  }

  const getTransitionButtonStyle = (status: string) => {
    switch (status) {
      case 'approved':
      case 'completed':
      case 'paid':
        return 'bg-green-600 hover:bg-green-700 text-white'
      case 'fulfilled':
      case 'delivered':
        return 'bg-blue-600 hover:bg-blue-700 text-white'
      case 'cancelled':
      case 'rejected':
        return 'bg-red-600 hover:bg-red-700 text-white'
      case 'processing':
      case 'submitted':
        return 'bg-purple-600 hover:bg-purple-700 text-white'
      default:
        return 'bg-gray-600 hover:bg-gray-700 text-white'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Order not found</h3>
        <button onClick={() => navigate('/orders')} className="btn btn-primary mt-4">
          Back to Orders
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/orders')} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{order.orderNumber}</h1>
            <p className="text-sm text-gray-600">
              Placed on {new Date(order.orderDate).toLocaleDateString()}
            </p>
          </div>
          <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(order.status)}`}>
            {order.status.toUpperCase()}
          </span>
          <span className={`px-3 py-1 text-sm font-medium rounded-full ${getPaymentStatusColor(order.paymentStatus)}`}>
            {order.paymentStatus.toUpperCase()}
          </span>
        </div>
        <div className="flex gap-3">
          <button onClick={handlePrint} className="btn btn-secondary flex items-center gap-2">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button onClick={handleDownload} className="btn btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" /> Download
          </button>
          <button onClick={() => setIsEditing(!isEditing)} className="btn btn-primary flex items-center gap-2">
            <Edit2 className="w-4 h-4" /> Edit Order
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Items</p>
              <p className="text-2xl font-bold text-gray-900">{order.items.length}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Amount</p>
              <p className="text-2xl font-bold text-gray-900">${order.totalAmount.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Delivery Date</p>
              <p className="text-lg font-bold text-gray-900">
                {new Date(order.deliveryDate).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <CreditCard className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Payment Method</p>
              <p className="text-sm font-bold text-gray-900">{order.paymentMethod.replace('_', ' ')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-100">
        <nav className="-mb-px flex space-x-8">
          {['details', 'items', 'timeline', 'documents'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'details' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Customer Information */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Customer Information
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Name</p>
                <p className="text-sm font-medium text-gray-900">{order.customerName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="text-sm font-medium text-gray-900">{order.customerEmail}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Phone</p>
                <p className="text-sm font-medium text-gray-900">{order.customerPhone}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Shipping Address</p>
                <p className="text-sm font-medium text-gray-900">{order.shippingAddress}</p>
              </div>
            </div>
          </div>

          {/* Order Information */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Order Information
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Agent</p>
                <p className="text-sm font-medium text-gray-900">{order.agentName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Order Date</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(order.orderDate).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Delivery Date</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(order.deliveryDate).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Notes</p>
                <p className="text-sm font-medium text-gray-900">{order.notes || 'No notes'}</p>
              </div>
            </div>
          </div>

          {/* Status Update */}
          <div className="card lg:col-span-2">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              Update Order Status
            </h3>
            <div className="mb-4">
              <p className="text-sm text-gray-600">
                Current Status: <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>{order.status.replace(/_/g, ' ').toUpperCase()}</span>
              </p>
            </div>
            {availableTransitions.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {availableTransitions.map((transition) => (
                  <button
                    key={transition.status}
                    onClick={() => updateOrderStatus(transition.status)}
                    disabled={transitioning}
                    className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${getTransitionButtonStyle(transition.status)} ${transitioning ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {transitioning ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : transition.status.includes('cancel') || transition.status.includes('reject') ? (
                      <XCircle className="w-4 h-4" />
                    ) : transition.status.includes('deliver') || transition.status.includes('fulfill') ? (
                      <Truck className="w-4 h-4" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    {transition.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No status transitions available for this order.</p>
            )}
          </div>

          {/* Status History */}
          {statusHistory.length > 0 && (
            <div className="card lg:col-span-2">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <History className="w-5 h-5" />
                Status History
              </h3>
              <div className="space-y-3">
                {statusHistory.map((entry, index) => (
                  <div key={entry.id || index} className="flex items-start gap-3 p-3 bg-surface-secondary rounded-lg">
                    <div className={`w-2 h-2 rounded-full mt-2 ${index === 0 ? 'bg-blue-600' : 'bg-gray-400'}`} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">
                          {entry.old_status ? `${entry.old_status} → ${entry.new_status}` : entry.new_status}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(entry.created_at).toLocaleString()}
                        </span>
                      </div>
                      {entry.notes && <p className="text-sm text-gray-600 mt-1">{entry.notes}</p>}
                      {entry.first_name && (
                        <p className="text-xs text-gray-500 mt-1">By {entry.first_name} {entry.last_name}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'items' && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Items</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-secondary">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tax</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {order.items.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-secondary">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.productName}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{item.sku}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right">{item.quantity}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right">${item.unitPrice.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right">${item.subtotal.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 text-right">${item.taxAmount.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">${item.totalAmount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-surface-secondary">
                <tr>
                  <td colSpan={6} className="px-6 py-3 text-right text-sm font-medium text-gray-600">Subtotal:</td>
                  <td className="px-6 py-3 text-right text-sm font-semibold text-gray-900">${order.subtotal.toFixed(2)}</td>
                </tr>
                <tr>
                  <td colSpan={6} className="px-6 py-3 text-right text-sm font-medium text-gray-600">Tax:</td>
                  <td className="px-6 py-3 text-right text-sm font-semibold text-gray-900">${order.taxAmount.toFixed(2)}</td>
                </tr>
                <tr>
                  <td colSpan={6} className="px-6 py-3 text-right text-sm font-medium text-gray-600">Shipping:</td>
                  <td className="px-6 py-3 text-right text-sm font-semibold text-gray-900">${order.shippingCost.toFixed(2)}</td>
                </tr>
                <tr>
                  <td colSpan={6} className="px-6 py-3 text-right text-sm font-medium text-gray-600">Discount:</td>
                  <td className="px-6 py-3 text-right text-sm font-semibold text-red-600">-${order.discount.toFixed(2)}</td>
                </tr>
                <tr className="border-t-2 border-gray-300">
                  <td colSpan={6} className="px-6 py-4 text-right text-base font-bold text-gray-900">Total Amount:</td>
                  <td className="px-6 py-4 text-right text-xl font-bold text-green-600">${order.totalAmount.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'timeline' && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Timeline</h3>
          <div className="space-y-4">
            {order.timeline.map((event, index) => (
              <div key={event.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className={`w-3 h-3 rounded-full ${index === 0 ? 'bg-blue-600' : 'bg-gray-300'}`} />
                  {index < order.timeline.length - 1 && (
                    <div className="w-0.5 h-full bg-gray-300 mt-1" />
                  )}
                </div>
                <div className="flex-1 pb-6">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium text-gray-900">{event.event}</h4>
                    <span className="text-sm text-gray-500">
                      {new Date(event.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{event.description}</p>
                  <p className="text-xs text-gray-500 mt-1">By {event.user}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Related Documents</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 border border-gray-100 rounded-lg hover:bg-surface-secondary">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="font-medium text-gray-900">Invoice #{order.orderNumber}</p>
                  <p className="text-sm text-gray-600">Generated on {new Date(order.orderDate).toLocaleDateString()}</p>
                </div>
              </div>
              <button onClick={() => toast.success('Invoice download started')} className="btn btn-secondary flex items-center gap-2">
                <Download className="w-4 h-4" /> Download
              </button>
            </div>
            <div className="flex items-center justify-between p-4 border border-gray-100 rounded-lg hover:bg-surface-secondary">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-green-600" />
                <div>
                  <p className="font-medium text-gray-900">Delivery Note</p>
                  <p className="text-sm text-gray-600">Ready for download</p>
                </div>
              </div>
              <button onClick={() => toast.success('Delivery note download started')} className="btn btn-secondary flex items-center gap-2">
                <Download className="w-4 h-4" /> Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
