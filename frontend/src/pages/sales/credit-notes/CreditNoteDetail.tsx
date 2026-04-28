import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import TransactionDetail from '../../../components/transactions/TransactionDetail'
import DocumentActions from '../../../components/export/DocumentActions'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { salesService } from '../../../services/sales.service'
import { formatCurrency, formatDate } from '../../../utils/format'
import toast from 'react-hot-toast'
import { CheckCircle2, Slash, X } from 'lucide-react'
import type { DocumentData } from '../../../utils/pdf/document-generator'

const STATUS_COLOR_MAP: Record<string, 'green' | 'yellow' | 'red' | 'gray'> = {
  ISSUED: 'green',
  PARTIALLY_APPLIED: 'yellow',
  FULLY_APPLIED: 'green',
  VOIDED: 'gray',
  issued: 'green',
  partially_applied: 'yellow',
  fully_applied: 'green',
  voided: 'gray',
}

export default function CreditNoteDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [creditNote, setCreditNote] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [orders, setOrders] = useState<any[]>([])
  const [showApply, setShowApply] = useState(false)
  const [applyOrderId, setApplyOrderId] = useState('')
  const [applyAmount, setApplyAmount] = useState('')
  const [working, setWorking] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await salesService.getCreditNote(String(id))
      setCreditNote(response.data?.data || response.data)
    } catch (err: any) {
      console.error('Failed to load credit note:', err)
      setError(err.message || 'Failed to load credit note details')
    } finally {
      setLoading(false)
    }
  }

  const loadOrders = async () => {
    try {
      const r = await salesService.getOrders()
      const list = r?.data?.data?.orders || r?.data?.data || r?.data?.orders || r?.data || []
      const filtered = (Array.isArray(list) ? list : []).filter(
        (o: any) => creditNote?.customer_id ? o.customer_id === creditNote.customer_id : true
      )
      setOrders(filtered)
    } catch (e) {
      console.error('Failed to load orders for apply:', e)
      setOrders([])
    }
  }

  useEffect(() => { load() }, [id])

  const openApply = async () => {
    setApplyOrderId('')
    setApplyAmount('')
    setShowApply(true)
    await loadOrders()
  }

  const submitApply = async () => {
    if (!creditNote || !applyOrderId) return
    const amountNum = applyAmount.trim() ? Number(applyAmount) : undefined
    if (amountNum != null && (!Number.isFinite(amountNum) || amountNum <= 0)) {
      toast.error('Amount must be a positive number')
      return
    }
    setWorking(true)
    try {
      await salesService.applyCreditNote(creditNote.id, applyOrderId, amountNum)
      toast.success('Credit note applied')
      setShowApply(false)
      await load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to apply credit note')
    } finally {
      setWorking(false)
    }
  }

  const submitVoid = async () => {
    if (!creditNote) return
    if (!confirm('Void this credit note? It will return its full amount to the customer balance and cannot be applied later.')) return
    setWorking(true)
    try {
      await salesService.voidCreditNote(creditNote.id)
      toast.success('Credit note voided')
      await load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to void credit note')
    } finally {
      setWorking(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }
  if (error) {
    return <ErrorState title="Failed to load credit note" message={error} onRetry={load} />
  }
  if (!creditNote) {
    return <ErrorState title="Credit note not found" message="The credit note you are looking for does not exist or has been deleted." />
  }

  const amount = Number(creditNote.amount ?? creditNote.credit_amount ?? 0)
  const applied = Number(creditNote.applied_amount ?? 0)
  const remainingFallback = amount - applied
  const remaining = creditNote.remaining_balance != null ? Number(creditNote.remaining_balance) : remainingFallback
  const status: string = creditNote.status || ''
  const isVoidable = status === 'ISSUED' || status === 'issued'
  const isApplicable = isVoidable || status === 'PARTIALLY_APPLIED' || status === 'partially_applied'

  let appliedHistory: Array<{ order_id: string; amount?: number; applied_at?: string }> = []
  try {
    const raw = creditNote.applied_to_orders
    if (raw) {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (Array.isArray(parsed)) appliedHistory = parsed.map((entry: any) =>
        typeof entry === 'string' ? { order_id: entry } : entry
      )
    }
  } catch { /* legacy strings */ }

  const fields = [
    { label: 'Credit Number', value: creditNote.credit_number || creditNote.credit_note_number || '—' },
    { label: 'Issued', value: creditNote.created_at ? formatDate(creditNote.created_at) : '—' },
    { label: 'Customer', value: creditNote.customer_name || '—' },
    { label: 'Total Amount', value: formatCurrency(amount) },
    { label: 'Applied So Far', value: formatCurrency(applied) },
    { label: 'Remaining Balance', value: formatCurrency(remaining) },
    { label: 'Status', value: status.replace(/_/g, ' ').toLowerCase() },
    { label: 'Reason', value: creditNote.reason || '—' },
  ]

  const statusColor = STATUS_COLOR_MAP[status] || 'gray'

  const documentData: DocumentData = {
    type: 'credit_note',
    number: creditNote.credit_number || `CN-${id}`,
    date: creditNote.created_at || new Date().toISOString(),
    status,
    company: { name: 'Fieldvibe', email: 'sales@fieldvibe.com' },
    customer: { name: creditNote.customer_name || 'Customer' },
    items: [],
    subtotal: amount,
    tax_total: 0,
    total: amount,
    notes: creditNote.notes,
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        {isApplicable && (
          <button
            onClick={openApply}
            disabled={working || remaining <= 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" /> Apply to order
          </button>
        )}
        {isVoidable && (
          <button
            onClick={submitVoid}
            disabled={working}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-2"
          >
            <Slash className="w-4 h-4" /> Void
          </button>
        )}
        <DocumentActions documentData={documentData} />
      </div>
      <TransactionDetail
        title={`Credit Note ${creditNote.credit_number || creditNote.credit_note_number || ''}`}
        fields={fields}
        auditTrail={creditNote.audit_trail || []}
        backPath="/sales/credit-notes"
        status={status}
        statusColor={statusColor}
      />

      {appliedHistory.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Application history</h3>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Order</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">When</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {appliedHistory.map((entry, i) => (
                <tr key={i}>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <button
                      onClick={() => navigate(`/sales/orders/${entry.order_id}`)}
                      className="text-primary-600 hover:text-primary-800"
                    >
                      {entry.order_id}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {entry.amount != null ? formatCurrency(Number(entry.amount)) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {entry.applied_at ? formatDate(entry.applied_at) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showApply && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-lg font-medium text-gray-900">Apply credit note</h3>
              <button onClick={() => setShowApply(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Remaining balance: <span className="font-semibold">{formatCurrency(remaining)}</span>. Leave amount blank to apply the lesser of the remaining balance and the order's outstanding amount.
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
            <select
              value={applyOrderId}
              onChange={(e) => setApplyOrderId(e.target.value)}
              className="w-full mb-3 rounded-md border-gray-300"
            >
              <option value="">Select an order…</option>
              {orders.map((o: any) => (
                <option key={o.id} value={o.id}>
                  {o.order_number} — {o.customer_name || ''} — {formatCurrency(Number(o.total_amount || 0))}
                </option>
              ))}
            </select>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (optional)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={applyAmount}
              onChange={(e) => setApplyAmount(e.target.value)}
              placeholder={`Up to ${remaining}`}
              className="w-full mb-4 rounded-md border-gray-300"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowApply(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={submitApply}
                disabled={!applyOrderId || working}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {working ? 'Applying…' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
