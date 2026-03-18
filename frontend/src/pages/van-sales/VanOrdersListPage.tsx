import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { vanSalesService } from '../../services/van-sales.service'
import { Plus, Eye, ShoppingCart, DollarSign } from 'lucide-react'

export default function VanOrdersListPage() {
  const [filter, setFilter] = useState({ page: 1, limit: 20 })
  const { data, isLoading, error } = useQuery({
    queryKey: ['van-orders', filter],
    queryFn: () => vanSalesService.getVanOrders(filter)
  })

  const orders = data?.data || []
  const total = data?.total || 0
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-ZA', {style: 'currency', currency: 'ZAR'}).format(amount)
  const getPaymentBadge = (status: string) => {
    const colors = {pending: 'bg-yellow-100 text-yellow-800', paid: 'bg-green-100 text-green-800', partial: 'bg-orange-100 text-orange-800'}
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status as keyof typeof colors]||'bg-gray-100 text-gray-800'}`}>{status.toUpperCase()}</span>
  }
  const getDeliveryBadge = (status: string) => {
    const colors = {pending: 'bg-blue-100 text-blue-800', delivered: 'bg-green-100 text-green-800', failed: 'bg-red-100 text-red-800'}
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status as keyof typeof colors]||'bg-gray-100 text-gray-800'}`}>{status.toUpperCase()}</span>
  }

  if (isLoading) return <div className="p-6"><div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 rounded w-1/4"></div><div className="h-64 bg-gray-200 rounded"></div></div></div>
  if (error) return <div className="p-6"><div className="bg-red-50 border border-red-200 rounded-lg p-4"><p className="text-red-800">Failed to load orders.</p></div></div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold text-gray-900">Van Sales Orders</h1><p className="text-sm text-gray-600 mt-1">Manage orders ({total} total)</p></div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"><Plus className="h-4 w-4" /><span>Create Order</span></button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Total Orders</p><p className="text-2xl font-bold">{total}</p></div><ShoppingCart className="h-8 w-8 text-blue-500" /></div></div>
        <div className="bg-white rounded-lg shadow p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Revenue</p><p className="text-2xl font-bold text-green-600">{formatCurrency(orders.reduce((s,o) => s+o.total_amount,0))}</p></div><DollarSign className="h-8 w-8 text-green-500" /></div></div>
        <div className="bg-white rounded-lg shadow p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Delivered</p><p className="text-2xl font-bold text-green-600">{orders.filter(o => o.delivery_status==='delivered').length}</p></div><ShoppingCart className="h-8 w-8 text-green-500" /></div></div>
        <div className="bg-white rounded-lg shadow p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Pending</p><p className="text-2xl font-bold text-yellow-600">{orders.filter(o => o.delivery_status==='pending').length}</p></div><ShoppingCart className="h-8 w-8 text-yellow-500" /></div></div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-surface-secondary"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order #</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Delivery</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th></tr></thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders.length === 0 ? <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500"><ShoppingCart className="h-12 w-12 mx-auto text-gray-400 mb-2" /><p>No orders found</p></td></tr>
              : orders.map(order => (
                <tr key={order.id} className="hover:bg-surface-secondary">
                  <td className="px-6 py-4 text-sm font-medium">{order.order_number}</td>
                  <td className="px-6 py-4 text-sm">{order.customer_name}</td>
                  <td className="px-6 py-4 text-sm">{new Date(order.order_date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm font-medium">{formatCurrency(order.total_amount)}</td>
                  <td className="px-6 py-4">{getPaymentBadge(order.payment_status)}<div className="text-xs text-gray-500 mt-1">{order.payment_method}</div></td>
                  <td className="px-6 py-4">{getDeliveryBadge(order.delivery_status)}</td>
                  <td className="px-6 py-4"><button className="text-blue-600 hover:text-blue-900"><Eye className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {total > filter.limit && (
        <div className="flex justify-between items-center bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-700">Showing {(filter.page-1)*filter.limit+1} to {Math.min(filter.page*filter.limit,total)} of {total}</div>
          <div className="flex space-x-2">
            <button onClick={() => setFilter({...filter, page: filter.page-1})} disabled={filter.page<=1} className="px-4 py-2 border rounded-lg disabled:opacity-50">Previous</button>
            <button onClick={() => setFilter({...filter, page: filter.page+1})} disabled={filter.page*filter.limit>=total} className="px-4 py-2 border rounded-lg disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    </div>
  )
}
