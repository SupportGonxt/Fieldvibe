import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit2, Mail, Phone, MapPin, CreditCard, ShoppingCart, TrendingUp, Clock, FileText, DollarSign, Package, Activity, Save, X } from 'lucide-react'
import { customersService } from '../../services/customers.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import ErrorState from '../../components/ui/ErrorState'


interface Customer {
  id: string
  customerCode: string
  name: string
  email: string
  phone: string
  address: string
  city: string
  region: string
  territory: string
  type: 'retail' | 'wholesale' | 'distributor'
  status: 'active' | 'inactive' | 'suspended'
  creditLimit: number
  currentBalance: number
  totalOrders: number
  totalRevenue: number
  lastOrderDate: string
  createdAt: string
}

interface Order {
  id: string
  orderNumber: string
  orderDate: string
  totalAmount: number
  status: string
  paymentStatus: string
}

interface Payment {
  id: string
  paymentNumber: string
  paymentDate: string
  amount: number
  method: string
  status: string
}

interface Visit {
  id: string
  visitDate: string
  visitType: string
  agentName: string
  status: string
  notes: string
}

export default function CustomerDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Customer>>({})

  useEffect(() => {
    fetchCustomerDetails()
  }, [id])

  const fetchCustomerDetails = async () => {
    try {
      setLoading(true)
      
      if (!id) {
        console.error('No customer ID provided')
        setLoading(false)
        return
      }

      const [customerData, ordersData, transactionsData, visitsData] = await Promise.all([
        customersService.getCustomer(id),
        customersService.getCustomerOrders(id),
        customersService.getCustomerTransactions(id),
        customersService.getCustomerVisits(id)
      ])

      if (customerData) {
        const mappedCustomer: Customer = {
          id: customerData.id,
          customerCode: customerData.code,
          name: customerData.name,
          email: customerData.email || '',
          phone: customerData.phone || '',
          address: customerData.address || '',
          city: '',
          region: customerData.region_name || '',
          territory: customerData.area_name || '',
          type: customerData.type,
          status: customerData.status,
          creditLimit: customerData.credit_limit,
          currentBalance: 0,
          totalOrders: customerData.total_orders,
          totalRevenue: customerData.total_sales,
          lastOrderDate: new Date().toISOString(),
          createdAt: customerData.created_at
        }
        
        setCustomer(mappedCustomer)
        setEditForm(mappedCustomer)
      }

      const mappedOrders: Order[] = (ordersData || []).map((order: any) => ({
        id: order.id,
        orderNumber: order.order_number || order.code,
        orderDate: order.order_date || order.created_at,
        totalAmount: order.total_amount || order.total,
        status: order.status,
        paymentStatus: order.payment_status || 'pending'
      }))
      setOrders(mappedOrders)

      const mappedPayments: Payment[] = (transactionsData || []).map((txn: any) => ({
        id: txn.id,
        paymentNumber: txn.transaction_number || txn.reference,
        paymentDate: txn.transaction_date || txn.created_at,
        amount: txn.amount,
        method: txn.payment_method || 'cash',
        status: txn.status
      }))
      setPayments(mappedPayments)

      const mappedVisits: Visit[] = (visitsData || []).map((visit: any) => ({
        id: visit.id,
        visitDate: visit.visit_date || visit.created_at,
        visitType: visit.visit_type || visit.purpose,
        agentName: visit.agent_name || 'Unknown',
        status: visit.status,
        notes: visit.notes || visit.remarks || ''
      }))
      setVisits(mappedVisits)

    } catch (error) {
      console.error('Failed to fetch customer details:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      if (!id) return
      
      const updates = {
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone,
        address: editForm.address
      }
      
      await customersService.updateCustomer(id, updates)
      setCustomer({ ...customer!, ...editForm })
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to update customer:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'inactive': return 'bg-gray-100 text-gray-800'
      case 'suspended': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'bg-green-100 text-green-800'
      case 'shipped': return 'bg-blue-100 text-blue-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Customer not found</h3>
        <button onClick={() => navigate('/customers')} className="btn btn-primary mt-4">
          Back to Customers
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/customers')} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
            <p className="text-sm text-gray-600">Customer Code: {customer.customerCode}</p>
          </div>
          <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(customer.status)}`}>
            {customer.status.toUpperCase()}
          </span>
        </div>
        <div className="flex gap-3">
          {isEditing ? (
            <>
              <button onClick={() => setIsEditing(false)} className="btn btn-secondary flex items-center gap-2">
                <X className="w-4 h-4" /> Cancel
              </button>
              <button onClick={handleSave} className="btn btn-primary flex items-center gap-2">
                <Save className="w-4 h-4" /> Save Changes
              </button>
            </>
          ) : (
            <button onClick={() => setIsEditing(true)} className="btn btn-primary flex items-center gap-2">
              <Edit2 className="w-4 h-4" /> Edit Customer
            </button>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <ShoppingCart className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900">{customer.totalOrders}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">${(customer.totalRevenue || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <CreditCard className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Current Balance</p>
              <p className="text-2xl font-bold text-gray-900">${(customer.currentBalance || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Credit Limit</p>
              <p className="text-2xl font-bold text-gray-900">${(customer.creditLimit || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-100">
        <nav className="-mb-px flex space-x-8">
          {['overview', 'orders', 'payments', 'visits'].map((tab) => (
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
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Information */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
            <div className="space-y-4">
              {isEditing ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={editForm.name || ''}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={editForm.email || ''}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="text"
                      value={editForm.phone || ''}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <input
                      type="text"
                      value={editForm.address || ''}
                      onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Email</p>
                      <p className="text-sm font-medium text-gray-900">{customer.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Phone</p>
                      <p className="text-sm font-medium text-gray-900">{customer.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Address</p>
                      <p className="text-sm font-medium text-gray-900">{customer.address}, {customer.city}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Package className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Type</p>
                      <p className="text-sm font-medium text-gray-900">{customer.type}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Additional Information */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Information</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Region</p>
                <p className="text-sm font-medium text-gray-900">{customer.region}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Territory</p>
                <p className="text-sm font-medium text-gray-900">{customer.territory}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Last Order</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(customer.lastOrderDate).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Customer Since</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(customer.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Order History</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-secondary">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-surface-secondary cursor-pointer" onClick={() => navigate(`/orders/${order.id}`)}>
                    <td className="px-6 py-4 text-sm font-medium text-blue-600">{order.orderNumber}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{new Date(order.orderDate).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">${(order.totalAmount || 0).toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getOrderStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{order.paymentStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment History</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-secondary">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-surface-secondary">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{payment.paymentNumber}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{new Date(payment.paymentDate).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-sm text-green-600 font-medium">${payment.amount.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{payment.method.replace('_', ' ')}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        {payment.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'visits' && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Visit History</h3>
          <div className="space-y-4">
            {visits.map((visit) => (
              <div key={visit.id} className="border border-gray-100 rounded-lg p-4 hover:bg-surface-secondary">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Activity className="w-5 h-5 text-blue-600" />
                      <p className="font-medium text-gray-900">{visit.visitType}</p>
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        {visit.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">Agent: {visit.agentName}</p>
                    <p className="text-sm text-gray-600">{visit.notes}</p>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    {new Date(visit.visitDate).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
