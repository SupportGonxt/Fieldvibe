import { useEffect, useState } from 'react'
import { Loader2, CheckCircle2, AlertTriangle, Banknote, Trash2, RefreshCw, Link2, Unlink, Upload } from 'lucide-react'
import * as XLSX from 'xlsx'
import { apiClient } from '../../services/api.service'
import { useToast } from '../../components/ui/Toast'

// Back Office deposit ingest (deposit gate). Paste (or CSV-dump) the Goldrush-confirmed
// deposit IDs, preview the match (dry run), then upload. A deposit row is what makes a
// signup's deposit gate "count" — the incentive engine LEFT JOINs goldrush_deposits at
// compute time, so no promotion is needed for payout. The separate Reconcile action
// promotes provisional signups that now have a deposit to qualified (convenience only).

type Preview = { uploaded: number; matched: number; unmatched: string[] }
type Uploaded = Preview & { inserted: number; duplicates: number }
type DepositRow = {
  id: string
  goldrush_id: string
  deposit_date: string | null
  amount: number | null
  source_batch: string | null
  matched: boolean
  created_at: string | null
}

function whenLabel(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z')
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function BackOfficeDeposits() {
  const { toast } = useToast()
  const [text, setText] = useState('')
  const [batch, setBatch] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [uploaded, setUploaded] = useState<Uploaded | null>(null)
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<DepositRow[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [reconciling, setReconciling] = useState(false)

  function reset() {
    setPreview(null)
    setUploaded(null)
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      // Flatten every sheet to raw cell text, then pull 9-digit ids (same rule as the server).
      let dump = ''
      for (const name of wb.SheetNames) {
        dump += XLSX.utils.sheet_to_csv(wb.Sheets[name]) + '\n'
      }
      const ids = Array.from(dump.matchAll(/(?<!\d)\d{9}(?!\d)/g)).map((m) => m[0])
      const unique = Array.from(new Set(ids))
      if (!unique.length) { toast.error('No 9-digit Goldrush IDs found in that file'); return }
      setText((t) => (t.trim() ? t.trim() + '\n' : '') + unique.join('\n'))
      reset()
      toast.success(`${unique.length} ID${unique.length === 1 ? '' : 's'} loaded from ${file.name}`)
    } catch {
      toast.error('Could not read that file')
    }
  }

  async function loadList() {
    setLoadingList(true)
    try {
      const res = await apiClient.get('/field-ops/deposits?limit=200')
      setRows(res?.data?.deposits || [])
    } catch {
      toast.error('Could not load deposits')
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => { loadList() }, [])

  async function run(dryRun: boolean) {
    if (!text.trim()) { toast.error('Paste some Goldrush IDs first'); return }
    setBusy(true)
    try {
      const res = await apiClient.post('/field-ops/deposits', {
        csv: text,
        source_batch: batch.trim() || null,
        dry_run: dryRun,
      })
      const data = res?.data
      if (!data?.success) { toast.error(data?.error || 'No 9-digit IDs found'); return }
      if (dryRun) {
        setPreview(data)
        setUploaded(null)
      } else {
        setUploaded(data)
        toast.success(`${data.inserted} deposit${data.inserted === 1 ? '' : 's'} uploaded`)
        setText('')
        setPreview(null)
        loadList()
      }
    } catch {
      toast.error('Upload failed')
    } finally {
      setBusy(false)
    }
  }

  async function reconcile() {
    setReconciling(true)
    try {
      const res = await apiClient.post('/field-ops/deposits/reconcile', {})
      const n = res?.data?.qualified ?? 0
      toast.success(`${n} signup${n === 1 ? '' : 's'} qualified`)
    } catch {
      toast.error('Reconcile failed')
    } finally {
      setReconciling(false)
    }
  }

  async function remove(id: string) {
    try {
      await apiClient.delete(`/field-ops/deposits/${id}`)
      setRows((rs) => rs.filter((r) => r.id !== id))
    } catch {
      toast.error('Could not delete')
    }
  }

  const unmatchedCount = rows.filter((r) => !r.matched).length

  return (
    <div className="min-h-screen bg-bg px-4 pt-6 pb-24">
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-2 mb-1">
          <Banknote className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-token">Deposits</h1>
        </div>
        <p className="text-sm text-token-faint mb-5">
          Upload the Goldrush-confirmed deposit IDs. This clears the deposit gate — signups pay out once both gates are met.
        </p>

        <label className="flex items-center justify-center gap-2 w-full mb-3 bg-white/[0.04] border border-dashed border-white/15 rounded-2xl py-3 text-sm text-token-muted cursor-pointer active:scale-[0.99] transition-transform">
          <Upload className="w-4 h-4 text-primary" />
          Upload Excel / CSV file
          <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} className="hidden" />
        </label>

        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); reset() }}
          rows={7}
          placeholder={'123456789\n987654321\n… or paste a CSV export'}
          className="w-full bg-white/[0.04] border border-token rounded-2xl px-4 py-3.5 text-token text-base placeholder-gray-600 focus:outline-none focus:border-primary/50 font-mono resize-none"
        />

        <input
          value={batch}
          onChange={(e) => setBatch(e.target.value)}
          placeholder="Batch label (optional)"
          className="w-full mt-3 bg-white/[0.04] border border-token rounded-2xl px-4 py-3 text-token text-base placeholder-gray-600 focus:outline-none focus:border-primary/50"
        />

        <div className="flex gap-3 mt-4">
          <button
            onClick={() => run(true)}
            disabled={busy}
            className="flex-1 bg-white/[0.06] border border-token text-token rounded-2xl py-3.5 font-semibold active:scale-[0.99] transition-transform disabled:opacity-50"
          >
            {busy && !uploaded ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Preview'}
          </button>
          <button
            onClick={() => run(false)}
            disabled={busy || !preview}
            className="flex-1 bg-gradient-to-br from-primary to-[#00D06E] text-on-primary rounded-2xl py-3.5 font-semibold active:scale-[0.99] transition-transform disabled:opacity-40"
          >
            Upload deposits
          </button>
        </div>

        {preview && !uploaded && (
          <div className="mt-6 bg-white/[0.03] border border-token rounded-2xl p-4">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <div className="text-2xl font-bold text-token tabular-nums">{preview.uploaded}</div>
                <div className="text-xs text-token-faint mt-0.5">IDs uploaded</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary tabular-nums">{preview.matched}</div>
                <div className="text-xs text-token-faint mt-0.5">match a signup</div>
              </div>
            </div>
            <UnmatchedList ids={preview.unmatched} />
          </div>
        )}

        {uploaded && (
          <div className="mt-6 bg-primary/[0.06] border border-primary/20 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-primary font-semibold mb-3">
              <CheckCircle2 className="w-5 h-5" />
              {uploaded.inserted} deposit{uploaded.inserted === 1 ? '' : 's'} uploaded
            </div>
            <p className="text-sm text-token-muted">
              {uploaded.matched} of {uploaded.uploaded} matched a signup.
              {uploaded.duplicates > 0 && ` ${uploaded.duplicates} already on file.`}
            </p>
            <UnmatchedList ids={uploaded.unmatched} />
          </div>
        )}

        {/* Existing deposits */}
        <div className="flex items-center justify-between mt-8 mb-3">
          <h2 className="text-sm text-token-faint uppercase tracking-wide">On file</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={reconcile}
              disabled={reconciling}
              className="flex items-center gap-1.5 text-xs text-primary bg-primary/10 border border-primary/25 rounded-xl px-3 py-1.5 active:scale-95 transition-transform disabled:opacity-50"
            >
              {reconciling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardCheckIcon />}
              Qualify
            </button>
            <button
              onClick={loadList}
              className="p-2 rounded-xl bg-white/[0.04] border border-token active:scale-95 transition-transform"
              aria-label="Refresh"
            >
              <RefreshCw className={`w-4 h-4 text-token-muted ${loadingList ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {unmatchedCount > 0 && (
          <p className="text-xs text-amber-400 mb-3 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            {unmatchedCount} deposit{unmatchedCount === 1 ? '' : 's'} without a signup on file
          </p>
        )}

        {loadingList ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-center text-gray-600 py-12">No deposits uploaded yet.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 bg-white/[0.03] border border-token rounded-2xl px-4 py-3"
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${r.matched ? 'bg-primary/15 text-primary' : 'bg-amber-500/15 text-amber-400'}`}>
                  {r.matched ? <Link2 className="w-4 h-4" /> : <Unlink className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-token font-mono text-sm">{r.goldrush_id}</div>
                  <div className="text-[11px] text-token-faint mt-0.5">
                    {r.source_batch ? `${r.source_batch} · ` : ''}{whenLabel(r.created_at)}
                    {!r.matched && ' · no signup'}
                  </div>
                </div>
                {r.amount != null && (
                  <div className="text-sm text-token-muted tabular-nums shrink-0">R{r.amount}</div>
                )}
                <button
                  onClick={() => remove(r.id)}
                  className="p-2 rounded-xl text-gray-600 hover:text-red-400 active:scale-95 transition-transform shrink-0"
                  aria-label="Delete deposit"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Small inline icon so the Qualify button matches the reconcile screen without a new import line churn.
function ClipboardCheckIcon() {
  return <CheckCircle2 className="w-3.5 h-3.5" />
}

function UnmatchedList({ ids }: { ids: string[] }) {
  if (!ids.length) return null
  return (
    <div className="mt-4 pt-4 border-t border-token">
      <div className="flex items-center gap-1.5 text-amber-400 text-sm font-medium mb-2">
        <AlertTriangle className="w-4 h-4" />
        {ids.length} unmatched — no signup on file
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ids.map((id) => (
          <span key={id} className="text-xs font-mono text-token-muted bg-white/[0.04] rounded-lg px-2 py-1">{id}</span>
        ))}
      </div>
    </div>
  )
}
