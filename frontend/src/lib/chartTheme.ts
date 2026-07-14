// Chart colors resolved from design tokens (tokens.css) at call time —
// SVG presentation attributes can't use var(), so charts read computed values here.
const read = (name: string, fallback: string) => {
  if (typeof document === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

export function getChartColors() {
  // fallback in rgb form: tokens.css is the only file allowed to spell out the brand hex
  const primary = read('--color-primary', 'rgb(0 232 123)')
  const info = read('--color-info', '#1890ff')
  const success = read('--color-success', '#2ECC71')
  const warning = read('--color-warning', '#F39C12')
  const danger = read('--color-danger', '#EF4444')
  return {
    primary,
    info,
    success,
    warning,
    danger,
    textMuted: read('--color-text-muted', '#64748B'),
    border: read('--color-border', '#E2E8F0'),
    series: [primary, '#36A2EB', '#9B59B6', warning, '#00BCD4', '#E91E63'],
  }
}
