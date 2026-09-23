import { Alert, Box, Card, CardContent, Chip, LinearProgress, TextField, Typography } from '@mui/material'
import YesNoToggle from './YesNoToggle'
import { type StockEntry, isStockCheckComplete } from '../../utils/product-audit'

interface StockCheckStepProps {
  products: string[]
  value: StockEntry[]
  onChange: (next: StockEntry[]) => void
  showValidation?: boolean
}

// Page 2 of the store audit: one Yes/No per product in the company's list, all on
// one page so the agent can walk the shelves and tick as they go. A No opens a
// "why not" box under that product; every product must be answered to continue.
export default function StockCheckStep({ products, value, onChange, showValidation }: StockCheckStepProps) {
  const byProduct = new Map(value.map(e => [e.product, e]))

  const setEntry = (product: string, patch: Partial<StockEntry>) => {
    const existing = byProduct.get(product)
    const next: StockEntry = { product, stock: existing?.stock ?? 'Yes', why_not: existing?.why_not ?? '', ...patch }
    // Keep list order aligned to the configured product order so the stored
    // answer (and the export built from it) reads the same way every time.
    const merged = new Map(byProduct)
    merged.set(product, next)
    onChange(products.filter(p => merged.has(p)).map(p => merged.get(p)!))
  }

  const answered = products.filter(p => byProduct.has(p)).length
  const complete = isStockCheckComplete(products, value)
  const err = !!showValidation

  if (products.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Product Stock Check</Typography>
          <Alert severity="warning">
            No products are configured for this company yet. Ask an admin to add the product list to the
            company&apos;s Product Audit question.
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Product Stock Check</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          For each product: does the store stock it? If not, say why.
        </Typography>

        <Box sx={{ mb: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">{products.length} products</Typography>
            <Typography variant="caption" color={complete ? 'success.main' : 'text.secondary'}>
              {answered} of {products.length} answered
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={(answered / products.length) * 100}
            color={complete ? 'success' : 'primary'}
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>

        {err && !complete && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Every product needs a Yes or No, and every No needs a reason — {products.length - answered} still unanswered.
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {products.map((product, idx) => {
            const entry = byProduct.get(product)
            const missing = err && !entry
            const missingWhy = err && entry?.stock === 'No' && !entry.why_not.trim()
            return (
              <Box
                key={product}
                sx={{
                  p: 1.5, border: '1px solid', borderRadius: 1,
                  borderColor: missing || missingWhy ? 'error.main' : entry ? (entry.stock === 'Yes' ? 'success.light' : 'warning.light') : 'divider',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ flex: 1 }}>{idx + 1}. {product}</Typography>
                  {entry && (
                    <Chip size="small" label={entry.stock === 'Yes' ? 'Stocked' : 'Not stocked'} color={entry.stock === 'Yes' ? 'success' : 'warning'} />
                  )}
                </Box>
                <YesNoToggle
                  label="Do they stock this product? *"
                  size="small"
                  value={entry?.stock ?? ''}
                  onChange={(v) => setEntry(product, { stock: v })}
                  error={missing}
                />
                {entry?.stock === 'No' && (
                  <TextField
                    fullWidth multiline required rows={2} size="small" sx={{ mt: 1 }}
                    label="Why not? *"
                    placeholder="e.g. not listed by their wholesaler, too slow-moving, price"
                    value={entry.why_not}
                    onChange={(e) => setEntry(product, { why_not: e.target.value })}
                    error={missingWhy}
                    helperText={missingWhy ? 'Please say why this product is not stocked' : undefined}
                  />
                )}
              </Box>
            )
          })}
        </Box>
      </CardContent>
    </Card>
  )
}
