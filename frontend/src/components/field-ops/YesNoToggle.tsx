import { Box, Button, FormHelperText, Typography } from '@mui/material'

export type YesNoValue = 'Yes' | 'No' | ''

// Two big tappable buttons rather than a switch: a switch has a default position,
// so an agent who never touched it still submits an answer. Here nothing is
// selected until they choose.
export default function YesNoToggle({ label, value, onChange, error, helperText, size = 'medium' }: {
  label: string
  value: YesNoValue
  onChange: (v: 'Yes' | 'No') => void
  error?: boolean
  helperText?: string
  size?: 'small' | 'medium'
}) {
  return (
    <Box sx={{ mb: size === 'small' ? 1 : 2.5 }}>
      <Typography variant="body2" color={error ? 'error' : 'text.primary'} sx={{ mb: 0.75 }}>{label}</Typography>
      <Box sx={{ display: 'flex', gap: 1 }}>
        {(['Yes', 'No'] as const).map(opt => (
          <Button
            key={opt}
            fullWidth
            size={size}
            variant={value === opt ? 'contained' : 'outlined'}
            color={value === opt ? (opt === 'Yes' ? 'success' : 'error') : error ? 'error' : 'inherit'}
            onClick={() => onChange(opt)}
            aria-pressed={value === opt}
          >
            {opt}
          </Button>
        ))}
      </Box>
      {error && <FormHelperText error>{helperText || 'Please choose Yes or No'}</FormHelperText>}
    </Box>
  )
}
