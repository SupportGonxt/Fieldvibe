import { useState } from 'react'
import { Loader2, CheckCircle2, AlertTriangle, ClipboardCheck } from 'lucide-react'
import { apiClient } from '../../services/api.service'
import { useToast } from '../../components/ui/Toast'
import { MyIssues } from '../../components/field-ops/IssueQueue'

// Back Office reconciliation: paste (or CSV-dump) the Goldrush-confirmed 9-digit IDs,
// preview what matches (dry run), then commit to promote those signups
// provisional -> qualified. No clawback — the server only ever promotes.

type Preview = { uploaded: number; matched: number; unmatched: string[] }
type Committed = Preview & { qualified: number }

export default function BackOfficeReconcile() {
  const { toast } = useToast()
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [committed, setCommitted] = useState<Committed | null>(null)
  const [busy, setBusy] = useState(false)

  function reset() {
    setPreview(null)
    setCommitted(null)
  }

  async function run(dryRun: boolean) {
    if (!text.trim()) { toast.error('Paste some Goldrush IDs first'); return }
    setBusy(true)
    try {
      const res = await apiClient.post('/field-ops/incentives/reconcile', { csv: text, dry_run: dryRun })
      const data = res?.data
      if (!data?.success) { toast.error(data?.error || 'No 9-digit IDs found'); return }
      if (dryRun) {
        setPreview(data)
        setCommitted(null)
      } else {
        setCommitted(data)
        toast.success(`${data.qualified} signup${data.qualified === 1 ? '' : 's'} qualified`)
      }
    } catch {
      toast.error('Reconciliation failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#06090F] px-4 pt-6 pb-24">
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-2 mb-1">
          <ClipboardCheck className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-white">Reconcile</h1>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          Paste the Goldrush-confirmed IDs. Preview the match, then confirm to qualify those signups for payout.
        </p>

        {/* Reconcile is the back office's home screen, so anything the cron routes to them lands here.
            ponytail: nothing assigns BO admins an issue yet — reactToIssues only emits field-performance
            signals — so this stays hidden until a backlog-aging detector exists. */}
        <div className="mb-5 empty:hidden">
          <MyIssues surface="pwa" />
        </div>

        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); reset() }}
          rows={8}
          placeholder={'123456789\n987654321\n… or paste a CSV export'}
          className="w-full bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-3.5 text-white text-base placeholder-gray-600 focus:outline-none focus:border-primary/50 font-mono resize-none"
        />

        <div className="flex gap-3 mt-4">
          <button
            onClick={() => run(true)}
            disabled={busy}
            className="flex-1 bg-white/[0.06] border border-white/10 text-white rounded-2xl py-3.5 font-semibold active:scale-[0.99] transition-transform disabled:opacity-50"
          >
            {busy && !committed ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Preview'}
          </button>
          <button
            onClick={() => run(false)}
            disabled={busy || !preview || preview.matched === 0}
            className="flex-1 bg-gradient-to-br from-primary to-[#00D06E] text-[#0A1628] rounded-2xl py-3.5 font-semibold active:scale-[0.99] transition-transform disabled:opacity-40"
          >
            Confirm & qualify
          </button>
        </div>

        {preview && !committed && (
          <div className="mt-6 bg-white/[0.03] border border-white/10 rounded-2xl p-4">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <div className="text-2xl font-bold text-white tabular-nums">{preview.uploaded}</div>
                <div className="text-xs text-gray-500 mt-0.5">IDs uploaded</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary tabular-nums">{preview.matched}</div>
                <div className="text-xs text-gray-500 mt-0.5">match a signup</div>
              </div>
            </div>
            {preview.matched > 0 && (
              <p className="text-sm text-gray-400 mt-4 text-center">
                Confirm to qualify {preview.matched} signup{preview.matched === 1 ? '' : 's'} for payout.
              </p>
            )}
            <UnmatchedList ids={preview.unmatched} />
          </div>
        )}

        {committed && (
          <div className="mt-6 bg-primary/[0.06] border border-primary/20 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-primary font-semibold mb-3">
              <CheckCircle2 className="w-5 h-5" />
              {committed.qualified} signup{committed.qualified === 1 ? '' : 's'} qualified
            </div>
            <p className="text-sm text-gray-400">
              {committed.matched} of {committed.uploaded} uploaded IDs matched a signup.
              Already-qualified rows were left as-is (no clawback).
            </p>
            <UnmatchedList ids={committed.unmatched} />
          </div>
        )}
      </div>
    </div>
  )
}

function UnmatchedList({ ids }: { ids: string[] }) {
  if (!ids.length) return null
  return (
    <div className="mt-4 pt-4 border-t border-white/10">
      <div className="flex items-center gap-1.5 text-amber-400 text-sm font-medium mb-2">
        <AlertTriangle className="w-4 h-4" />
        {ids.length} unmatched — no signup on file
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ids.map((id) => (
          <span key={id} className="text-xs font-mono text-gray-400 bg-white/[0.04] rounded-lg px-2 py-1">{id}</span>
        ))}
      </div>
    </div>
  )
}
