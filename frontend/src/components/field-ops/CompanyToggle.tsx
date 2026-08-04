import { useEffect } from 'react'

// Shared Goldrush / Stellr company toggle. One component so every dashboard uses
// the SAME wording ("All Companies") and behaviour, replacing the ~6 hand-rolled
// inline chip blocks that had drifted apart.
//
// Identity is always the company `id` (never a name substring). Labels come from
// field_companies.name, so the buttons read "Goldrush" / "Stellr" verbatim.
//
// allowAll:
//   true  (admin / general_manager / super_admin) → "All Companies" + one button
//         per company; value === null means the blended, org-wide view.
//   false (team_lead / manager / back office)      → only the named company buttons,
//         and value is forced to a real company id — there is NO blended default.

export type ToggleCompany = { id: string; name: string }

interface CompanyToggleProps {
  companies: ToggleCompany[]
  value: string | null
  onChange: (companyId: string | null) => void
  allowAll?: boolean
  variant?: 'web' | 'pwa'
  className?: string
}

const ALL_LABEL = 'All Companies'

export default function CompanyToggle({
  companies,
  value,
  onChange,
  allowAll = false,
  variant = 'web',
  className = '',
}: CompanyToggleProps) {
  // Two-button roles must never sit on a blended (null) view. If no company is
  // selected yet, snap to the first available one. Runs whenever the company
  // list arrives or the flags change; a no-op once a real id is set.
  useEffect(() => {
    if (!allowAll && value == null && companies.length > 0) {
      onChange(companies[0].id)
    }
  }, [allowAll, value, companies, onChange])

  // Nothing to choose between → render nothing (mirrors the old `length > 1` guards).
  const selectableCount = companies.length + (allowAll ? 1 : 0)
  if (selectableCount <= 1) return null

  if (variant === 'pwa') {
    return (
      <div className={`flex gap-2 overflow-x-auto -mx-4 px-4 scrollbar-hide ${className}`}>
        {allowAll && <Pill label={ALL_LABEL} active={value === null} onClick={() => onChange(null)} />}
        {companies.map((c) => (
          <Pill key={c.id} label={c.name} active={value === c.id} onClick={() => onChange(c.id)} />
        ))}
      </div>
    )
  }

  return (
    <div className={`inline-flex rounded-xl bg-surface-secondary p-1 ${className}`}>
      {allowAll && <Seg label={ALL_LABEL} active={value === null} onClick={() => onChange(null)} />}
      {companies.map((c) => (
        <Seg key={c.id} label={c.name} active={value === c.id} onClick={() => onChange(c.id)} />
      ))}
    </div>
  )
}

// Web segmented-control button — matches the period/company toggles on the web dashboards.
function Seg({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
        active ? 'bg-white shadow-sm font-medium' : 'text-content-secondary hover:text-content'
      }`}
    >
      {label}
    </button>
  )
}

// PWA pill chip — matches the token-themed chips on the mobile cockpit screens.
function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
        active ? 'bg-primary text-on-primary border-primary' : 'bg-white/[0.04] text-token-muted border-token'
      }`}
    >
      {label}
    </button>
  )
}
