import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { vanSalesService } from '../../services/van-sales.service'
import { Package, TrendingDown, TrendingUp, AlertCircle } from 'lucide-react'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import SearchableSelect from '../../components/ui/SearchableSelect'

export default function VanInventoryPage() {
  const [selectedVanId, setSelectedVanId] = useState<string>('')
  const { data: vans } = useQuery({
    queryKey: ['vans-list'],
    queryFn: async () => {
      const res = await vanSalesService.getVans()
      return res.data || res.vans || []
    }
  })
  const { data: inventory, isLoading, isError, error } = useQuery({
    queryKey: ['van-inventory', selectedVanId],
    queryFn: () => vanSalesService.getVanInventory(selectedVanId),
    enabled: !!selectedVanId
  })

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-ZA', {style: 'currency', currency: 'ZAR'}).format(amount)

  return (
    <div className="p-6 space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">Van Inventory</h1><p className="text-sm text-gray-600 mt-1">Monitor van stock levels</p></div>
      <div className="bg-white rounded-lg shadow p-4 max-w-md">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Van</label>
        <SearchableSelect
          options={[
            { value: '', label: 'Select a van...' },
            ...(Array.isArray(vans) ? vans : []).map((v: any) => ({
              value: v.id,
              label: `${v.van_number || v.code || v.id}${v.driver_name ? ` - ${v.driver_name}` : ''}`
            }))
          ]}
          value={selectedVanId || null}
          onChange={(val) => setSelectedVanId(val as string || '')}
          placeholder="Search vans..."
        />
      </div>
      
      {inventory && inventory.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Total Products</p><p className="text-2xl font-bold">{inventory.length}</p></div><Package className="h-8 w-8 text-blue-500" /></div></div>
          <div className="bg-white rounded-lg shadow p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Total Stock</p><p className="text-2xl font-bold">{inventory.reduce((s,i) => s+i.current_stock,0)}</p></div><TrendingUp className="h-8 w-8 text-green-500" /></div></div>
          <div className="bg-white rounded-lg shadow p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Sold Today</p><p className="text-2xl font-bold text-green-600">{inventory.reduce((s,i) => s+i.sold_stock,0)}</p></div><TrendingDown className="h-8 w-8 text-red-500" /></div></div>
          <div className="bg-white rounded-lg shadow p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Total Value</p><p className="text-2xl font-bold">{formatCurrency(inventory.reduce((s,i) => s+i.total_value,0))}</p></div><Package className="h-8 w-8 text-purple-500" /></div></div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {!selectedVanId ? <div className="p-12 text-center text-gray-500"><Package className="h-12 w-12 mx-auto text-gray-400 mb-2" /><p>Select a van to view inventory</p></div>
        : isLoading ? <div className="p-12 text-center"><LoadingSpinner size="lg" /></div>
        : error ? <div className="p-12 text-center text-red-600"><AlertCircle className="h-12 w-12 mx-auto mb-2" /><p>Failed to load</p></div>
        : inventory && inventory.length === 0 ? <div className="p-12 text-center text-gray-500"><Package className="h-12 w-12 mx-auto text-gray-400 mb-2" /><p>No inventory found</p></div>
        : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-surface-secondary"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Loaded</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sold</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Returned</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Updated</th></tr></thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {inventory?.map(item => (
                  <tr key={item.product_id} className="hover:bg-surface-secondary">
                    <td className="px-6 py-4"><div className="text-sm font-medium text-gray-900">{item.product_name}</div><div className="text-sm text-gray-500">{item.product_code}</div></td>
                    <td className="px-6 py-4"><span className={`text-sm font-medium ${item.current_stock<10?'text-red-600':'text-gray-900'}`}>{item.current_stock}</span></td>
                    <td className="px-6 py-4 text-sm">{item.loaded_stock}</td>
                    <td className="px-6 py-4 text-sm text-green-600">{item.sold_stock}</td>
                    <td className="px-6 py-4 text-sm text-yellow-600">{item.returned_stock}</td>
                    <td className="px-6 py-4 text-sm">{formatCurrency(item.total_value)}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{new Date(item.last_updated).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
