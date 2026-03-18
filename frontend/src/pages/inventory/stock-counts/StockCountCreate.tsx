import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Send, ClipboardList, Warehouse } from 'lucide-react'
import LineItemsEditor, { LineItem, LineItemsTotals, TotalsSummary } from '../../../components/transactions/LineItemsEditor'
import { inventoryService } from '../../../services/inventory.service'
import { productsService } from '../../../services/products.service'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { useToast } from '../../../components/ui/Toast'

interface WarehouseType {
  id: string
  name: string
}

interface Product {
  id: string
  name: string
  price: number
  selling_price?: number
  cost_price?: number
  tax_rate?: number
}

export default function StockCountCreate() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [selectedWarehouse, setSelectedWarehouse] = useState('')
  const [countDate, setCountDate] = useState(new Date().toISOString().split('T')[0])
  const [countType, setCountType] = useState('')
  const [notes, setNotes] = useState('')
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [totals, setTotals] = useState<LineItemsTotals>({ subtotal: 0, discount_amount: 0, tax_amount: 0, total_amount: 0, item_count: 0 })

  useEffect(() => {
    loadFormData()
  }, [])

  const loadFormData = async () => {
    try {
      setLoading(true)
      const [warehousesRes, productsRes] = await Promise.all([
        inventoryService.getWarehouses(),
        productsService.getProducts()
      ])
      setWarehouses(warehousesRes.data || warehousesRes.warehouses || [])
      setProducts(productsRes.products || productsRes.data || [])
    } catch (error) {
      console.error('Failed to load form data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (submit: boolean = false) => {
    if (!selectedWarehouse) {
      toast.info('Please select a warehouse')
      return
    }
    if (!countType) {
      toast.info('Please select a count type')
      return
    }
    if (lineItems.length === 0 || !lineItems.some(item => item.product_id)) {
      toast.info('Please add at least one product to count')
      return
    }

    try {
      setSaving(true)
      const countData = {
        warehouse_id: selectedWarehouse,
        count_date: countDate,
        count_type: countType,
        notes,
        submit,
        items: lineItems.filter(item => item.product_id).map(item => ({
          product_id: item.product_id,
          counted_quantity: item.quantity,
          unit_cost: item.cost_price || item.unit_price
        })),
        total_items: totals.item_count,
        total_value: totals.total_amount
      }

      await inventoryService.createStockCount(countData)
      navigate('/inventory/stock-counts')
    } catch (error: any) {
      console.error('Failed to create stock count:', error)
      toast.error(error.message || 'Failed to create stock count')
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
          <button onClick={() => navigate('/inventory/stock-counts')} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create Stock Count</h1>
            <p className="text-sm text-gray-600">Record physical inventory counts</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => handleSubmit(false)} disabled={saving} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-surface-secondary flex items-center gap-2">
            <Save className="w-4 h-4" /> Save as Draft
          </button>
          <button onClick={() => handleSubmit(true)} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
            <Send className="w-4 h-4" /> Submit Count
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <ClipboardList className="w-5 h-5" /> Count Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse *</label>
                <select value={selectedWarehouse} onChange={(e) => setSelectedWarehouse(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="">Select a warehouse</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Count Date</label>
                <input type="date" value={countDate} onChange={(e) => setCountDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Count Type *</label>
                <select value={countType} onChange={(e) => setCountType(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="">Select type</option>
                  <option value="full">Full Count</option>
                  <option value="cycle">Cycle Count</option>
                  <option value="spot">Spot Check</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Count notes..." className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
            </div>
          </div>

          <LineItemsEditor
            products={products}
            lineItems={lineItems}
            onLineItemsChange={setLineItems}
            onTotalsChange={setTotals}
            showCostPrice={true}
            title="Count Items"
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
                <Send className="w-4 h-4" /> {saving ? 'Submitting...' : 'Submit Count'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
