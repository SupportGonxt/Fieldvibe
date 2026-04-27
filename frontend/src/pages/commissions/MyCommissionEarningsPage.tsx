import { useEffect, useMemo, useState } from 'react'
import { commissionsService } from '../../services/commissions.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'
import { AlertTriangle, CheckCircle2, Clock, Filter, RotateCcw, X } from 'lucide-react'

interface Earning {
  id: string
  source_type: string
  source_id: string | null
  rate: number
  base_amount: number
  amount: number
  status: 'pending' | 'disputed' | 'approved' | 'rejected' | 'reversed' | 'paid' | string
  dispute_reason?: string | null
  disputed_at?: string | null
  rejection_reason?: string | null
  reversal_reason?: string | null
  created_at: string
  approved_at?: string | null
  rule_name?: string | null
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  disputed: 'bg-orange-100 text-orange-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  reversed: 'bg-gray-200 text-gray-800',
  paid: 'bg-blue-100 text-blue-800',
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount || 0)
}

export default function MyCommissionEarningsPage() {
  const [earnings, setEarnings] = useState<Earning[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')

  const [disputeTarget, setDisputeTarget] = useState<Earning | null>(null)
  const [disputeReason, setDisputeReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await commissionsService.getMyCommissionEarnings(statusFilter || undefined)
      setEarnings(data as Earning[])
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load commissions')
      setEarnings([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [statusFilter])

  const totals = useMemo(() => {
    let pending = 0, approved = 0, paid = 0
    for (const e of earnings) {
      if (e.status === 'pending' || e.status === 'disputed') pending += Number(e.amount || 0)
      else if (e.status === 'approved') approved += Number(e.amount || 0)
      else if (e.status === 'paid') paid += Number(e.amount || 0)
    }
    return { pending, approved, paid }
  }, [earnings])

  const submitDispute = async () => {
    if (!disputeTarget || !disputeReason.trim()) return
    setSubmitting(true)
    try {
      await commissionsService.disputeCommissionEarning(disputeTarget.id, disputeReason.trim())
      toast.success('Dispute submitted')
      setDisputeTarget(null)
      setDisputeReason('')
      await load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to submit dispute')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Commissions</h1>
          <p className="text-sm text-gray-500 mt-1">Earnings tied to your sales and visits. Dispute a pending entry if it looks wrong.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard icon={<Clock className="h-5 w-5" />} label="Pending / disputed" value={formatCurrency(totals.pending)} tone="bg-yellow-50 text-yellow-800" />
        <SummaryCard icon={<CheckCircle2 className="h-5 w-5" />} label="Approved" value={formatCurrency(totals.approved)} tone="bg-green-50 text-green-800" />
        <SummaryCard icon={<CheckCircle2 className="h-5 w-5" />} label="Paid" value={formatCurrency(totals.paid)} tone="bg-blue-50 text-blue-800" />
      </div>

      <div className="bg-white rounded-lg shadow p-4 flex items-center gap-3">
        <Filter className="w-4 h-4 text-gray-500" />
        <label className="text-sm font-medium text-gray-700">Status</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        >
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="disputed">Disputed</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="reversed">Reversed</option>
          <option value="paid">Paid</option>
        </select>
        <button onClick={load} className="ml-auto text-sm text-blue-600 hover:text-blue-800 inline-flex items-center gap-1">
          <RotateCcw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center"><LoadingSpinner /></div>
        ) : error ? (
          <div className="p-8 text-center text-red-600">{error}</div>
        ) : earnings.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No commission earnings match this filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <Th>Created</Th>
                  <Th>Source</Th>
                  <Th>Rule</Th>
                  <Th>Base</Th>
                  <Th>Rate</Th>
                  <Th>Commission</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {earnings.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <Td>{new Date(e.created_at).toLocaleDateString()}</Td>
                    <Td className="capitalize">{(e.source_type || '').replace(/_/g, ' ')}</Td>
                    <Td>{e.rule_name || '—'}</Td>
                    <Td>{formatCurrency(Number(e.base_amount || 0))}</Td>
                    <Td>{Number(e.rate || 0)}%</Td>
                    <Td className="font-semibold">{formatCurrency(Number(e.amount || 0))}</Td>
                    <Td>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[e.status] || 'bg-gray-100 text-gray-800'}`}>
                        {e.status}
                      </span>
                      {e.status === 'disputed' && e.dispute_reason && (
                        <div className="text-xs text-gray-500 mt-1 max-w-xs truncate" title={e.dispute_reason}>"{e.dispute_reason}"</div>
                      )}
                      {e.status === 'rejected' && e.rejection_reason && (
                        <div className="text-xs text-gray-500 mt-1 max-w-xs truncate" title={e.rejection_reason}>"{e.rejection_reason}"</div>
                      )}
                      {e.status === 'reversed' && e.reversal_reason && (
                        <div className="text-xs text-gray-500 mt-1 max-w-xs truncate" title={e.reversal_reason}>"{e.reversal_reason}"</div>
                      )}
                    </Td>
                    <Td>
                      {e.status === 'pending' ? (
                        <button
                          onClick={() => setDisputeTarget(e)}
                          className="text-orange-600 hover:text-orange-800 inline-flex items-center gap-1 text-sm"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" /> Dispute
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {disputeTarget && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-lg font-medium text-gray-900">Dispute commission</h3>
              <button onClick={() => { setDisputeTarget(null); setDisputeReason('') }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Disputing {formatCurrency(Number(disputeTarget.amount || 0))} earned on {new Date(disputeTarget.created_at).toLocaleDateString()}. A manager will review.
            </p>
            <textarea
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="Why is this commission incorrect?"
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 mb-4"
              rows={4}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setDisputeTarget(null); setDisputeReason('') }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={submitDispute}
                disabled={!disputeReason.trim() || submitting}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting…' : 'Submit dispute'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) {
  return (
    <div className={`rounded-lg p-4 ${tone}`}>
      <div className="flex items-center gap-2 text-sm font-medium opacity-80">{icon}{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  )
}
function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{children}</th>
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-sm text-gray-700 ${className}`}>{children}</td>
}
