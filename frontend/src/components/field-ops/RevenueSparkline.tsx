// Tiny inline SVG bar sparkline for the GM P&L card — 14 daily revenue bars,
// no chart library. Bars use currentColor so each surface sets tone via text-* class.
// All-zero days render as faint stubs so the axis still reads; native <title> = tooltip.

export type TrendPoint = { date: string; deposits: number; revenue: number }

const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', timeZone: 'UTC' })

export default function RevenueSparkline({ trend, className = '' }: { trend: TrendPoint[]; className?: string }) {
  if (!trend?.length) return null
  const H = 28
  const max = Math.max(...trend.map((t) => t.revenue))
  const w = 100 / trend.length
  return (
    <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" className={`block w-full h-7 ${className}`}
      role="img" aria-label={`Daily revenue, last ${trend.length} days`}>
      {trend.map((t, i) => {
        const h = max > 0 && t.revenue > 0 ? Math.max((t.revenue / max) * (H - 2), 1.5) : 0.75
        return (
          <rect key={t.date} x={i * w + w * 0.15} y={H - h} width={w * 0.7} height={h}
            fill="currentColor" opacity={t.revenue > 0 ? 0.9 : 0.25}>
            <title>{`${fmtDate(t.date)}: R${Math.round(t.revenue).toLocaleString('en-ZA')} · ${t.deposits} deposit${t.deposits === 1 ? '' : 's'}`}</title>
          </rect>
        )
      })}
    </svg>
  )
}
