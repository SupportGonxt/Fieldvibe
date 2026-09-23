import { Alert, Box, Card, CardContent, TextField, Typography } from '@mui/material'
import YesNoToggle from './YesNoToggle'
import { type StoreAnswers, isStoreAnswersComplete } from '../../utils/product-audit'

interface StoreQuestionsStepProps {
  value: StoreAnswers
  onChange: (next: StoreAnswers) => void
  showValidation?: boolean
}

// Page 1 of the store audit: questions about the store as a whole, asked once —
// not per product. The deliveries answer opens one of two follow-ups: a No asks
// how stock gets to the store instead, a Yes asks what is delivered and how.
export default function StoreQuestionsStep({ value, onChange, showValidation }: StoreQuestionsStepProps) {
  const update = (patch: Partial<StoreAnswers>) => onChange({ ...value, ...patch })
  const err = !!showValidation

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Store Questions</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Ask the store owner or manager about the store as a whole. Questions marked * are required.
        </Typography>

        {showValidation && !isStoreAnswersComplete(value) && (
          <Alert severity="error" sx={{ mb: 2 }}>Please answer every required question before continuing.</Alert>
        )}

        <YesNoToggle
          label="1. Does a rep visit this store? *"
          value={value.rep_visits}
          onChange={(v) => update({ rep_visits: v })}
          error={err && !value.rep_visits}
        />

        <YesNoToggle
          label="2. Do they get deliveries? *"
          value={value.deliveries}
          onChange={(v) => update({ deliveries: v })}
          error={err && !value.deliveries}
        />

        {value.deliveries === 'No' && (
          <TextField
            fullWidth multiline required rows={3} size="small" sx={{ mb: 2.5 }}
            label="If no — how do they get their stock? *"
            placeholder="e.g. owner collects from a wholesaler every Monday"
            value={value.delivery_method}
            onChange={(e) => update({ delivery_method: e.target.value })}
            error={err && !value.delivery_method.trim()}
            helperText={err && !value.delivery_method.trim() ? 'Please describe how the store gets its stock' : undefined}
          />
        )}

        {value.deliveries === 'Yes' && (
          <TextField
            fullWidth multiline required rows={3} size="small" sx={{ mb: 2.5 }}
            label="If yes — what products are delivered, and how do the deliveries work? *"
            placeholder="e.g. Halls and Stimorol delivered weekly by the wholesaler's van, paid on delivery"
            value={value.delivered_products}
            onChange={(e) => update({ delivered_products: e.target.value })}
            error={err && !value.delivered_products.trim()}
            helperText={err && !value.delivered_products.trim() ? 'Please describe what is delivered and how' : undefined}
          />
        )}

        <Box sx={{ mb: 2.5 }}>
          <TextField
            fullWidth multiline required rows={3} size="small"
            label="3. What is their biggest challenge at the store? *"
            placeholder="e.g. price, shelf space, supply, cash flow, competitor pressure"
            value={value.biggest_challenge}
            onChange={(e) => update({ biggest_challenge: e.target.value })}
            error={err && !value.biggest_challenge.trim()}
            helperText={err && !value.biggest_challenge.trim() ? 'Please describe the biggest challenge' : undefined}
          />
        </Box>

        <TextField
          fullWidth multiline rows={3} size="small"
          label="4. Delivery issues with other products (if any)"
          placeholder="Any delivery problems they experience with other products — leave blank if none"
          value={value.other_delivery_issues}
          onChange={(e) => update({ other_delivery_issues: e.target.value })}
        />
      </CardContent>
    </Card>
  )
}
