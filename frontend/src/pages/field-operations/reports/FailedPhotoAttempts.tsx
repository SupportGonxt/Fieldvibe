import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { apiClient } from '../../../services/api.service'

// AI Check section: Goldrush visits flagged after three failed photo attempts.
// The agent is locked out of Goldrush photos until Back Office or the GM decides here:
// approve if the photo is real (the visit can then be submitted), reject if it is fake.
// This is the only place that shows why each attempt failed — the agent only ever saw
// the same three generic messages. Team Leads do not review.

interface Attempt {
  id: string
  created_at: string
  stage: string
  reasons: string[]
  detail: string | null
  extracted_id: string | null
  first_name: string | null
  last_name: string | null
  photo_url: string | null
}

interface Review {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  agent_name: string | null
  team_lead_name: string | null
  goldrush_id: string | null
  first_name: string | null
  last_name: string | null
  reviewed_by_name: string | null
  reviewed_at: string | null
  note: string | null
  attempts: Attempt[]
}

const FILTERS = [
  { key: 'pending', label: 'Waiting' },
  { key: 'approved', label: 'Approved — real' },
  { key: 'rejected', label: 'Rejected — fake' },
] as const

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }) : '—')

const ReviewCard: React.FC<{ review: Review; onPhoto: (url: string) => void }> = ({ review, onPhoto }) => {
  const queryClient = useQueryClient()
  const [goldrushId, setGoldrushId] = useState(review.goldrush_id || '')
  const [firstName, setFirstName] = useState(review.first_name || '')
  const [lastName, setLastName] = useState(review.last_name || '')
  const [note, setNote] = useState('')

  const decide = useMutation({
    mutationFn: async (decision: 'approve' | 'reject') =>
      (await apiClient.post(`/field-ops/photo-verification/reviews/${review.id}`, {
        decision, note, goldrush_id: goldrushId, first_name: firstName, last_name: lastName,
      })).data,
    onSuccess: (_d, decision) => {
      toast.success(decision === 'approve' ? 'Approved as real — the agent can submit this visit' : 'Rejected as fake — the agent must take a new photo')
      queryClient.invalidateQueries({ queryKey: ['photo-verification-reviews'] })
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(message || 'Could not save the decision. Try again.')
    },
  })

  const input = 'mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm normal-case dark:border-gray-600 dark:bg-gray-800'

  return (
    <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold text-gray-900 dark:text-white">{review.agent_name || 'Unknown agent'}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400">Locked {when(review.created_at)}</span>
      </div>
      {review.team_lead_name && <p className="text-xs text-gray-500 dark:text-gray-400">Team Lead: {review.team_lead_name}</p>}

      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {review.attempts.map((a, i) => (
          <div key={a.id} className="min-w-0 rounded border border-gray-200 p-2 dark:border-gray-700">
            {a.photo_url ? (
              <button onClick={() => onPhoto(a.photo_url as string)} className="block w-full focus-visible:outline focus-visible:outline-2" aria-label={`Open attempt ${i + 1} photo`}>
                <img src={a.photo_url} alt="" loading="lazy" className="h-40 w-full rounded object-cover object-top" />
              </button>
            ) : (
              <div className="flex h-40 items-center justify-center rounded bg-gray-100 text-xs text-gray-500 dark:bg-gray-800">No photo stored</div>
            )}
            <div className="mt-1.5 text-xs font-semibold text-gray-900 dark:text-white">
              Attempt {i + 1}{a.stage === 'submit' ? ' (at submit)' : ''} · {when(a.created_at)}
            </div>
            <ul className="mt-1 list-disc pl-4 text-xs text-red-700 dark:text-red-400">
              {a.reasons.map(r => <li key={r}>{r}</li>)}
            </ul>
            {a.detail && <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{a.detail}</p>}
            {(a.extracted_id || a.first_name || a.last_name) && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Read from photo: {[a.first_name, a.last_name].filter(Boolean).join(' ') || '—'}{a.extracted_id ? ` · ID ${a.extracted_id}` : ''}
              </p>
            )}
          </div>
        ))}
      </div>

      {review.status === 'pending' ? (
        <div className="mt-3 space-y-3 border-t border-gray-200 pt-3 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Approving accepts the <strong>last</strong> photo for this visit. Confirm the details it shows:
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
              Goldrush ID (9 digits)
              <input value={goldrushId} onChange={e => setGoldrushId(e.target.value.replace(/\D/g, '').slice(0, 9))} inputMode="numeric" className={input} />
            </label>
            <label className="block text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
              First name
              <input value={firstName} onChange={e => setFirstName(e.target.value)} className={input} />
            </label>
            <label className="block text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
              Surname
              <input value={lastName} onChange={e => setLastName(e.target.value)} className={input} />
            </label>
          </div>
          <label className="block text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
            Note (optional)
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} maxLength={500} className={input} placeholder="e.g. Checked the profile on the Goldrush portal" />
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              disabled={decide.isPending || goldrushId.length !== 9}
              onClick={() => decide.mutate('approve')}
              className="rounded-lg border border-green-700 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-50 dark:text-green-400 dark:hover:bg-green-950"
            >
              Approve — it&apos;s real
            </button>
            <button
              disabled={decide.isPending}
              onClick={() => decide.mutate('reject')}
              className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
            >
              Reject — it&apos;s fake
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 border-t border-gray-200 pt-3 text-sm dark:border-gray-700">
          <span className={`font-semibold ${review.status === 'approved' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
            {review.status === 'approved' ? 'Approved — real' : 'Rejected — fake'}
          </span>
          <span className="text-gray-500 dark:text-gray-400"> by {review.reviewed_by_name || 'unknown'} · {when(review.reviewed_at)}</span>
          {review.status === 'approved' && review.goldrush_id && (
            <span className="text-gray-500 dark:text-gray-400"> · Goldrush ID {review.goldrush_id}</span>
          )}
          {review.note && <p className="mt-1 text-gray-600 dark:text-gray-300">{review.note}</p>}
        </div>
      )}
    </div>
  )
}

const FailedPhotoAttempts: React.FC<{ startDate: string; endDate: string; onPhoto: (url: string) => void }> = ({ startDate, endDate, onPhoto }) => {
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['photo-verification-reviews', status, startDate, endDate],
    queryFn: async () => (await apiClient.get(`/field-ops/photo-verification/reviews?status=${status}&start=${startDate}&end=${endDate}`)).data as { reviews: Review[] },
    staleTime: 30000,
  })

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <h2 className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">Visits flagged after 3 failed photo attempts</h2>
      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
        The agent cannot take another photo for the visit until it is decided here. Approve if the photo is real, reject if it is fake.
        Waiting visits are always listed; decided ones follow the period above.
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setStatus(f.key)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${status === f.key
              ? 'border-red-700 bg-red-700 text-white'
              : 'border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300'}`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {isLoading ? <p className="text-sm text-gray-500">Loading…</p>
        : isError || !data ? <p className="text-sm text-red-700 dark:text-red-400">Could not load these visits. Try Refresh.</p>
        : data.reviews.length === 0 ? <p className="text-sm text-gray-500">{status === 'pending' ? 'Nothing waiting for a decision.' : 'None in this period.'}</p>
        : <div className="space-y-3">{data.reviews.map(r => <ReviewCard key={r.id} review={r} onPhoto={onPhoto} />)}</div>}
    </section>
  )
}

export default FailedPhotoAttempts
