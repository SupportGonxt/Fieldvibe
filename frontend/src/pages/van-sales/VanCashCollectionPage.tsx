import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { vanSalesService } from '../../services/van-sales.service'
import { DollarSign, TrendingUp, Calendar, AlertCircle } from 'lucide-react'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function VanCashCollectionPage() {
  const [filter, setFilter] = useState({ van_id: '', date: new Date().toISOString().split('T')[0] })
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['van-cash-collection', filter],
    queryFn: () => vanSalesService.getVanCashCollection(filter),
    enabled: !!filter.van_id
  })

  const collections = data?.data || []
  const totalCash = collections.reduce((sum, c) => sum + c.amount, 0)
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-ZA', {style: 'currency', currency: 'ZAR'}).format(amount)

  return (
    <div className="p-6 space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">Van Cash Collection</h1><p className="text-sm text-gray-600 mt-1">Track cash collections from van sales</p></div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Van ID</label>
            <input type="text" placeholder="Enter Van ID" value={filter.van_id} onChange={e => setFilter({...filter, van_id: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input type="date" value={filter.date} onChange={e => setFilter({...filter, date: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
          </div>
        </div>
      </div>

      {filter.van_id && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-gray-600">Total Collections</p><p className="text-2xl font-bold text-gray-900">{collections.length}</p></div>
                <Calendar className="h-8 w-8 text-blue-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-gray-600">Total Cash</p><p className="text-2xl font-bold text-green-600">{formatCurrency(totalCash)}</p></div>
                <DollarSign className="h-8 w-8 text-green-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-gray-600">Average Collection</p><p className="text-2xl font-bold text-gray-900">{collections.length > 0 ? formatCurrency(totalCash / collections.length) : 'R 0.00'}</p></div>
                <TrendingUp className="h-8 w-8 text-purple-500" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            {isLoading ? (
              <div className="p-12 text-center"><LoadingSpinner size="lg" /></div>
            ) : error ? (
              <div className="p-12 text-center text-red-600"><AlertCircle className="h-12 w-12 mx-auto mb-2" /><p>Failed to load cash collections</p></div>
            ) : collections.length === 0 ? (
              <div className="p-12 text-center text-gray-500"><DollarSign className="h-12 w-12 mx-auto text-gray-400 mb-2" /><p>No cash collections found</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-surface-secondary">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order #</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment Method</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {collections.map((collection, idx) => (
                      <tr key={idx} className="hover:bg-surface-secondary">
                        <td className="px-6 py-4 text-sm text-gray-900">{new Date(collection.timestamp).toLocaleTimeString()}</td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{collection.order_number}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{collection.customer_name}</td>
                        <td className="px-6 py-4 text-sm font-bold text-green-600">{formatCurrency(collection.amount)}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{collection.payment_method}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
