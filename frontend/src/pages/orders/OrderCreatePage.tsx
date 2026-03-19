import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, ShoppingCart, User, Calculator, Save, Send, Package, Percent } from 'lucide-react'
import { ordersService } from '../../services/orders.service'
import { customersService } from '../../services/customers.service'
import { productsService } from '../../services/products.service'
import { discountsService, Discount } from '../../services/discounts.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import SearchableSelect from '../../components/ui/SearchableSelect'
import { useToast } from '../../components/ui/Toast'

interface Product {
  id: string
  name: string
  code: string
  sku: string
  price: number
  selling_price: number
  tax_rate: number
  unit_of_measure: string
}

interface Customer {
  id: string
  name: string
  code: string
  credit_limit: number
  payment_terms: number
}

interface OrderLineItem {
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  discount_id: string
  discount_percentage: number
  discount_amount: number
  tax_percentage: number
  tax_amount: number
  line_total: number
}

export default function OrderCreatePage() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [discounts, setDiscounts] = useState<Discount[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [calculating, setCalculating] = useState(false)

  const [selectedCustomer, setSelectedCustomer] = useState<string>('')
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [notes, setNotes] = useState('')
  const [lineItems, setLineItems] = useState<OrderLineItem[]>([])

  const [subtotal, setSubtotal] = useState(0)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [taxAmount, setTaxAmount] = useState(0)
  const [totalAmount, setTotalAmount] = useState(0)

  useEffect(() => {
    loadFormData()
  }, [])

  const loadFormData = async () => {
    try {
      setLoading(true)
      // Use Promise.allSettled to handle partial failures gracefully
      const [customersRes, productsRes, discountsRes] = await Promise.allSettled([
        customersService.getCustomers(),
        productsService.getProducts(),
        discountsService.getDiscounts({ is_active: true })
      ])
      if (customersRes.status === 'fulfilled') {
        setCustomers(customersRes.value.customers || [])
      }
      if (productsRes.status === 'fulfilled') {
        const prodData = productsRes.value
        setProducts(prodData.products || [])
      }
      if (discountsRes.status === 'fulfilled') {
        setDiscounts(discountsRes.value || [])
      }
    } catch (error) {
      console.error('Failed to load form data:', error)
    } finally {
      setLoading(false)
    }
  }

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        product_id: '',
        product_name: '',
        quantity: 1,
        unit_price: 0,
        discount_id: '',
        discount_percentage: 0,
        discount_amount: 0,
        tax_percentage: 0,
        tax_amount: 0,
        line_total: 0
      }
    ])
  }

  const removeLineItem = (index: number) => {
    const newItems = lineItems.filter((_, i) => i !== index)
    setLineItems(newItems)
    calculateTotals(newItems)
  }

  const updateLineItem = (index: number, field: string, value: any) => {
    const newItems = [...lineItems]
    const item = { ...newItems[index] }

    if (field === 'product_id') {
      const product = products.find(p => p.id === value)
      if (product) {
        item.product_id = value
        item.product_name = product.name
        item.unit_price = product.selling_price || product.price || 0
        item.tax_percentage = product.tax_rate || 0
      }
    } else if (field === 'quantity') {
      item.quantity = Math.max(1, parseInt(value) || 1)
    } else if (field === 'discount_id') {
      const discount = discounts.find(d => d.id === value)
      item.discount_id = value
      item.discount_percentage = discount ? discount.value : 0
    } else if (field === 'unit_price') {
      item.unit_price = Math.max(0, parseFloat(value) || 0)
    }

    const sub = item.unit_price * item.quantity
    item.discount_amount = (sub * item.discount_percentage) / 100
    const discountedSubtotal = sub - item.discount_amount
    item.tax_amount = (discountedSubtotal * item.tax_percentage) / 100
    item.line_total = discountedSubtotal + item.tax_amount

    newItems[index] = item
    setLineItems(newItems)
    calculateTotals(newItems)
  }

  const calculateTotals = (items: OrderLineItem[]) => {
    const sub = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0)
    const disc = items.reduce((sum, item) => sum + item.discount_amount, 0)
    const tax = items.reduce((sum, item) => sum + item.tax_amount, 0)
    const total = items.reduce((sum, item) => sum + item.line_total, 0)

    setSubtotal(sub)
    setDiscountAmount(disc)
    setTaxAmount(tax)
    setTotalAmount(total)
  }

  const recalculateFromServer = async () => {
    if (lineItems.length === 0 || !lineItems.some(item => item.product_id)) return

    try {
      setCalculating(true)
      const itemsToCalculate = lineItems
        .filter(item => item.product_id)
        .map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          discount_percentage: item.discount_percentage
        }))

      const result = await ordersService.calculatePricing({
        customer_id: selectedCustomer || undefined,
        items: itemsToCalculate
      })

      if (result && result.items) {
        const updatedItems = lineItems.map((item, index) => {
          const calculated = result.items[index]
          if (calculated) {
            return {
              ...item,
              unit_price: calculated.unit_price,
              discount_amount: calculated.discount_amount,
              tax_percentage: calculated.tax_percentage,
              tax_amount: calculated.tax_amount,
              line_total: calculated.line_total
            }
          }
          return item
        })
        setLineItems(updatedItems)
        setSubtotal(result.subtotal)
        setDiscountAmount(result.discount_amount)
        setTaxAmount(result.tax_amount)
        setTotalAmount(result.total_amount)
      }
    } catch (error) {
      console.error('Failed to calculate pricing:', error)
    } finally {
      setCalculating(false)
    }
  }

  const handleSubmit = async (submit: boolean = false) => {
    if (!selectedCustomer) {
      toast.info('Please select a customer')
      return
    }

    if (lineItems.length === 0 || !lineItems.some(item => item.product_id)) {
      toast.info('Please add at least one product')
      return
    }

    try {
      setSaving(true)
      const orderData = {
        customer_id: selectedCustomer,
        order_date: orderDate,
        payment_method: paymentMethod,
        notes,
        submit,
        items: lineItems
          .filter(item => item.product_id)
          .map(item => ({
            product_id: item.product_id,
            quantity: item.quantity,
            discount_percentage: item.discount_percentage
          }))
      }

      const result = await ordersService.createOrderWithPricing(orderData)
      
      if (result) {
        navigate(`/orders/${result.id}`)
      }
    } catch (error: any) {
      console.error('Failed to create order:', error)
      toast.error(error.response?.data?.message || 'Failed to create order')
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
          <button onClick={() => navigate('/orders')} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create New Order</h1>
            <p className="text-sm text-gray-600">Add products and calculate pricing</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => handleSubmit(false)} disabled={saving} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-surface-secondary flex items-center gap-2">
            <Save className="w-4 h-4" /> Save as Draft
          </button>
          <button onClick={() => handleSubmit(true)} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
            <Send className="w-4 h-4" /> Submit Order
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5" /> Customer Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <SearchableSelect
                  label="Customer *"
                  options={customers.map(c => ({ value: c.id, label: `${c.name} (${c.code})` }))}
                  value={selectedCustomer || null}
                  onChange={(val) => setSelectedCustomer(val || '')}
                  placeholder="Search customers..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Order Date</label>
                <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <SearchableSelect
                  label="Payment Method"
                  options={[
                    { value: 'cash', label: 'Cash' },
                    { value: 'credit', label: 'Credit' },
                    { value: 'mobile_money', label: 'Mobile Money' },
                    { value: 'bank_transfer', label: 'Bank Transfer' },
                  ]}
                  value={paymentMethod}
                  onChange={(val) => setPaymentMethod(val || 'cash')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Order notes..." className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Package className="w-5 h-5" /> Order Items
              </h3>
              <div className="flex gap-2">
                <button onClick={recalculateFromServer} disabled={calculating} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-surface-secondary flex items-center gap-1">
                  <Calculator className="w-4 h-4" /> {calculating ? 'Calculating...' : 'Recalculate'}
                </button>
                <button onClick={addLineItem} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Add Product
                </button>
              </div>
            </div>

            {lineItems.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <ShoppingCart className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No products added yet</p>
                <button onClick={addLineItem} className="mt-2 text-blue-600 hover:text-blue-700 text-sm">Add your first product</button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface-secondary">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-24">Qty</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-28">Unit Price</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-36">Discount</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-24">Tax</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-28">Total</th>
                      <th className="px-4 py-3 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {lineItems.map((item, index) => (
                      <tr key={index} className="hover:bg-surface-secondary">
                        <td className="px-4 py-3">
                          <SearchableSelect
                            options={products.map(p => ({ value: p.id, label: `${p.name} - R ${(p.selling_price || p.price || 0).toFixed(2)}` }))}
                            value={item.product_id || null}
                            onChange={(val) => updateLineItem(index, 'product_id', val || '')}
                            placeholder="Search products..."
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input type="number" min="1" value={item.quantity} onChange={(e) => updateLineItem(index, 'quantity', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" />
                        </td>
                        <td className="px-4 py-3">
                          <input type="number" min="0" step="0.01" value={item.unit_price} onChange={(e) => updateLineItem(index, 'unit_price', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" />
                        </td>
                        <td className="px-4 py-3">
                          <SearchableSelect
                            options={[{ value: '', label: 'No discount' }, ...discounts.map(d => ({ value: d.id, label: `${d.name} (${d.value}%)` }))]}
                            value={item.discount_id || null}
                            onChange={(val) => updateLineItem(index, 'discount_id', val || '')}
                            placeholder="Select discount"
                          />
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-600">R {item.tax_amount.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">R {item.line_total.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => removeLineItem(index)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6 sticky top-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calculator className="w-5 h-5" /> Order Summary
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Items</span>
                <span className="font-medium">{lineItems.filter(i => i.product_id).length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">R {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Discount</span>
                <span className="font-medium text-red-600">- R {discountAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tax</span>
                <span className="font-medium">R {taxAmount.toFixed(2)}</span>
              </div>
              <div className="border-t pt-3 mt-3">
                <div className="flex justify-between">
                  <span className="text-lg font-semibold text-gray-900">Total</span>
                  <span className="text-xl font-bold text-green-600">R {totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {selectedCustomer && (
              <div className="mt-6 p-4 bg-surface-secondary rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Selected Customer</h4>
                {(() => {
                  const customer = customers.find(c => c.id === selectedCustomer)
                  return customer ? (
                    <div className="text-sm text-gray-600">
                      <p className="font-medium text-gray-900">{customer.name}</p>
                      <p>Code: {customer.code}</p>
                      <p>Credit Limit: R {(customer.credit_limit || 0).toLocaleString()}</p>
                      <p>Payment Terms: {customer.payment_terms || 0} days</p>
                    </div>
                  ) : null
                })()}
              </div>
            )}

            <div className="mt-6 space-y-3">
              <button onClick={() => handleSubmit(false)} disabled={saving} className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-surface-secondary flex items-center justify-center gap-2">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save as Draft'}
              </button>
              <button onClick={() => handleSubmit(true)} disabled={saving} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2">
                <Send className="w-4 h-4" /> {saving ? 'Submitting...' : 'Submit Order'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
