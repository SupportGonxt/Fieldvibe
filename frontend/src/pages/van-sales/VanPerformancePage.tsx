import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { vanSalesService } from '../../services/van-sales.service'
import { TrendingUp, DollarSign, ShoppingCart, Package, Calendar } from 'lucide-react'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function VanPerformancePage() {
  const [filter, setFilter] = useState({ van_id: '', period: 'today' })
  const { data: stats, isLoading, isError, error } = useQuery({
    queryKey: ['van-performance', filter],
    queryFn: () => vanSalesService.getVanSalesStats(filter),
    enabled: !!filter.van_id
  })

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-ZA', {style: 'currency', currency: 'ZAR'}).format(amount)

  return (
    <div className="p-6 space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">Van Performance Analytics</h1><p className="text-sm text-gray-600 mt-1">Monitor van sales performance and metrics</p></div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Van ID</label>
            <input type="text" placeholder="Enter Van ID" value={filter.van_id} onChange={e => setFilter({...filter, van_id: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Period</label>
            <select value={filter.period} onChange={e => setFilter({...filter, period: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2">
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
            </select>
          </div>
        </div>
      </div>

      {filter.van_id && !isLoading && !error && stats && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-gray-600">Total Revenue</p><p className="text-2xl font-bold text-green-600">{formatCurrency(stats.total_revenue || 0)}</p></div>
                <DollarSign className="h-8 w-8 text-green-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-gray-600">Total Orders</p><p className="text-2xl font-bold text-gray-900">{stats.total_orders || 0}</p></div>
                <ShoppingCart className="h-8 w-8 text-blue-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-gray-600">Items Sold</p><p className="text-2xl font-bold text-gray-900">{stats.items_sold || 0}</p></div>
                <Package className="h-8 w-8 text-purple-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-gray-600">Avg Order Value</p><p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.avg_order_value || 0)}</p></div>
                <TrendingUp className="h-8 w-8 text-orange-500" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Sales Breakdown</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Cash Sales</span>
                  <span className="text-sm font-bold text-gray-900">{formatCurrency(stats.cash_sales || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Credit Sales</span>
                  <span className="text-sm font-bold text-gray-900">{formatCurrency(stats.credit_sales || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Mobile Money</span>
                  <span className="text-sm font-bold text-gray-900">{formatCurrency(stats.mobile_money_sales || 0)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Performance Metrics</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Routes Completed</span>
                  <span className="text-sm font-bold text-gray-900">{stats.routes_completed || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Customers Visited</span>
                  <span className="text-sm font-bold text-gray-900">{stats.customers_visited || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Delivery Success Rate</span>
                  <span className="text-sm font-bold text-green-600">{stats.delivery_success_rate || 0}%</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {filter.van_id && isLoading && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading performance data...</p>
        </div>
      )}

      {filter.van_id && error && (
        <div className="bg-white rounded-lg shadow p-12 text-center text-red-600">
          <p>Failed to load performance data</p>
        </div>
      )}

      {!filter.van_id && (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
          <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-2" />
          <p>Enter a Van ID to view performance analytics</p>
        </div>
      )}
    </div>
  )
}
