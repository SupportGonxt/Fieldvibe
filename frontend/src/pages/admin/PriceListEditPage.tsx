import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react'
import { pricingService, PriceListWithItems, PriceListItem } from '../../services/pricing.service'
import { productsService, Product } from '../../services/products.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useToast } from '../../components/ui/Toast'
import SearchableSelect from '../../components/ui/SearchableSelect'

export default function PriceListEditPage() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isNew = id === 'create'

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    customer_type: '',
    region_id: '',
    area_id: '',
    channel: '',
    currency: 'USD',
    effective_start: new Date().toISOString().split('T')[0],
    effective_end: '',
    is_active: true,
    priority: 1
  })

  const [items, setItems] = useState<Array<Omit<PriceListItem, 'id' | 'price_list_id' | 'created_at' | 'updated_at'>>>([])

  useEffect(() => {
    loadProducts()
    if (!isNew && id) {
      loadPriceList(id)
    }
  }, [id, isNew])

  const loadProducts = async () => {
    try {
      const response = await productsService.getProducts()
      setProducts(response.products)
    } catch (error) {
      console.error('Failed to load products:', error)
    }
  }

  const loadPriceList = async (priceListId: string) => {
    try {
      setLoading(true)
      const data = await pricingService.getPriceList(priceListId)
      if (data) {
        setFormData({
          name: data.name,
          code: data.code || '',
          description: data.description || '',
          customer_type: data.customer_type || '',
          region_id: data.region_id || '',
          area_id: data.area_id || '',
          channel: data.channel || '',
          currency: data.currency,
          effective_start: data.effective_start.split('T')[0],
          effective_end: data.effective_end ? data.effective_end.split('T')[0] : '',
          is_active: data.is_active,
          priority: data.priority
        })
        setItems(data.items.map(item => ({
          product_id: item.product_id,
          product_name: item.product_name,
          product_code: item.product_code,
          price: item.price,
          min_quantity: item.min_quantity,
          max_quantity: item.max_quantity,
          discount_percentage: item.discount_percentage
        })))
      }
    } catch (error) {
      console.error('Failed to load price list:', error)
      toast.error('Failed to load price list')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (items.length === 0) {
      toast.info('Please add at least one product to the price list')
      return
    }

    try {
      setSaving(true)
      
      let priceListId = id
      
      if (isNew) {
        const newPriceList = await pricingService.createPriceList(formData)
        priceListId = newPriceList.id
      } else if (id) {
        await pricingService.updatePriceList(id, formData)
      }

      if (priceListId) {
        await pricingService.updatePriceListItems(priceListId, items)
      }

      toast.success(isNew ? 'Price list created successfully' : 'Price list updated successfully')
      navigate('/admin/price-lists')
    } catch (error) {
      console.error('Failed to save price list:', error)
      toast.error('Failed to save price list')
    } finally {
      setSaving(false)
    }
  }

  const addItem = () => {
    setItems([...items, {
      product_id: '',
      price: 0,
      min_quantity: undefined,
      max_quantity: undefined,
      discount_percentage: undefined
    }])
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    
    if (field === 'product_id') {
      const product = products.find(p => p.id === value)
      if (product) {
        newItems[index].product_name = product.name
        newItems[index].product_code = product.code
        newItems[index].price = product.selling_price
      }
    }
    
    setItems(newItems)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate('/admin/price-lists')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Price Lists
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {isNew ? 'Create Price List' : 'Edit Price List'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Price List Details</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Code *
              </label>
              <input
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="e.g., PL-2024-001"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer Type
              </label>
              <SearchableSelect
                options={[
                  { value: '', label: 'All Types' },
                  { value: 'retail', label: 'Retail' },
                  { value: 'wholesale', label: 'Wholesale' },
                  { value: 'distributor', label: 'Distributor' },
                ]}
                value={formData.customer_type || null}
                placeholder="All Types"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Channel
              </label>
              <SearchableSelect
                options={[
                  { value: '', label: 'All Channels' },
                  { value: 'direct', label: 'Direct' },
                  { value: 'distributor', label: 'Distributor' },
                  { value: 'online', label: 'Online' },
                ]}
                value={formData.channel || null}
                placeholder="All Channels"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Currency *
              </label>
              <SearchableSelect
                options={[
                  { value: 'USD', label: 'USD' },
                  { value: 'EUR', label: 'EUR' },
                  { value: 'GBP', label: 'GBP' },
                  { value: 'LKR', label: 'LKR' },
                ]}
                value={formData.currency}
                placeholder="USD"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority *
              </label>
              <input
                type="number"
                required
                min="1"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Effective Start Date *
              </label>
              <input
                type="date"
                required
                value={formData.effective_start}
                onChange={(e) => setFormData({ ...formData, effective_start: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Effective End Date
              </label>
              <input
                type="date"
                value={formData.effective_end}
                onChange={(e) => setFormData({ ...formData, effective_end: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div className="col-span-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-900">Active</span>
              </label>
            </div>
          </div>
        </div>

        <div className="bg-white shadow-md rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Price List Items</h2>
            <button
              type="button"
              onClick={addItem}
              className="btn-secondary flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Product
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="flex gap-3 items-start p-3 border border-gray-100 rounded-lg">
                <div className="flex-1 grid grid-cols-6 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Product *</label>
                    <SearchableSelect
                      options={[
                        { value: '', label: 'Select Product' },
                        { value: 'product.id', label: '{product.code} - {product.name}' },
                      ]}
                      value={item.product_id || null}
                      placeholder="Select Product"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Price *</label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      min="0"
                      value={item.price}
                      onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value))}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Min Qty</label>
                    <input
                      type="number"
                      min="0"
                      value={item.min_quantity || ''}
                      onChange={(e) => updateItem(index, 'min_quantity', e.target.value ? parseInt(e.target.value) : undefined)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Max Qty</label>
                    <input
                      type="number"
                      min="0"
                      value={item.max_quantity || ''}
                      onChange={(e) => updateItem(index, 'max_quantity', e.target.value ? parseInt(e.target.value) : undefined)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Discount %</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={item.discount_percentage || ''}
                      onChange={(e) => updateItem(index, 'discount_percentage', e.target.value ? parseFloat(e.target.value) : undefined)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="mt-6 text-red-600 hover:text-red-900"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}

            {items.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <p>No products added yet</p>
                <p className="text-sm">Click "Add Product" to add items to this price list</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/admin/price-lists')}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-surface-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : isNew ? 'Create Price List' : 'Update Price List'}
          </button>
        </div>
      </form>
    </div>
  )
}
