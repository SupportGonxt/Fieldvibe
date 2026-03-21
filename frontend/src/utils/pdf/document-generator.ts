/**
 * PDF Document Generator
 * Uses browser-native print-to-PDF via a hidden iframe approach.
 * Generates professional PDF documents for invoices, orders, pick slips, credit notes, etc.
 */

import { escapeHtml } from '../export'

interface CompanyInfo {
  name: string
  address?: string
  phone?: string
  email?: string
  logo?: string
  taxId?: string
  website?: string
}

interface LineItem {
  description: string
  sku?: string
  quantity: number
  unit_price: number
  discount?: number
  tax?: number
  total: number
}

interface InventoryLineItem {
  description: string
  sku?: string
  quantity: number
  uom?: string
  batch_number?: string
  expected_qty?: number
  variance?: number
}

interface DocumentData {
  type: 'invoice' | 'order' | 'pick_slip' | 'credit_note' | 'delivery_note' | 'quotation' | 'receipt'
    | 'van_load' | 'van_sales_order' | 'stock_count' | 'stock_transfer' | 'stock_issue' | 'goods_receipt'
    | 'board_placement' | 'product_distribution' | 'commission_statement' | 'sales_return'
  number: string
  date: string
  due_date?: string
  status?: string
  company: CompanyInfo
  customer: {
    name: string
    address?: string
    phone?: string
    email?: string
    account_number?: string
  }
  items: LineItem[]
  subtotal: number
  tax_total: number
  discount_total?: number
  total: number
  currency?: string
  notes?: string
  terms?: string
  payment_terms?: string
  sales_rep?: string
  po_number?: string
  shipping_address?: string
  delivery_method?: string
  warehouse?: string
  // Inventory / operations-specific fields
  inventory_items?: InventoryLineItem[]
  from_warehouse?: string
  to_warehouse?: string
  van_number?: string
  driver_name?: string
  route_name?: string
  supplier_name?: string
  issued_to?: string
  count_type?: string
  agent_name?: string
  board_type?: string
  dimensions?: string
  commission_amount?: number
  gps_location?: string
  product_name?: string
  quantity?: number
  reason?: string
  return_amount?: number
  period?: string
  base_amount?: number
  bonus_amount?: number
  total_amount?: number
  sales_target?: number
  sales_achieved?: number
  achievement_rate?: number
  payment_date?: string
  detail_rows?: Array<{ label: string; value: string }>
}

const documentTitles: Record<DocumentData['type'], string> = {
  invoice: 'INVOICE',
  order: 'SALES ORDER',
  pick_slip: 'PICK SLIP',
  credit_note: 'CREDIT NOTE',
  delivery_note: 'DELIVERY NOTE',
  quotation: 'QUOTATION',
  receipt: 'RECEIPT',
  van_load: 'VAN LOAD SHEET',
  van_sales_order: 'VAN SALES ORDER',
  stock_count: 'STOCK COUNT SHEET',
  stock_transfer: 'STOCK TRANSFER NOTE',
  stock_issue: 'STOCK ISSUE NOTE',
  goods_receipt: 'GOODS RECEIVED NOTE',
  board_placement: 'BOARD PLACEMENT RECORD',
  product_distribution: 'PRODUCT DISTRIBUTION RECORD',
  commission_statement: 'COMMISSION STATEMENT',
  sales_return: 'SALES RETURN NOTE',
}

const documentColors: Record<DocumentData['type'], { primary: string; light: string }> = {
  invoice: { primary: '#2563EB', light: '#EFF6FF' },
  order: { primary: '#059669', light: '#ECFDF5' },
  pick_slip: { primary: '#D97706', light: '#FFFBEB' },
  credit_note: { primary: '#DC2626', light: '#FEF2F2' },
  delivery_note: { primary: '#7C3AED', light: '#F5F3FF' },
  quotation: { primary: '#0891B2', light: '#ECFEFF' },
  receipt: { primary: '#059669', light: '#ECFDF5' },
  van_load: { primary: '#EA580C', light: '#FFF7ED' },
  van_sales_order: { primary: '#059669', light: '#ECFDF5' },
  stock_count: { primary: '#4F46E5', light: '#EEF2FF' },
  stock_transfer: { primary: '#0D9488', light: '#F0FDFA' },
  stock_issue: { primary: '#B91C1C', light: '#FEF2F2' },
  goods_receipt: { primary: '#15803D', light: '#F0FDF4' },
  board_placement: { primary: '#7C3AED', light: '#F5F3FF' },
  product_distribution: { primary: '#2563EB', light: '#EFF6FF' },
  commission_statement: { primary: '#CA8A04', light: '#FEFCE8' },
  sales_return: { primary: '#DC2626', light: '#FEF2F2' },
}

function formatCurrencyPDF(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

function formatDatePDF(date: string): string {
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// Types that use inventory_items instead of priced line items
const inventoryDocTypes: DocumentData['type'][] = [
  'van_load', 'stock_count', 'stock_transfer', 'stock_issue', 'goods_receipt',
  'board_placement', 'product_distribution', 'commission_statement',
]

// Sales/financial document types use items[] with pricing columns.
// Inventory/operations types use inventory_items[] without pricing.

function getMetaLabel(type: DocumentData['type']): string {
  if (inventoryDocTypes.includes(type)) return 'Details'
  if (type === 'pick_slip') return 'Ship To'
  return 'Bill To'
}

function generateDetailsGridHTML(data: DocumentData, colors: { primary: string; light: string }): string {
  const rows = data.detail_rows || []
  if (rows.length === 0) return ''
  return `
    <div class="details-grid" style="background: ${colors.light};">
      ${rows.map(r => `
      <div class="detail-item">
        <span class="label">${escapeHtml(r.label)}</span>
        <span class="value">${escapeHtml(r.value)}</span>
      </div>
      `).join('')}
    </div>
  `
}

function generateInventoryTableHTML(data: DocumentData, colors: { primary: string; light: string }): string {
  const items = data.inventory_items || []
  if (items.length === 0) return ''

  const hasExpected = items.some(i => i.expected_qty !== undefined)
  const hasVariance = items.some(i => i.variance !== undefined)
  const hasBatch = items.some(i => i.batch_number)
  const hasUom = items.some(i => i.uom)

  return `
    <table>
      <thead>
        <tr>
          <th style="width: 30px;">#</th>
          <th>Description</th>
          ${hasBatch ? '<th>Batch / Lot</th>' : ''}
          ${hasUom ? '<th class="text-center">UOM</th>' : ''}
          ${hasExpected ? '<th class="text-center">Expected</th>' : ''}
          <th class="text-center">Qty</th>
          ${hasVariance ? '<th class="text-right">Variance</th>' : ''}
        </tr>
      </thead>
      <tbody>
        ${items.map((item, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>${escapeHtml(item.description)}${item.sku ? `<br><small style="color:#9CA3AF;">SKU: ${escapeHtml(item.sku)}</small>` : ''}</td>
          ${hasBatch ? `<td>${escapeHtml(item.batch_number || '-')}</td>` : ''}
          ${hasUom ? `<td class="text-center">${escapeHtml(item.uom || '-')}</td>` : ''}
          ${hasExpected ? `<td class="text-center">${item.expected_qty ?? '-'}</td>` : ''}
          <td class="text-center">${item.quantity}</td>
          ${hasVariance ? `<td class="text-right" style="color: ${(item.variance || 0) < 0 ? '#DC2626' : (item.variance || 0) > 0 ? '#059669' : '#6B7280'}; font-weight: 600;">${(item.variance || 0) > 0 ? '+' : ''}${item.variance ?? '-'}</td>` : ''}
        </tr>
        `).join('')}
      </tbody>
    </table>
    <div style="text-align: right; margin-bottom: 20px;">
      <p style="font-size: 10pt; color: #6B7280;">Total Items: <strong>${items.reduce((sum, i) => sum + i.quantity, 0)}</strong></p>
      <p style="font-size: 10pt; color: #6B7280;">Total Lines: <strong>${items.length}</strong></p>
    </div>
  `
}

function generateCommissionBodyHTML(data: DocumentData, colors: { primary: string; light: string }, currency: string): string {
  if (data.type !== 'commission_statement') return ''
  return `
    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 25px;">
      <div style="background: ${colors.light}; border-radius: 8px; padding: 15px; text-align: center;">
        <p style="font-size: 8pt; text-transform: uppercase; color: #6B7280; letter-spacing: 1px;">Base Commission</p>
        <p style="font-size: 18pt; font-weight: 700; color: ${colors.primary};">${formatCurrencyPDF(data.base_amount || 0, currency)}</p>
      </div>
      <div style="background: ${colors.light}; border-radius: 8px; padding: 15px; text-align: center;">
        <p style="font-size: 8pt; text-transform: uppercase; color: #6B7280; letter-spacing: 1px;">Bonus</p>
        <p style="font-size: 18pt; font-weight: 700; color: #059669;">${formatCurrencyPDF(data.bonus_amount || 0, currency)}</p>
      </div>
      <div style="background: ${colors.light}; border-radius: 8px; padding: 15px; text-align: center;">
        <p style="font-size: 8pt; text-transform: uppercase; color: #6B7280; letter-spacing: 1px;">Total</p>
        <p style="font-size: 18pt; font-weight: 700; color: ${colors.primary};">${formatCurrencyPDF(data.total_amount || data.total || 0, currency)}</p>
      </div>
    </div>
    ${data.sales_target ? `
    <div style="margin-bottom: 25px; background: #F9FAFB; border-radius: 8px; padding: 15px;">
      <h4 style="font-size: 9pt; text-transform: uppercase; letter-spacing: 1px; color: #6B7280; margin-bottom: 10px;">Performance Summary</h4>
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
        <div>
          <p style="font-size: 9pt; color: #6B7280;">Sales Target</p>
          <p style="font-size: 12pt; font-weight: 600;">${formatCurrencyPDF(data.sales_target, currency)}</p>
        </div>
        <div>
          <p style="font-size: 9pt; color: #6B7280;">Sales Achieved</p>
          <p style="font-size: 12pt; font-weight: 600;">${formatCurrencyPDF(data.sales_achieved || 0, currency)}</p>
        </div>
        <div>
          <p style="font-size: 9pt; color: #6B7280;">Achievement Rate</p>
          <p style="font-size: 12pt; font-weight: 600; color: ${(data.achievement_rate || 0) >= 100 ? '#059669' : '#DC2626'};">${data.achievement_rate || 0}%</p>
        </div>
      </div>
    </div>
    ` : ''}
    ${data.payment_date ? `
    <div style="margin-bottom: 15px;">
      <p style="font-size: 9pt; color: #6B7280;">Payment Date: <strong>${formatDatePDF(data.payment_date)}</strong></p>
    </div>
    ` : ''}
  `
}

function generateSignatureBlockHTML(leftLabel: string, rightLabel: string): string {
  return `
    <div style="margin-top: 30px; display: flex; justify-content: space-between;">
      <div style="width: 45%;">
        <p style="font-size: 9pt; color: #6B7280; margin-bottom: 30px;">${escapeHtml(leftLabel)}:</p>
        <div style="border-bottom: 1px solid #D1D5DB; margin-bottom: 5px;"></div>
        <p style="font-size: 8pt; color: #9CA3AF;">Signature / Date</p>
      </div>
      <div style="width: 45%;">
        <p style="font-size: 9pt; color: #6B7280; margin-bottom: 30px;">${escapeHtml(rightLabel)}:</p>
        <div style="border-bottom: 1px solid #D1D5DB; margin-bottom: 5px;"></div>
        <p style="font-size: 8pt; color: #9CA3AF;">Signature / Date</p>
      </div>
    </div>
  `
}

function getSignatureLabels(type: DocumentData['type']): [string, string] | null {
  switch (type) {
    case 'pick_slip': return ['Picked By', 'Checked By']
    case 'van_load': return ['Loaded By', 'Driver']
    case 'stock_count': return ['Counted By', 'Verified By']
    case 'stock_transfer': return ['Dispatched By', 'Received By']
    case 'stock_issue': return ['Issued By', 'Received By']
    case 'goods_receipt': return ['Received By', 'Inspected By']
    case 'board_placement': return ['Placed By', 'Verified By']
    case 'product_distribution': return ['Distributed By', 'Acknowledged By']
    case 'delivery_note': return ['Delivered By', 'Received By']
    default: return null
  }
}

function generateDocumentHTML(data: DocumentData): string {
  const title = documentTitles[data.type]
  const colors = documentColors[data.type]
  const currency = data.currency || 'USD'

  const pickSlipColumns = data.type === 'pick_slip'
  const isInventoryDoc = inventoryDocTypes.includes(data.type)
  const isCommission = data.type === 'commission_statement'
  const showPricing = !pickSlipColumns && !isInventoryDoc

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title} ${escapeHtml(data.number)}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif; color: #1F2937; font-size: 10pt; line-height: 1.5; }
    .document { max-width: 210mm; margin: 0 auto; padding: 20px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid ${colors.primary}; }
    .company-info h1 { font-size: 22pt; color: ${colors.primary}; margin-bottom: 5px; }
    .company-info p { font-size: 9pt; color: #6B7280; }
    .doc-type { text-align: right; }
    .doc-type h2 { font-size: 18pt; color: ${colors.primary}; letter-spacing: 2px; font-weight: 700; }
    .doc-type .doc-number { font-size: 11pt; color: #374151; margin-top: 5px; }
    .doc-type .doc-status { display: inline-block; padding: 3px 12px; border-radius: 12px; font-size: 9pt; font-weight: 600; background: ${colors.light}; color: ${colors.primary}; margin-top: 5px; }
    .meta-section { display: flex; justify-content: space-between; margin-bottom: 25px; }
    .meta-block { flex: 1; }
    .meta-block h3 { font-size: 8pt; text-transform: uppercase; letter-spacing: 1px; color: #9CA3AF; margin-bottom: 8px; font-weight: 600; }
    .meta-block p { font-size: 10pt; color: #374151; margin-bottom: 2px; }
    .meta-block .name { font-weight: 600; font-size: 11pt; color: #111827; }
    .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 25px; background: ${colors.light}; padding: 15px; border-radius: 8px; }
    .detail-item { display: flex; justify-content: space-between; }
    .detail-item .label { color: #6B7280; font-size: 9pt; }
    .detail-item .value { font-weight: 600; font-size: 9pt; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    thead th { background: ${colors.primary}; color: white; padding: 10px 12px; text-align: left; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.5px; }
    thead th:first-child { border-radius: 6px 0 0 0; }
    thead th:last-child { border-radius: 0 6px 0 0; text-align: right; }
    tbody td { padding: 10px 12px; border-bottom: 1px solid #E5E7EB; font-size: 9.5pt; }
    tbody tr:nth-child(even) { background: #F9FAFB; }
    tbody tr:hover { background: ${colors.light}; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .totals { display: flex; justify-content: flex-end; margin-bottom: 25px; }
    .totals-table { width: 280px; }
    .totals-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #E5E7EB; font-size: 10pt; }
    .totals-row.grand-total { border-bottom: none; border-top: 2px solid ${colors.primary}; padding-top: 10px; margin-top: 5px; font-size: 13pt; font-weight: 700; color: ${colors.primary}; }
    .notes-section { margin-top: 20px; padding: 15px; background: #F9FAFB; border-radius: 8px; border-left: 4px solid ${colors.primary}; }
    .notes-section h4 { font-size: 9pt; text-transform: uppercase; letter-spacing: 1px; color: #6B7280; margin-bottom: 5px; }
    .notes-section p { font-size: 9pt; color: #374151; }
    .footer { margin-top: 40px; padding-top: 15px; border-top: 1px solid #E5E7EB; text-align: center; font-size: 8pt; color: #9CA3AF; }
    .pick-col { width: 60px; }
    .pick-box { width: 30px; height: 30px; border: 2px solid #D1D5DB; border-radius: 4px; display: inline-block; }
    .warehouse-note { background: #FEF3C7; border: 1px solid #FCD34D; padding: 10px 15px; border-radius: 8px; margin-bottom: 20px; font-size: 9pt; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="document">
    <div class="header">
      <div class="company-info">
        <h1>${escapeHtml(data.company.name)}</h1>
        ${data.company.address ? `<p>${escapeHtml(data.company.address)}</p>` : ''}
        ${data.company.phone ? `<p>Tel: ${escapeHtml(data.company.phone)}</p>` : ''}
        ${data.company.email ? `<p>${escapeHtml(data.company.email)}</p>` : ''}
        ${data.company.taxId ? `<p>Tax ID: ${escapeHtml(data.company.taxId)}</p>` : ''}
      </div>
      <div class="doc-type">
        <h2>${title}</h2>
        <div class="doc-number">${escapeHtml(data.number)}</div>
        ${data.status ? `<div class="doc-status">${escapeHtml(data.status.toUpperCase())}</div>` : ''}
      </div>
    </div>

    <div class="meta-section">
      <div class="meta-block">
        <h3>${getMetaLabel(data.type)}</h3>
        <p class="name">${escapeHtml(data.customer.name)}</p>
        ${data.customer.address ? `<p>${escapeHtml(data.customer.address)}</p>` : ''}
        ${data.customer.phone ? `<p>${escapeHtml(data.customer.phone)}</p>` : ''}
        ${data.customer.email ? `<p>${escapeHtml(data.customer.email)}</p>` : ''}
        ${data.customer.account_number ? `<p>Account: ${escapeHtml(data.customer.account_number)}</p>` : ''}
      </div>
      <div class="meta-block" style="text-align: right;">
        <h3>Document Details</h3>
        <p>Date: <strong>${formatDatePDF(data.date)}</strong></p>
        ${data.due_date ? `<p>Due: <strong>${formatDatePDF(data.due_date)}</strong></p>` : ''}
        ${data.po_number ? `<p>PO #: <strong>${escapeHtml(data.po_number)}</strong></p>` : ''}
        ${data.sales_rep ? `<p>Sales Rep: <strong>${escapeHtml(data.sales_rep)}</strong></p>` : ''}
        ${data.payment_terms ? `<p>Terms: <strong>${escapeHtml(data.payment_terms)}</strong></p>` : ''}
        ${data.warehouse ? `<p>Warehouse: <strong>${escapeHtml(data.warehouse)}</strong></p>` : ''}
        ${data.from_warehouse ? `<p>From: <strong>${escapeHtml(data.from_warehouse)}</strong></p>` : ''}
        ${data.to_warehouse ? `<p>To: <strong>${escapeHtml(data.to_warehouse)}</strong></p>` : ''}
        ${data.van_number ? `<p>Van: <strong>${escapeHtml(data.van_number)}</strong></p>` : ''}
        ${data.driver_name ? `<p>Driver: <strong>${escapeHtml(data.driver_name)}</strong></p>` : ''}
        ${data.route_name ? `<p>Route: <strong>${escapeHtml(data.route_name)}</strong></p>` : ''}
        ${data.supplier_name ? `<p>Supplier: <strong>${escapeHtml(data.supplier_name)}</strong></p>` : ''}
        ${data.issued_to ? `<p>Issued To: <strong>${escapeHtml(data.issued_to)}</strong></p>` : ''}
        ${data.count_type ? `<p>Count Type: <strong>${escapeHtml(data.count_type)}</strong></p>` : ''}
        ${data.agent_name ? `<p>Agent: <strong>${escapeHtml(data.agent_name)}</strong></p>` : ''}
        ${data.period ? `<p>Period: <strong>${escapeHtml(data.period)}</strong></p>` : ''}
      </div>
    </div>

    ${data.shipping_address ? `
    <div class="details-grid" style="grid-template-columns: 1fr;">
      <div>
        <span class="label">Shipping Address:</span>
        <span class="value">${escapeHtml(data.shipping_address)}</span>
      </div>
    </div>
    ` : ''}

    ${data.type === 'pick_slip' && data.warehouse ? `
    <div class="warehouse-note">
      <strong>Warehouse:</strong> ${escapeHtml(data.warehouse)} &nbsp;&nbsp;|&nbsp;&nbsp;
      <strong>Delivery:</strong> ${escapeHtml(data.delivery_method || 'Standard')} &nbsp;&nbsp;|&nbsp;&nbsp;
      <strong>Date:</strong> ${formatDatePDF(data.date)}
    </div>
    ` : ''}

    ${generateDetailsGridHTML(data, colors)}

    ${isCommission ? generateCommissionBodyHTML(data, colors, currency) : ''}

    ${isInventoryDoc && !isCommission ? generateInventoryTableHTML(data, colors) : ''}

    ${!isInventoryDoc ? `
    <table>
      <thead>
        <tr>
          <th style="width: 30px;">#</th>
          ${pickSlipColumns ? '<th>SKU</th>' : ''}
          <th>Description</th>
          <th class="text-center" style="width: 70px;">Qty</th>
          ${pickSlipColumns ? '<th class="text-center pick-col">Picked</th>' : ''}
          ${showPricing ? '<th class="text-right" style="width: 90px;">Unit Price</th>' : ''}
          ${showPricing && data.items.some(i => i.discount) ? '<th class="text-right" style="width: 70px;">Disc.</th>' : ''}
          ${showPricing ? '<th class="text-right" style="width: 100px;">Total</th>' : ''}
        </tr>
      </thead>
      <tbody>
        ${data.items.map((item, idx) => `
        <tr>
          <td>${idx + 1}</td>
          ${pickSlipColumns ? `<td>${escapeHtml(item.sku || '-')}</td>` : ''}
          <td>${escapeHtml(item.description)}${item.sku && !pickSlipColumns ? `<br><small style="color:#9CA3AF;">SKU: ${escapeHtml(item.sku)}</small>` : ''}</td>
          <td class="text-center">${item.quantity}</td>
          ${pickSlipColumns ? '<td class="text-center"><span class="pick-box"></span></td>' : ''}
          ${showPricing ? `<td class="text-right">${formatCurrencyPDF(item.unit_price, currency)}</td>` : ''}
          ${showPricing && data.items.some(i => i.discount) ? `<td class="text-right">${item.discount ? formatCurrencyPDF(item.discount, currency) : '-'}</td>` : ''}
          ${showPricing ? `<td class="text-right"><strong>${formatCurrencyPDF(item.total, currency)}</strong></td>` : ''}
        </tr>
        `).join('')}
      </tbody>
    </table>
    ` : ''}

    ${showPricing ? `
    <div class="totals">
      <div class="totals-table">
        <div class="totals-row">
          <span>Subtotal</span>
          <span>${formatCurrencyPDF(data.subtotal, currency)}</span>
        </div>
        ${data.discount_total ? `
        <div class="totals-row">
          <span>Discount</span>
          <span>-${formatCurrencyPDF(data.discount_total, currency)}</span>
        </div>
        ` : ''}
        <div class="totals-row">
          <span>Tax</span>
          <span>${formatCurrencyPDF(data.tax_total, currency)}</span>
        </div>
        <div class="totals-row grand-total">
          <span>${data.type === 'credit_note' ? 'Credit Total' : data.type === 'sales_return' ? 'Return Total' : 'Total Due'}</span>
          <span>${formatCurrencyPDF(data.total, currency)}</span>
        </div>
      </div>
    </div>
    ` : `${!isInventoryDoc ? `
    <div style="text-align: right; margin-bottom: 20px;">
      <p style="font-size: 10pt; color: #6B7280;">Total Items: <strong>${data.items.reduce((sum, i) => sum + i.quantity, 0)}</strong></p>
      <p style="font-size: 10pt; color: #6B7280;">Total Lines: <strong>${data.items.length}</strong></p>
    </div>
    ` : ''}`}

    ${data.commission_amount !== undefined && data.type !== 'commission_statement' ? `
    <div class="totals">
      <div class="totals-table">
        <div class="totals-row grand-total">
          <span>Commission</span>
          <span>${formatCurrencyPDF(data.commission_amount, currency)}</span>
        </div>
      </div>
    </div>
    ` : ''}

    ${data.notes ? `
    <div class="notes-section">
      <h4>Notes</h4>
      <p>${escapeHtml(data.notes)}</p>
    </div>
    ` : ''}

    ${data.terms ? `
    <div class="notes-section" style="margin-top: 10px;">
      <h4>Terms & Conditions</h4>
      <p>${escapeHtml(data.terms)}</p>
    </div>
    ` : ''}

    ${data.reason ? `
    <div class="notes-section" style="margin-top: 10px;">
      <h4>Reason</h4>
      <p>${escapeHtml(data.reason)}</p>
    </div>
    ` : ''}

    ${data.gps_location ? `
    <div style="margin-top: 15px; font-size: 9pt; color: #6B7280;">
      <strong>GPS Location:</strong> ${escapeHtml(data.gps_location)}
    </div>
    ` : ''}

    ${(() => {
      const labels = getSignatureLabels(data.type)
      return labels ? generateSignatureBlockHTML(labels[0], labels[1]) : ''
    })()}

    <div class="footer">
      <p>${escapeHtml(data.company.name)}${data.company.website ? ` | ${escapeHtml(data.company.website)}` : ''}${data.company.email ? ` | ${escapeHtml(data.company.email)}` : ''}</p>
      <p>Generated on ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
    </div>
  </div>
</body>
</html>`
}

export function generatePDF(data: DocumentData): void {
  const html = generateDocumentHTML(data)
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    // Fallback: use iframe
    const iframe = document.createElement('iframe')
    iframe.style.display = 'none'
    document.body.appendChild(iframe)
    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (doc) {
      doc.open()
      doc.write(html)
      doc.close()
      setTimeout(() => {
        iframe.contentWindow?.print()
        setTimeout(() => document.body.removeChild(iframe), 1000)
      }, 500)
    }
    return
  }
  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
  setTimeout(() => {
    printWindow.print()
  }, 500)
}

export function downloadPDFAsHTML(data: DocumentData): void {
  const html = generateDocumentHTML(data)
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${documentTitles[data.type].replace(/\s+/g, '_')}_${data.number}.html`
  a.click()
  URL.revokeObjectURL(url)
}

export type { DocumentData, LineItem, CompanyInfo }
