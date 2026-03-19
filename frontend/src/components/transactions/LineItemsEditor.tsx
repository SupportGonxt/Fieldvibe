import { useState, useEffect } from 'react'
import { Plus, Trash2, Calculator, Package, ChevronDown, Search } from 'lucide-react'

export interface Product {
  id: string
  name: string
  code?: string
  sku?: string
  price: number
  selling_price?: number
  cost_price?: number
  tax_rate?: number
  unit_of_measure?: string
}

export interface Discount {
  id: string
  name: string
  value: number
  discount_type: 'percentage' | 'fixed'
}

export interface LineItem {
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  cost_price: number
  discount_id: string
  discount_percentage: number
  discount_amount: number
  tax_percentage: number
  tax_amount: number
  line_total: number
}

export interface LineItemsTotals {
  subtotal: number
  discount_amount: number
  tax_amount: number
  total_amount: number
  item_count: number
}

interface LineItemsEditorProps {
  products: Product[]
  discounts?: Discount[]
  lineItems: LineItem[]
  onLineItemsChange: (items: LineItem[]) => void
  onTotalsChange?: (totals: LineItemsTotals) => void
  onRecalculate?: () => void
  calculating?: boolean
  readOnly?: boolean
  showCostPrice?: boolean
  currencySymbol?: string
  title?: string
}

export function createEmptyLineItem(): LineItem {
  return {
    product_id: '',
    product_name: '',
    quantity: 1,
    unit_price: 0,
    cost_price: 0,
    discount_id: '',
    discount_percentage: 0,
    discount_amount: 0,
    tax_percentage: 0,
    tax_amount: 0,
    line_total: 0
  }
}

export function calculateLineItemTotals(item: LineItem): LineItem {
  const subtotal = item.unit_price * item.quantity
  const discountAmount = (subtotal * item.discount_percentage) / 100
  const discountedSubtotal = subtotal - discountAmount
  const taxAmount = (discountedSubtotal * item.tax_percentage) / 100
  const lineTotal = discountedSubtotal + taxAmount

  return {
    ...item,
    discount_amount: discountAmount,
    tax_amount: taxAmount,
    line_total: lineTotal
  }
}

export function calculateTotals(items: LineItem[]): LineItemsTotals {
  const validItems = items.filter(item => item.product_id)
  return {
    subtotal: validItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0),
    discount_amount: validItems.reduce((sum, item) => sum + item.discount_amount, 0),
    tax_amount: validItems.reduce((sum, item) => sum + item.tax_amount, 0),
    total_amount: validItems.reduce((sum, item) => sum + item.line_total, 0),
    item_count: validItems.length
  }
}

function ProductSearchSelect({
  products,
  value,
  onChange,
  currencySymbol = 'R'
}: {
  products: Product[]
  value: string
  onChange: (productId: string) => void
  currencySymbol?: string
}) {
  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  const selectedProduct = products.find(p => p.id === value)

  const filtered = search
    ? products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(search.toLowerCase())) ||
        (p.code && p.code.toLowerCase().includes(search.toLowerCase()))
      )
    : products

  return (
    <div className="relative">
      <div
        className="w-full flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-lg bg-white hover:border-gray-300 transition-colors cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
        {isOpen ? (
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products by name, SKU, or code..."
            className="flex-1 outline-none text-sm text-gray-900 bg-transparent"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={`flex-1 text-sm truncate ${selectedProduct ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
            {selectedProduct ? selectedProduct.name : 'Search & select a product...'}
          </span>
        )}
        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => { setIsOpen(false); setSearch('') }} />
          <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500">No products found</div>
            ) : (
              filtered.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => {
                    onChange(product.id)
                    setIsOpen(false)
                    setSearch('')
                  }}
                  className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-b-0 ${
                    product.id === value ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                      {(product.sku || product.code) && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {product.sku && `SKU: ${product.sku}`}
                          {product.sku && product.code && ' \u00b7 '}
                          {product.code && `Code: ${product.code}`}
                        </p>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-blue-600 whitespace-nowrap">
                      {currencySymbol} {(product.selling_price || product.price || 0).toFixed(2)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default function LineItemsEditor({
  products,
  discounts = [],
  lineItems,
  onLineItemsChange,
  onTotalsChange,
  onRecalculate,
  calculating = false,
  readOnly = false,
  showCostPrice = false,
  currencySymbol = 'R',
  title = 'Line Items'
}: LineItemsEditorProps) {
  
  useEffect(() => {
    if (onTotalsChange) {
      onTotalsChange(calculateTotals(lineItems))
    }
  }, [lineItems, onTotalsChange])

  const addLineItem = () => {
    onLineItemsChange([...lineItems, createEmptyLineItem()])
  }

  const removeLineItem = (index: number) => {
    const newItems = lineItems.filter((_, i) => i !== index)
    onLineItemsChange(newItems)
  }

  const updateLineItem = (index: number, field: string, value: any) => {
    const newItems = [...lineItems]
    let item = { ...newItems[index] }

    if (field === 'product_id') {
      const product = products.find(p => p.id === value)
      if (product) {
        item.product_id = value
        item.product_name = product.name
        // Pricing is set from product master data - salesmen cannot modify
        item.unit_price = product.selling_price || product.price || 0
        item.cost_price = product.cost_price || 0
        item.tax_percentage = product.tax_rate || 0
        item.discount_percentage = 0
      }
    } else if (field === 'quantity') {
      item.quantity = Math.max(1, parseInt(value) || 1)
    }

    item = calculateLineItemTotals(item)
    newItems[index] = item
    onLineItemsChange(newItems)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Package className="w-5 h-5 text-blue-600" />
          {title}
          {lineItems.filter(i => i.product_id).length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
              {lineItems.filter(i => i.product_id).length} item{lineItems.filter(i => i.product_id).length !== 1 ? 's' : ''}
            </span>
          )}
        </h3>
        {!readOnly && (
          <div className="flex gap-2">
            {onRecalculate && (
              <button
                type="button"
                onClick={onRecalculate}
                disabled={calculating}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1.5 text-gray-700 transition-colors"
              >
                <Calculator className="w-4 h-4" />
                <span className="hidden sm:inline">{calculating ? 'Calculating...' : 'Recalculate'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={addLineItem}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5 font-medium transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Item
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 sm:p-6">
        {lineItems.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Package className="w-16 h-16 mx-auto mb-3 text-gray-200" />
            <p className="text-base font-medium text-gray-400">No items added yet</p>
            {!readOnly && (
              <button
                type="button"
                onClick={addLineItem}
                className="mt-3 text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                + Add your first item
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {lineItems.map((item, index) => (
              <div
                key={index}
                className="border border-gray-200 rounded-xl bg-white hover:border-gray-300 transition-all"
              >
                {/* Item header with number and remove */}
                <div className="flex items-center justify-between px-4 sm:px-5 pt-4 pb-2">
                  <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-md">
                    Item {index + 1}
                  </span>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => removeLineItem(index)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1 text-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Remove</span>
                    </button>
                  )}
                </div>

                {/* Product selector - full width */}
                <div className="px-4 sm:px-5 pb-3">
                  {readOnly ? (
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-semibold text-gray-900">{item.product_name || 'No product selected'}</span>
                    </div>
                  ) : (
                    <ProductSearchSelect
                      products={products}
                      value={item.product_id}
                      onChange={(productId) => updateLineItem(index, 'product_id', productId)}
                      currencySymbol={currencySymbol}
                    />
                  )}
                </div>

                {/* Details grid */}
                {item.product_id && (
                  <div className="px-4 sm:px-5 pb-4">
                    <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                      <div className={`grid gap-4 ${showCostPrice ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'}`}>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Quantity</label>
                          {readOnly ? (
                            <p className="text-base font-semibold text-gray-900">{item.quantity}</p>
                          ) : (
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateLineItem(index, 'quantity', e.target.value)}
                              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-semibold text-gray-900 bg-white hover:border-gray-300 transition-colors"
                            />
                          )}
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Unit Price</label>
                          <p className="text-sm font-medium text-gray-900 py-2.5">{currencySymbol} {item.unit_price.toFixed(2)}</p>
                        </div>
                        {showCostPrice && (
                          <div>
                            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Cost</label>
                            <p className="text-sm text-gray-500 py-2.5">{currencySymbol} {item.cost_price.toFixed(2)}</p>
                          </div>
                        )}
                        <div>
                          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Discount</label>
                          <div className="py-2.5">
                            {item.discount_percentage > 0 ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                                {item.discount_percentage}% off
                              </span>
                            ) : (
                              <span className="text-sm text-gray-300">None</span>
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Tax</label>
                          <p className="text-sm text-gray-600 py-2.5">{currencySymbol} {item.tax_amount.toFixed(2)}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Line Total</label>
                          <p className="text-base font-bold text-gray-900 py-2">{currencySymbol} {item.line_total.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {!readOnly && (
              <button
                type="button"
                onClick={addLineItem}
                className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/50 flex items-center justify-center gap-2 transition-all"
              >
                <Plus className="w-4 h-4" />
                Add another item
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

interface TotalsSummaryProps {
  totals: LineItemsTotals
  currencySymbol?: string
  showItemCount?: boolean
}

export function TotalsSummary({ totals, currencySymbol = 'R', showItemCount = true }: TotalsSummaryProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="px-6 py-4 border-b border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Calculator className="w-5 h-5 text-blue-600" />
          Order Summary
        </h3>
      </div>
      <div className="px-6 py-4 space-y-3">
        {showItemCount && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Items</span>
            <span className="font-medium text-gray-900">{totals.item_count}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Subtotal</span>
          <span className="font-medium text-gray-900">{currencySymbol} {totals.subtotal.toFixed(2)}</span>
        </div>
        {totals.discount_amount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Discount</span>
            <span className="font-medium text-red-600">- {currencySymbol} {totals.discount_amount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Tax (VAT)</span>
          <span className="font-medium text-gray-900">{currencySymbol} {totals.tax_amount.toFixed(2)}</span>
        </div>
        <div className="border-t border-gray-100 pt-3 mt-3">
          <div className="flex justify-between items-center">
            <span className="text-base font-semibold text-gray-900">Total Due</span>
            <span className="text-xl font-bold text-blue-600">{currencySymbol} {totals.total_amount.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
