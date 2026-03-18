import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Send, ShoppingCart, User } from 'lucide-react'
import LineItemsEditor, { LineItem, LineItemsTotals, TotalsSummary, Discount } from '../../../components/transactions/LineItemsEditor'
import { salesService } from '../../../services/sales.service'
import { productsService } from '../../../services/products.service'
import { discountsService } from '../../../services/discounts.service'
import { pricingService } from '../../../services/pricing.service'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { useToast } from '../../../components/ui/Toast'
import SearchableSelect from '../../../components/ui/SearchableSelect'
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges'
import type { SearchableSelectOption } from '../../../components/ui/SearchableSelect'

interface Customer {
  id: string
  name: string
}

interface SalesRep {
  id: string
  name: string
}

interface Product {
  id: string
  name: string
  price: number
  selling_price?: number
  tax_rate?: number
}

export default function SalesOrderCreate() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [salesReps, setSalesReps] = useState<SalesRep[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [discounts, setDiscounts] = useState<Discount[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [selectedSalesRep, setSelectedSalesRep] = useState('')
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0])
  const [deliveryDate, setDeliveryDate] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('cash')
  const [notes, setNotes] = useState('')
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [totals, setTotals] = useState<LineItemsTotals>({ subtotal: 0, discount_amount: 0, tax_amount: 0, total_amount: 0, item_count: 0 })
  const [customerPrices, setCustomerPrices] = useState<Record<string, { price: number; source: string }>>({})
  const baseProductsRef = useRef<Product[]>([])

  const hasUnsavedChanges = useMemo(() => {
    return selectedCustomer !== '' || lineItems.some(item => item.product_id) || notes !== ''
  }, [selectedCustomer, lineItems, notes])
  useUnsavedChanges(hasUnsavedChanges)

  useEffect(() => {
    loadFormData()
  }, [])

  // Fetch customer-specific prices when customer changes (Section 1.4)
  useEffect(() => {
    let stale = false
    if (selectedCustomer) {
      pricingService.getCustomerPrices(selectedCustomer).then(prices => {
        if (stale) return
        const priceMap: Record<string, { price: number; source: string }> = {}
        prices.forEach(p => { priceMap[p.product_id] = { price: p.resolved_price, source: p.source } })
        setCustomerPrices(priceMap)
        // Derive prices from base products, not from mutated state
        setProducts(baseProductsRef.current.map(prod => {
          const resolved = priceMap[prod.id]
          return resolved ? { ...prod, price: resolved.price, selling_price: resolved.price } : prod
        }))
      }).catch(() => {})
    } else {
      setCustomerPrices({})
      // Restore original base prices
      if (baseProductsRef.current.length > 0) {
        setProducts(baseProductsRef.current)
      }
    }
    return () => { stale = true }
  }, [selectedCustomer])

  const loadFormData = async () => {
    try {
      setLoading(true)
      // Use Promise.allSettled to handle partial failures gracefully
      const [customersRes, salesRepsRes, productsRes, discountsRes] = await Promise.allSettled([
        salesService.getCustomers(),
        salesService.getSalesReps().catch(() => ({ data: [] })), // Sales reps endpoint may not exist
        productsService.getProducts(),
        discountsService.getDiscounts({ is_active: true })
      ])
      
      // Extract data from settled promises
      if (customersRes.status === 'fulfilled') {
        // Handle various response shapes from the API
        const response = customersRes.value
        let customersData: any[] = []
        
        // Try different paths to find the customers array
        if (response?.data?.data?.customers && Array.isArray(response.data.data.customers)) {
          customersData = response.data.data.customers
        } else if (response?.data?.customers && Array.isArray(response.data.customers)) {
          customersData = response.data.customers
        } else if (response?.data?.data && Array.isArray(response.data.data)) {
          customersData = response.data.data
        } else if (response?.data && Array.isArray(response.data)) {
          customersData = response.data
        }
        
        setCustomers(customersData)
      }
      if (salesRepsRes.status === 'fulfilled') {
        const data = salesRepsRes.value?.data?.data || salesRepsRes.value?.data || []
        setSalesReps(Array.isArray(data) ? data : [])
      }
      if (productsRes.status === 'fulfilled') {
        // productsService.getProducts() returns { products, categories, brands, pagination } directly
        const response = productsRes.value
        let productsData: any[] = []
        
        // Try different paths to find the products array
        if (response?.products && Array.isArray(response.products)) {
          productsData = response.products
        } else if (response?.data?.data?.products && Array.isArray(response.data.data.products)) {
          productsData = response.data.data.products
        } else if (response?.data?.products && Array.isArray(response.data.products)) {
          productsData = response.data.products
        } else if (response?.data?.data && Array.isArray(response.data.data)) {
          productsData = response.data.data
        } else if (response?.data && Array.isArray(response.data)) {
          productsData = response.data
        }
        
        setProducts(productsData)
        baseProductsRef.current = productsData
      }
      if (discountsRes.status === 'fulfilled') {
        const data = discountsRes.value || []
        setDiscounts(Array.isArray(data) ? data.map((d: any) => ({ id: d.id, name: d.name, value: d.value, discount_type: d.discount_type })) : [])
      }
    } catch (error) {
      console.error('Failed to load form data:', error)
    } finally {
      setLoading(false)
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
        sales_rep_id: selectedSalesRep || undefined,
        order_date: orderDate,
        delivery_date: deliveryDate || undefined,
        payment_terms: paymentTerms,
        notes,
        submit,
        items: lineItems.filter(item => item.product_id).map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percentage: item.discount_percentage
        })),
        subtotal: totals.subtotal,
        discount_amount: totals.discount_amount,
        tax_amount: totals.tax_amount,
        total_amount: totals.total_amount
      }

      await salesService.createOrder(orderData)
      navigate('/sales/orders')
    } catch (error: any) {
      console.error('Failed to create order:', error)
      toast.error(error.message || 'Failed to create order')
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
          <button onClick={() => navigate('/sales/orders')} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create Sales Order</h1>
            <p className="text-sm text-gray-600">Create a new sales order</p>
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

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-3 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-blue-600" /> Order Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <div>
                <SearchableSelect
                  label="Customer *"
                  placeholder="Select a customer"
                  options={customers.map(c => ({ value: c.id, label: c.name }))}
                  value={selectedCustomer}
                  onChange={(val) => setSelectedCustomer(val || '')}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sales Rep</label>
                <select value={selectedSalesRep} onChange={(e) => setSelectedSalesRep(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white hover:border-gray-300 transition-colors">
                  <option value="">Select a sales rep</option>
                  {salesReps.map((rep) => (
                    <option key={rep.id} value={rep.id}>{rep.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Order Date</label>
                <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 hover:border-gray-300 transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Date</label>
                <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 hover:border-gray-300 transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
                <select value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white hover:border-gray-300 transition-colors">
                  <option value="cash">Cash</option>
                  <option value="credit_7">Credit 7 Days</option>
                  <option value="credit_30">Credit 30 Days</option>
                  <option value="credit_60">Credit 60 Days</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Order notes..." className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 hover:border-gray-300 transition-colors" />
              </div>
            </div>
          </div>

          <LineItemsEditor
            products={products}
            discounts={discounts}
            lineItems={lineItems}
            onLineItemsChange={setLineItems}
            onTotalsChange={setTotals}
            title="Order Items"
          />
        </div>

        <div className="xl:col-span-1">
          <div className="sticky top-6 space-y-6">
            <TotalsSummary totals={totals} />
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-3">
              <button onClick={() => handleSubmit(false)} disabled={saving} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2 text-gray-700 font-medium transition-colors">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save as Draft'}
              </button>
              <button onClick={() => handleSubmit(true)} disabled={saving} className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 font-medium transition-colors shadow-sm">
                <Send className="w-4 h-4" /> {saving ? 'Submitting...' : 'Submit Order'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
