import { useEffect, useRef, useState } from 'react'
import {
  Box, Typography, Button, TextField, LinearProgress, Chip, Divider, FormHelperText, Alert,
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon, ArrowForward as ArrowForwardIcon,
  CheckCircle as CheckCircleIcon, Edit as EditIcon, PhotoCamera as PhotoCameraIcon,
} from '@mui/icons-material'
import { compressDataUrl } from '../../utils/photo-compression'

export interface ProductAuditEntry {
  product: string
  stock: 'Yes' | 'No'
  why_not: string
  similar: string
  reps: 'Yes' | 'No' | ''
  reps_why_not: string
  delivery: 'Yes' | 'No' | ''
  delivery_source: string
  challenge: string
  // Captured as a data URI; the API swaps it for an R2 URL on submit, so a
  // stored answer read back from a report holds a URL here, not base64.
  photo: string
  comments: string
}

// What the agent has typed for one product. The product name isn't part of the
// draft — it comes from the page the agent is on, not from a picker.
interface Draft {
  stock: 'Yes' | 'No' | ''
  why_not: string
  // No longer asked — an out-of-stock product's only follow-up is the why_not
  // comment box. Kept so a restored draft (and the report/export column that
  // reads it) carries any value captured before the question was dropped.
  similar: string
  reps: 'Yes' | 'No' | ''
  reps_why_not: string
  delivery: 'Yes' | 'No' | ''
  delivery_source: string
  challenge: string
  photo: string
  comments: string
}

const EMPTY_DRAFT: Draft = {
  stock: '', why_not: '', similar: '', reps: '', reps_why_not: '', delivery: '',
  delivery_source: '', challenge: '', photo: '', comments: '',
}

function parseEntries(value: string | undefined): ProductAuditEntry[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// Rebuild the per-product drafts from the stored answer so a page the agent
// walks back to (or a restored draft visit) shows what was already captured.
function hydrateDrafts(value: string | undefined): Record<string, Draft> {
  const out: Record<string, Draft> = {}
  for (const e of parseEntries(value)) {
    if (!e || typeof e.product !== 'string') continue
    out[e.product] = {
      stock: e.stock === 'Yes' || e.stock === 'No' ? e.stock : '',
      why_not: e.why_not || '',
      similar: e.similar || '',
      reps: e.reps === 'Yes' || e.reps === 'No' ? e.reps : '',
      reps_why_not: e.reps_why_not || '',
      delivery: e.delivery === 'Yes' || e.delivery === 'No' ? e.delivery : '',
      delivery_source: e.delivery_source || '',
      challenge: e.challenge || '',
      photo: e.photo || '',
      comments: e.comments || '',
    }
  }
  return out
}

// A product only counts once every question on its page is answered. The page
// forks on the stock answer: an out-of-stock product only owes the "why" comment,
// while a stocked one owes the rep / delivery / challenge / photo follow-ups —
// and the nested comment boxes only count when their own trigger answer is No.
function isDraftComplete(d: Draft | undefined): boolean {
  if (!d) return false
  if (!d.stock) return false
  if (d.stock === 'No') return !!d.why_not.trim()
  if (!d.reps || !d.delivery) return false
  if (d.reps === 'No' && !d.reps_why_not.trim()) return false
  if (d.delivery === 'No' && !d.delivery_source.trim()) return false
  if (!d.challenge.trim()) return false
  if (!d.photo) return false
  return true
}

function toEntry(product: string, d: Draft): ProductAuditEntry {
  const inStock = d.stock === 'Yes'
  return {
    product,
    stock: d.stock as 'Yes' | 'No',
    why_not: inStock ? '' : d.why_not,
    similar: inStock ? '' : d.similar,
    reps: inStock ? d.reps : '',
    reps_why_not: inStock && d.reps === 'No' ? d.reps_why_not : '',
    delivery: inStock ? d.delivery : '',
    delivery_source: inStock && d.delivery === 'No' ? d.delivery_source : '',
    challenge: inStock ? d.challenge : '',
    photo: inStock ? d.photo : '',
    comments: d.comments,
  }
}

function YesNoToggle({ label, value, onChange, error }: {
  label: string
  value: 'Yes' | 'No' | ''
  onChange: (v: 'Yes' | 'No') => void
  error?: boolean
}) {
  return (
    <Box sx={{ mb: 2.5 }}>
      <Typography variant="body2" color={error ? 'error' : 'text.primary'} sx={{ mb: 0.75 }}>{label}</Typography>
      <Box sx={{ display: 'flex', gap: 1 }}>
        {(['Yes', 'No'] as const).map(opt => (
          <Button
            key={opt}
            fullWidth
            variant={value === opt ? 'contained' : 'outlined'}
            color={value === opt ? (opt === 'Yes' ? 'success' : 'error') : error ? 'error' : 'inherit'}
            onClick={() => onChange(opt)}
          >
            {opt}
          </Button>
        ))}
      </Box>
      {error && <FormHelperText error>Please choose Yes or No</FormHelperText>}
    </Box>
  )
}

// Photo proof for one product. Compressed on capture because several of these
// ride along inside a single questionnaire answer — the API offloads them to R2
// on submit, but the request itself still has to carry them.
function ProductPhotoField({ value, onChange, error }: {
  value: string
  onChange: (dataUrl: string) => void
  error?: boolean
}) {
  const [busy, setBusy] = useState(false)

  const handleFile = (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        onChange(await compressDataUrl(reader.result as string))
      } finally {
        setBusy(false)
      }
    }
    reader.onerror = () => setBusy(false)
    reader.readAsDataURL(file)
  }

  return (
    <Box sx={{ mb: 2.5 }}>
      <Typography variant="body2" color={error ? 'error' : 'text.primary'} sx={{ mb: 0.75 }}>
        Please upload a photo of the product *
      </Typography>
      {value ? (
        <Box sx={{ position: 'relative', display: 'inline-block' }}>
          <img src={value} alt="Product" style={{ maxWidth: 200, maxHeight: 200, borderRadius: 8, display: 'block' }} />
          <Button size="small" color="error" onClick={() => onChange('')} sx={{ position: 'absolute', top: 0, right: 0 }}>
            Remove
          </Button>
        </Box>
      ) : (
        <Button variant="outlined" component="label" color={error ? 'error' : 'primary'} startIcon={<PhotoCameraIcon />} disabled={busy}>
          {busy ? 'Processing…' : 'Take / upload photo'}
          <input
            type="file" hidden accept="image/*" capture="environment"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </Button>
      )}
      {error && <FormHelperText error>A photo of the product is required</FormHelperText>}
    </Box>
  )
}

interface ProductAuditQuestionProps {
  label: string
  products: string[]
  required?: boolean
  value: string | undefined
  onChange: (value: string) => void
  showValidation?: boolean
}

// A single custom question that covers every product in the company's list.
// Each product gets its own page — no picker to choose from, no wall of
// near-identical fields — with a progress bar showing how much of the audit is
// left. The stored answer stays a JSON array of per-product entries (reports and
// the CSV export read it unchanged); only products whose page is fully answered
// are written into it.
export default function ProductAuditQuestion({ label, products, required, value, onChange, showValidation }: ProductAuditQuestionProps) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => hydrateDrafts(value))
  const [index, setIndex] = useState(() => {
    const hydrated = hydrateDrafts(value)
    const next = products.findIndex(p => !isDraftComplete(hydrated[p]))
    return next === -1 ? 0 : next
  })
  // Everything already captured on mount (a resumed visit) opens on the summary
  // instead of dropping the agent back onto the first product page.
  const [showSummary, setShowSummary] = useState(() => {
    const hydrated = hydrateDrafts(value)
    return products.length > 0 && products.every(p => isDraftComplete(hydrated[p]))
  })
  const [triedNext, setTriedNext] = useState(false)

  // The photo write lands after compression has finished, by which time the agent
  // may have typed into another field — so edits merge onto the latest drafts
  // from this ref, never onto the snapshot the handler closed over.
  const draftsRef = useRef(drafts)

  // Re-hydrate only when the answer changed outside this component (a reset or a
  // restored draft) — our own emissions must not clobber what is being typed.
  const emittedRef = useRef<string | undefined>(value)
  useEffect(() => {
    if (value === emittedRef.current) return
    emittedRef.current = value
    const hydrated = hydrateDrafts(value)
    draftsRef.current = hydrated
    setDrafts(hydrated)
  }, [value])

  const total = products.length
  const completedCount = products.filter(p => isDraftComplete(drafts[p])).length
  const allComplete = total > 0 && completedCount === total
  const safeIndex = Math.min(index, Math.max(total - 1, 0))
  const product = products[safeIndex]
  const current = drafts[product] ?? EMPTY_DRAFT
  const currentComplete = isDraftComplete(drafts[product])
  const showErr = triedNext || !!showValidation

  const commit = (next: Record<string, Draft>) => {
    const entries = products.filter(p => isDraftComplete(next[p])).map(p => toEntry(p, next[p]))
    const json = JSON.stringify(entries)
    emittedRef.current = json
    onChange(json)
  }

  const update = (patch: Partial<Draft>) => {
    const base = draftsRef.current
    const next = { ...base, [product]: { ...(base[product] ?? EMPTY_DRAFT), ...patch } }
    draftsRef.current = next
    setDrafts(next)
    commit(next)
  }

  const goTo = (i: number) => {
    setShowSummary(false)
    setTriedNext(false)
    setIndex(Math.max(0, Math.min(i, total - 1)))
  }

  const handleNext = () => {
    if (!currentComplete) { setTriedNext(true); return }
    if (safeIndex < total - 1) { goTo(safeIndex + 1); return }
    // Last page: pick up any product left unanswered earlier before finishing.
    const firstIncomplete = products.findIndex(p => !isDraftComplete(drafts[p]))
    if (firstIncomplete >= 0) { goTo(firstIncomplete); return }
    setTriedNext(false)
    setShowSummary(true)
  }

  if (total === 0) {
    return (
      <Box sx={{ mb: 3 }}>
        <Typography variant="body1" fontWeight="bold" sx={{ mb: 1 }}>{label}{required ? ' *' : ''}</Typography>
        <Alert severity="warning">No products are configured for this question.</Alert>
      </Box>
    )
  }

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="body1" fontWeight="bold" sx={{ mb: 1 }}>
        {label}{required ? ' *' : ''}
      </Typography>

      {/* Progress across the whole product list */}
      <Box sx={{ mb: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            {showSummary ? 'All products' : `Product ${safeIndex + 1} of ${total}`}
          </Typography>
          <Typography variant="caption" color={allComplete ? 'success.main' : 'text.secondary'}>
            {completedCount} of {total} completed
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={(completedCount / total) * 100}
          color={allComplete ? 'success' : 'primary'}
          sx={{ height: 8, borderRadius: 4 }}
        />
      </Box>

      {showValidation && required && !allComplete && (
        <FormHelperText error sx={{ mb: 1.5 }}>
          All {total} products must be answered — {total - completedCount} remaining
        </FormHelperText>
      )}

      {showSummary ? (
        <Box>
          <Alert severity="success" sx={{ mb: 2 }}>All {total} products captured.</Alert>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {products.map((p, i) => (
              <Box key={p} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                {drafts[p]?.photo && (
                  <img src={drafts[p].photo} alt={p} style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4 }} />
                )}
                <Typography variant="body2" sx={{ flex: 1 }}>{p}</Typography>
                <Chip size="small" label={`Stock: ${drafts[p]?.stock || '—'}`} color={drafts[p]?.stock === 'Yes' ? 'success' : 'error'} />
                <Button size="small" startIcon={<EditIcon fontSize="small" />} onClick={() => goTo(i)}>Edit</Button>
              </Box>
            ))}
          </Box>
        </Box>
      ) : (
        <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ flex: 1 }}>{product}</Typography>
            {currentComplete && <Chip size="small" color="success" label="Answered" icon={<CheckCircleIcon fontSize="small" />} />}
          </Box>
          <Divider sx={{ mb: 2 }} />

          <YesNoToggle
            label="Do you currently stock this product? *"
            value={current.stock}
            onChange={(v) => update({ stock: v })}
            error={showErr && !current.stock}
          />

          {/* Out of stock: the only follow-up is why the product isn't there */}
          {current.stock === 'No' && (
            <TextField
              fullWidth multiline required rows={3} size="small" sx={{ mb: 2 }}
              label="Why is this product not in the store? *"
              placeholder="Explain why the store does not stock this product"
              value={current.why_not}
              onChange={(e) => update({ why_not: e.target.value })}
              error={showErr && !current.why_not.trim()}
              helperText={showErr && !current.why_not.trim() ? 'Please explain why the product is not there' : undefined}
            />
          )}

          {/* In stock: rep visits, deliveries, the biggest challenge, and proof */}
          {current.stock === 'Yes' && (
            <>
              <YesNoToggle
                label="Do reps come and visit the store for this product? *"
                value={current.reps}
                onChange={(v) => update({ reps: v })}
                error={showErr && !current.reps}
              />

              {current.reps === 'No' && (
                <TextField
                  fullWidth multiline required rows={2} size="small" sx={{ mb: 2 }}
                  label="If No, why does a rep not visit you?"
                  value={current.reps_why_not}
                  onChange={(e) => update({ reps_why_not: e.target.value })}
                  error={showErr && !current.reps_why_not.trim()}
                />
              )}

              <YesNoToggle
                label="Do they do deliveries for this product? *"
                value={current.delivery}
                onChange={(v) => update({ delivery: v })}
                error={showErr && !current.delivery}
              />

              {current.delivery === 'No' && (
                <TextField
                  fullWidth multiline required rows={2} size="small" sx={{ mb: 2 }}
                  label="If No delivery, where do you get stock from?"
                  value={current.delivery_source}
                  onChange={(e) => update({ delivery_source: e.target.value })}
                  error={showErr && !current.delivery_source.trim()}
                />
              )}

              <TextField
                fullWidth multiline required rows={3} size="small" sx={{ mb: 2 }}
                label="What is the biggest challenge with this product? *"
                placeholder="e.g. price, shelf space, supply, competitor pressure"
                value={current.challenge}
                onChange={(e) => update({ challenge: e.target.value })}
                error={showErr && !current.challenge.trim()}
                helperText={showErr && !current.challenge.trim() ? 'Please describe the biggest challenge' : undefined}
              />

              <ProductPhotoField
                value={current.photo}
                onChange={(photo) => update({ photo })}
                error={showErr && !current.photo}
              />
            </>
          )}

          <TextField
            fullWidth multiline rows={2} size="small" sx={{ mb: 2 }}
            label="Other comments"
            value={current.comments}
            onChange={(e) => update({ comments: e.target.value })}
          />

          <Divider sx={{ mb: 2 }} />
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              disabled={safeIndex === 0}
              onClick={() => goTo(safeIndex - 1)}
            >
              Back
            </Button>
            <Box sx={{ flex: 1 }} />
            {allComplete && (
              <Button size="small" onClick={() => { setTriedNext(false); setShowSummary(true) }}>Review all</Button>
            )}
            <Button variant="contained" endIcon={<ArrowForwardIcon />} onClick={handleNext}>
              {safeIndex < total - 1 ? 'Next product' : 'Finish'}
            </Button>
          </Box>
          {showErr && !currentComplete && (
            <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
              Answer every question on this page before moving on
            </Typography>
          )}
        </Box>
      )}
    </Box>
  )
}
