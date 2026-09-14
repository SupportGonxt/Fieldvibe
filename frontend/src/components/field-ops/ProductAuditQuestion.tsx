import { useState } from 'react'
import {
  Box, Typography, Button, TextField, FormControl, InputLabel, Select, MenuItem,
  IconButton, Chip, Divider, FormHelperText,
} from '@mui/material'
import { Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material'

export interface ProductAuditEntry {
  product: string
  stock: 'Yes' | 'No'
  why_not: string
  similar: string
  reps: 'Yes' | 'No' | ''
  reps_why_not: string
  delivery: 'Yes' | 'No' | ''
  delivery_source: string
  comments: string
}

const EMPTY_DRAFT: Omit<ProductAuditEntry, 'stock'> & { stock: 'Yes' | 'No' | '' } = {
  product: '', stock: '', why_not: '', similar: '', reps: '', reps_why_not: '', delivery: '', delivery_source: '', comments: '',
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

function YesNoToggle({ label, value, onChange }: { label: string; value: 'Yes' | 'No' | ''; onChange: (v: 'Yes' | 'No') => void }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="body2" sx={{ mb: 0.5 }}>{label}</Typography>
      <Box sx={{ display: 'flex', gap: 1 }}>
        {(['Yes', 'No'] as const).map(opt => (
          <Button
            key={opt}
            size="small"
            variant={value === opt ? 'contained' : 'outlined'}
            color={value === opt ? (opt === 'Yes' ? 'success' : 'error') : 'inherit'}
            onClick={() => onChange(opt)}
          >
            {opt}
          </Button>
        ))}
      </Box>
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

// A single custom question whose answer is a growing list of per-product audits.
// Replaces authoring one static question per product (an unmanageable wall of
// nearly-identical fields) with one dropdown + a fixed set of follow-up
// questions the agent fills in per product, one at a time.
export default function ProductAuditQuestion({ label, products, required, value, onChange, showValidation }: ProductAuditQuestionProps) {
  const entries = parseEntries(value)
  const [draft, setDraft] = useState(EMPTY_DRAFT)

  const addedProducts = new Set(entries.map(e => e.product))
  const availableProducts = products.filter(p => !addedProducts.has(p))

  // Every question for the current product must be answered before it can be
  // added — conditional follow-ups only count when their trigger question is No.
  const whyNotOk = draft.stock !== 'No' || !!draft.why_not.trim()
  const similarOk = draft.stock !== 'No' || !!draft.similar.trim()
  const repsWhyNotOk = draft.reps !== 'No' || !!draft.reps_why_not.trim()
  const deliverySourceOk = draft.delivery !== 'No' || !!draft.delivery_source.trim()
  const canAdd = !!draft.product && !!draft.stock && !!draft.reps && !!draft.delivery
    && whyNotOk && similarOk && repsWhyNotOk && deliverySourceOk && !!draft.comments.trim()

  const handleAdd = () => {
    if (!canAdd) return
    const entry: ProductAuditEntry = {
      product: draft.product,
      stock: draft.stock as 'Yes' | 'No',
      why_not: draft.stock === 'No' ? draft.why_not : '',
      similar: draft.stock === 'No' ? draft.similar : '',
      reps: draft.reps,
      reps_why_not: draft.reps === 'No' ? draft.reps_why_not : '',
      delivery: draft.delivery,
      delivery_source: draft.delivery === 'No' ? draft.delivery_source : '',
      comments: draft.comments,
    }
    onChange(JSON.stringify([...entries, entry]))
    setDraft(EMPTY_DRAFT)
  }

  const handleRemove = (product: string) => {
    onChange(JSON.stringify(entries.filter(e => e.product !== product)))
  }

  const missingRequired = !!required && entries.length < products.length

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="body1" fontWeight="bold" sx={{ mb: 1 }}>
        {label}{required ? ' *' : ''}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
        {entries.length} of {products.length} products added
      </Typography>
      {showValidation && missingRequired && (
        <FormHelperText error sx={{ mb: 1 }}>All {products.length} products must be added — {products.length - entries.length} remaining</FormHelperText>
      )}

      {entries.length > 0 && (
        <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {entries.map(e => (
            <Box key={e.product} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Typography variant="body2" sx={{ flex: 1 }}>{e.product}</Typography>
              <Chip size="small" label={`Stock: ${e.stock}`} color={e.stock === 'Yes' ? 'success' : 'error'} />
              <IconButton size="small" onClick={() => handleRemove(e.product)} aria-label={`Remove ${e.product}`}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
        </Box>
      )}

      {availableProducts.length === 0 ? (
        <Typography variant="body2" color="text.secondary">All products have been added.</Typography>
      ) : (
        <Box sx={{ p: 2, border: '1px dashed', borderColor: 'divider', borderRadius: 1 }}>
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Product</InputLabel>
            <Select
              label="Product"
              value={draft.product}
              onChange={(e) => setDraft({ ...EMPTY_DRAFT, product: e.target.value })}
            >
              {availableProducts.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
            </Select>
          </FormControl>

          {draft.product && (
            <>
              <YesNoToggle label="Do you currently stock this product? *" value={draft.stock} onChange={(v) => setDraft(d => ({ ...d, stock: v }))} />

              {draft.stock === 'No' && (
                <>
                  <TextField
                    fullWidth multiline required rows={2} size="small" sx={{ mb: 2 }}
                    label="If No, why not?"
                    value={draft.why_not}
                    onChange={(e) => setDraft(d => ({ ...d, why_not: e.target.value }))}
                  />
                  <TextField
                    fullWidth multiline required rows={2} size="small" sx={{ mb: 2 }}
                    label="What similar product do you stock instead?"
                    value={draft.similar}
                    onChange={(e) => setDraft(d => ({ ...d, similar: e.target.value }))}
                  />
                </>
              )}

              <YesNoToggle label="Does a rep visit you for this product? *" value={draft.reps} onChange={(v) => setDraft(d => ({ ...d, reps: v }))} />

              {draft.reps === 'No' && (
                <TextField
                  fullWidth multiline required rows={2} size="small" sx={{ mb: 2 }}
                  label="If No, why doesn't a rep visit you?"
                  value={draft.reps_why_not}
                  onChange={(e) => setDraft(d => ({ ...d, reps_why_not: e.target.value }))}
                />
              )}

              <YesNoToggle label="Do you get delivery for this product? *" value={draft.delivery} onChange={(v) => setDraft(d => ({ ...d, delivery: v }))} />

              {draft.delivery === 'No' && (
                <TextField
                  fullWidth multiline required rows={2} size="small" sx={{ mb: 2 }}
                  label="If No delivery, where do you get stock from?"
                  value={draft.delivery_source}
                  onChange={(e) => setDraft(d => ({ ...d, delivery_source: e.target.value }))}
                />
              )}

              <TextField
                fullWidth multiline required rows={2} size="small" sx={{ mb: 2 }}
                label="Other comments *"
                value={draft.comments}
                onChange={(e) => setDraft(d => ({ ...d, comments: e.target.value }))}
              />

              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Button variant="outlined" size="small" onClick={() => setDraft(EMPTY_DRAFT)}>Cancel</Button>
                <Button variant="contained" size="small" startIcon={<AddIcon />} disabled={!canAdd} onClick={handleAdd}>
                  Add Product
                </Button>
                {!canAdd && (
                  <Typography variant="caption" color="text.secondary">Answer every question above to add this product</Typography>
                )}
              </Box>
            </>
          )}
        </Box>
      )}
    </Box>
  )
}
