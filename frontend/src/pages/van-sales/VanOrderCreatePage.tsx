import React, { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { vanSalesService } from '../../services/van-sales.service'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import SearchableSelect from '../../components/ui/SearchableSelect'

export default function VanOrderCreatePage() {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState({
    customer_id: '',
    customer_name: '',
    van_id: '',
    route_id: '',
    payment_method: 'cash' as 'cash' | 'credit' | 'mobile_money',
    items: [] as Array<{ product_id: string; quantity: number; unit_price: number }>
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => vanSalesService.createVanOrder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['van-orders'] })
      window.history.back()
    }
  })

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { product_id: '', quantity: 1, unit_price: 0 }]
    })
  }

  const removeItem = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index)
    })
  }

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...formData.items]
    newItems[index] = { ...newItems[index], [field]: value }
    setFormData({ ...formData, items: newItems })
  }

  const totalAmount = formData.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate({
      ...formData,
      total_amount: totalAmount,
      order_date: new Date().toISOString()
    })
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center space-x-4">
        <button onClick={() => window.history.back()} className="text-gray-600 hover:text-gray-900"><ArrowLeft className="h-6 w-6" /></button>
        <h1 className="text-2xl font-bold text-gray-900">Create Van Sales Order</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Order Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer ID</label>
              <input type="text" required value={formData.customer_id} onChange={e => setFormData({...formData, customer_id: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
              <input type="text" required value={formData.customer_name} onChange={e => setFormData({...formData, customer_name: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Van ID</label>
              <input type="text" required value={formData.van_id} onChange={e => setFormData({...formData, van_id: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Route ID</label>
              <input type="text" required value={formData.route_id} onChange={e => setFormData({...formData, route_id: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
              <SearchableSelect
                options={[
                  { value: 'cash', label: 'Cash' },
                  { value: 'credit', label: 'Credit' },
                  { value: 'mobile_money', label: 'Mobile Money' },
                ]}
                value={formData.payment_method}
                placeholder="Cash"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-900">Order Items</h2>
            <button type="button" onClick={addItem} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg flex items-center space-x-1 text-sm">
              <Plus className="h-4 w-4" /><span>Add Item</span>
            </button>
          </div>
          {formData.items.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No items added. Click "Add Item" to start.</p>
          ) : (
            <div className="space-y-3">
              {formData.items.map((item, idx) => (
                <div key={idx} className="flex items-center space-x-3 p-3 border border-gray-100 rounded-lg">
                  <div className="flex-1 grid grid-cols-3 gap-3">
                    <input type="text" placeholder="Product ID" value={item.product_id} onChange={e => updateItem(idx, 'product_id', e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm" />
                    <input type="number" placeholder="Quantity" min="1" value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value))} className="border border-gray-300 rounded px-2 py-1 text-sm" />
                    <input type="number" placeholder="Unit Price" min="0" step="0.01" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value))} className="border border-gray-300 rounded px-2 py-1 text-sm" />
                  </div>
                  <button type="button" onClick={() => removeItem(idx)} className="text-red-600 hover:text-red-900"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center">
            <span className="text-lg font-bold text-gray-900">Total Amount</span>
            <span className="text-2xl font-bold text-green-600">R {totalAmount.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex justify-end space-x-3">
          <button type="button" onClick={() => window.history.back()} className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-surface-secondary">Cancel</button>
          <button type="submit" disabled={createMutation.isPending} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50">
            {createMutation.isPending ? 'Creating...' : 'Create Order'}
          </button>
        </div>
      </form>
    </div>
  )
}
