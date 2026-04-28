import { useEffect, useMemo, useState } from 'react'
import { commissionsService } from '../../services/commissions.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'
import { CheckCircle2, RotateCcw, X, AlertOctagon } from 'lucide-react'

interface Earning {
  id: string
  earner_id: string
  earner_name?: string | null
  source_type: string
  source_id: string | null
  rate: number
  base_amount: number
  amount: number
  status: string
  dispute_reason?: string | null
  disputed_at?: string | null
  rejection_reason?: string | null
  reversal_reason?: string | null
  rule_name?: string | null
  created_at: string
}

const TABS: Array<{ key: 'disputed' | 'approved' | 'paid'; label: string }> = [
  { key: 'disputed', label: 'Disputed' },
  { key: 'approved', label: 'Approved' },
  { key: 'paid', label: 'Paid' },
]

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount || 0)
}

export default function CommissionDisputesPage() {
  const [tab, setTab] = useState<'disputed' | 'approved' | 'paid'>('disputed')
  const [rows, setRows] = useState<Earning[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionTarget, setActionTarget] = useState<{ row: Earning; action: 'reject' | 'reverse' } | null>(null)
  const [reason, setReason] = useState('')
  const [working, setWorking] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const { earnings } = await commissionsService.listCommissionEarnings({ status: tab, limit: 200 })
      setRows(earnings as Earning[])
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load earnings')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [tab])

  const summary = useMemo(() => {
    const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0)
    return { count: rows.length, total }
  }, [rows])

  const onApprove = async (row: Earning) => {
    if (!confirm(`Approve ${formatCurrency(Number(row.amount))} for ${row.earner_name || row.earner_id}?`)) return
    setWorking(true)
    try {
      await commissionsService.approveCommissionEarning(row.id)
      toast.success('Approved')
      await load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to approve')
    } finally {
      setWorking(false)
    }
  }

  const submitAction = async () => {
    if (!actionTarget || !reason.trim()) return
    setWorking(true)
    try {
      if (actionTarget.action === 'reject') {
        await commissionsService.rejectCommissionEarning(actionTarget.row.id, reason.trim())
        toast.success('Rejected')
      } else {
        await commissionsService.reverseCommissionEarning(actionTarget.row.id, reason.trim())
        toast.success('Reversed')
      }
      setActionTarget(null)
      setReason('')
      await load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || `Failed to ${actionTarget.action}`)
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Commission Disputes & Reversals</h1>
        <p className="text-sm text-gray-500 mt-1">
          Review disputed earnings, approve or reject them, and reverse approved earnings if needed.
        </p>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap py-2 px-1 border-b-2 text-sm font-medium ${
                tab === t.key
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="bg-blue-50 text-blue-800 rounded-lg p-3 flex items-center justify-between">
        <span className="text-sm">
          <strong>{summary.count}</strong> {tab} earnings • <strong>{formatCurrency(summary.total)}</strong> in total
        </span>
        <button onClick={load} className="text-blue-700 hover:text-blue-900 text-sm inline-flex items-center gap-1">
          <RotateCcw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center"><LoadingSpinner /></div>
        ) : error ? (
          <div className="p-8 text-center text-red-600">{error}</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <AlertOctagon className="w-10 h-10 mx-auto mb-3 text-gray-400" />
            No {tab} earnings.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <Th>Created</Th>
                  <Th>Agent</Th>
                  <Th>Source</Th>
                  <Th>Rule</Th>
                  <Th>Base</Th>
                  <Th>Rate</Th>
                  <Th>Commission</Th>
                  {tab === 'disputed' && <Th>Reason</Th>}
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <Td>{new Date(row.created_at).toLocaleDateString()}</Td>
                    <Td>{row.earner_name || row.earner_id}</Td>
                    <Td className="capitalize">{(row.source_type || '').replace(/_/g, ' ')}</Td>
                    <Td>{row.rule_name || '—'}</Td>
                    <Td>{formatCurrency(Number(row.base_amount || 0))}</Td>
                    <Td>{Number(row.rate || 0)}%</Td>
                    <Td className="font-semibold">{formatCurrency(Number(row.amount || 0))}</Td>
                    {tab === 'disputed' && (
                      <Td className="max-w-xs">
                        <span className="text-gray-700" title={row.dispute_reason || ''}>
                          {row.dispute_reason || '—'}
                        </span>
                      </Td>
                    )}
                    <Td>
                      <div className="flex gap-2 flex-wrap">
                        {tab === 'disputed' && (
                          <>
                            <button
                              onClick={() => onApprove(row)}
                              disabled={working}
                              className="text-green-700 hover:text-green-900 inline-flex items-center gap-1 text-sm"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                            </button>
                            <button
                              onClick={() => { setActionTarget({ row, action: 'reject' }); setReason('') }}
                              disabled={working}
                              className="text-red-700 hover:text-red-900 inline-flex items-center gap-1 text-sm"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {(tab === 'approved' || tab === 'paid') && (
                          <button
                            onClick={() => { setActionTarget({ row, action: 'reverse' }); setReason('') }}
                            disabled={working}
                            className="text-amber-700 hover:text-amber-900 inline-flex items-center gap-1 text-sm"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Reverse
                          </button>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {actionTarget && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-lg font-medium text-gray-900">
                {actionTarget.action === 'reject' ? 'Reject earning' : 'Reverse earning'}
              </h3>
              <button onClick={() => { setActionTarget(null); setReason('') }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              {actionTarget.action === 'reject'
                ? `Rejecting ${formatCurrency(Number(actionTarget.row.amount || 0))} for ${actionTarget.row.earner_name || actionTarget.row.earner_id}. The agent will see the reason.`
                : `Reversing ${formatCurrency(Number(actionTarget.row.amount || 0))} for ${actionTarget.row.earner_name || actionTarget.row.earner_id}. A sibling negative-amount row will be created so the audit trail is preserved.`}
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (required)"
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 mb-4"
              rows={4}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setActionTarget(null); setReason('') }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={submitAction}
                disabled={!reason.trim() || working}
                className={`px-4 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                  actionTarget.action === 'reject' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {working ? 'Working…' : actionTarget.action === 'reject' ? 'Reject' : 'Reverse'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{children}</th>
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-sm text-gray-700 ${className}`}>{children}</td>
}
