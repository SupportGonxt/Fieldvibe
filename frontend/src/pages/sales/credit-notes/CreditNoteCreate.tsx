import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Send, CreditCard, FileText } from 'lucide-react'
import LineItemsEditor, { LineItem, LineItemsTotals, TotalsSummary, Discount } from '../../../components/transactions/LineItemsEditor'
import { salesService } from '../../../services/sales.service'
import { productsService } from '../../../services/products.service'
import { customersService } from '../../../services/customers.service'
import { discountsService } from '../../../services/discounts.service'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { useToast } from '../../../components/ui/Toast'
import SearchableSelect from '../../../components/ui/SearchableSelect'

interface Customer {
  id: string
  name: string
  code?: string
}

interface Product {
  id: string
  name: string
  price: number
  selling_price?: number
  tax_rate?: number
}

export default function CreditNoteCreate() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [discounts, setDiscounts] = useState<Discount[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [creditNoteDate, setCreditNoteDate] = useState(new Date().toISOString().split('T')[0])
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [totals, setTotals] = useState<LineItemsTotals>({ subtotal: 0, discount_amount: 0, tax_amount: 0, total_amount: 0, item_count: 0 })

  useEffect(() => {
    loadFormData()
  }, [])

  const loadFormData = async () => {
    try {
      setLoading(true)
      const [customersRes, productsRes, discountsRes] = await Promise.all([
        customersService.getCustomers(),
        productsService.getProducts(),
        discountsService.getDiscounts({ is_active: true })
      ])
      setCustomers(customersRes.customers || customersRes.data || [])
      setProducts(productsRes.products || productsRes.data || [])
      setDiscounts(discountsRes.map((d: any) => ({ id: d.id, name: d.name, value: d.value, discount_type: d.discount_type })))
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
    if (!reason) {
      toast.info('Please select a reason')
      return
    }
    if (lineItems.length === 0 || !lineItems.some(item => item.product_id)) {
      toast.info('Please add at least one item')
      return
    }

    try {
      setSaving(true)
      const creditNoteData = {
        customer_id: selectedCustomer,
        credit_note_date: creditNoteDate,
        reason,
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

      await salesService.createCreditNote(creditNoteData)
      navigate('/sales/credit-notes')
    } catch (error: any) {
      console.error('Failed to create credit note:', error)
      toast.error(error.message || 'Failed to create credit note')
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
          <button onClick={() => navigate('/sales/credit-notes')} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create Credit Note</h1>
            <p className="text-sm text-gray-600">Issue credit for returned or adjusted items</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => handleSubmit(false)} disabled={saving} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-surface-secondary flex items-center gap-2">
            <Save className="w-4 h-4" /> Save as Draft
          </button>
          <button onClick={() => handleSubmit(true)} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
            <Send className="w-4 h-4" /> Issue Credit Note
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-3 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" /> Credit Note Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
                <SearchableSelect
                  options={[
                    { value: '', label: 'Select a customer' },
                    { value: 'customer.id', label: '{customer.name}' },
                  ]}
                  value={selectedCustomer || null}
                  onChange={(val) => setSelectedCustomer(val || '')}
                  placeholder="Select a customer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Credit Note Date</label>
                <input type="date" value={creditNoteDate} onChange={(e) => setCreditNoteDate(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 hover:border-gray-300 transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
                <SearchableSelect
                  options={[
                    { value: '', label: 'Select a reason' },
                    { value: 'return', label: 'Product Return' },
                    { value: 'discount', label: 'Discount Adjustment' },
                    { value: 'error', label: 'Billing Error' },
                    { value: 'damage', label: 'Damaged Goods' },
                    { value: 'other', label: 'Other' },
                  ]}
                  value={reason || null}
                  onChange={(val) => setReason(val || '')}
                  placeholder="Select a reason"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Credit note notes..." className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 hover:border-gray-300 transition-colors" />
              </div>
            </div>
          </div>

          <LineItemsEditor
            products={products}
            discounts={discounts}
            lineItems={lineItems}
            onLineItemsChange={setLineItems}
            onTotalsChange={setTotals}
            title="Credit Note Items"
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
                <Send className="w-4 h-4" /> {saving ? 'Issuing...' : 'Issue Credit Note'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
