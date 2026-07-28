import type { ElementType } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronRight, CheckCircle2, Info, ListChecks, Compass } from 'lucide-react'

// Shared "About My Role" brochure. A persistent, always-accessible help page that
// mirrors the Agent onboarding/training pattern but adapts to the two visual worlds
// FieldVibe lives in: the dark mobile shell (AgentLayout, variant="dark") and the
// light desktop dashboard (DashboardLayout, variant="light"). Content is passed in by
// each role's page file so every role reads with the same three-section structure.

export interface RoleLink {
  /** Plain, non-technical link text, e.g. "Team tab". */
  label: string
  /** Where to find it, e.g. "Reports menu → Escalations". */
  hint?: string
  /** Internal route. When set the row is tappable and jumps there; otherwise it is a
   *  plain "where to look" pointer (e.g. a company toggle, which is a control not a page). */
  to?: string
}

export interface RoleGuideContent {
  /** Role name shown in the header, e.g. "Team Lead". */
  role: string
  /** Icon for the header badge. */
  icon: ElementType
  /** One or two plain sentences: what this role is for. */
  purpose: string
  /** Short daily-tasks checklist. */
  tasks: string[]
  /** Where to find things. */
  links: RoleLink[]
}

interface RoleGuideProps extends RoleGuideContent {
  /** "dark" for the mobile shell, "light" for the desktop dashboard. */
  variant: 'dark' | 'light'
}

interface Theme {
  page: string
  header: string
  back: string
  iconBadge: string
  iconColor: string
  title: string
  subtitle: string
  content: string
  card: string
  sectionIcon: string
  sectionTitle: string
  purpose: string
  taskIcon: string
  taskText: string
  linkRow: string
  linkRowClickable: string
  linkLabel: string
  linkHint: string
  chevron: string
}

// Text, borders and accents use the theme-aware semantic tokens (var-backed, flip
// with the global `.dark` class) so both variants read correctly in light and dark.
// The variants differ only in page/header/surface chrome: the mobile shell is a
// full-bleed gradient banner over `bg-bg`; the desktop dashboard is a constrained,
// card-based layout.
const THEMES: Record<'dark' | 'light', Theme> = {
  dark: {
    page: 'min-h-screen bg-bg pb-24',
    header: 'bg-gradient-to-br from-surface to-[#0F2140] px-5 pt-5 pb-6',
    back: 'inline-flex items-center gap-1.5 text-sm text-token-faint hover:text-token-muted transition-colors mb-4 min-h-[44px]',
    iconBadge: 'w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-[#00D06E] shadow-lg',
    iconColor: 'text-white',
    title: 'text-xl font-bold text-token',
    subtitle: 'text-sm text-token-muted mt-0.5',
    content: 'px-5 pt-5 space-y-4',
    card: 'bg-white/5 border border-token rounded-2xl p-4',
    sectionIcon: 'text-primary',
    sectionTitle: 'text-xs font-semibold text-token-faint uppercase tracking-wider',
    purpose: 'text-sm text-token-muted leading-relaxed',
    taskIcon: 'text-primary',
    taskText: 'text-sm text-token-muted leading-relaxed',
    linkRow: 'w-full text-left bg-white/5 border border-token rounded-xl px-4 py-3 flex items-center gap-3',
    linkRowClickable: 'hover:bg-white/10 active:bg-white/10 active:scale-[0.99] transition-all',
    linkLabel: 'text-sm font-medium text-token',
    linkHint: 'text-xs text-token-faint mt-0.5',
    chevron: 'text-token-faint',
  },
  light: {
    page: 'max-w-3xl space-y-5',
    header: 'card',
    back: 'inline-flex items-center gap-1.5 text-sm text-token-faint hover:text-token-muted transition-colors mb-4',
    iconBadge: 'w-14 h-14 rounded-2xl bg-primary/10',
    iconColor: 'text-primary',
    title: 'text-2xl font-bold text-token',
    subtitle: 'text-sm text-token-muted mt-0.5',
    content: 'space-y-5',
    card: 'card',
    sectionIcon: 'text-primary',
    sectionTitle: 'text-xs font-semibold text-token-faint uppercase tracking-wider',
    purpose: 'text-sm text-token-muted leading-relaxed',
    taskIcon: 'text-primary',
    taskText: 'text-sm text-token-muted leading-relaxed',
    // Transparent bordered rows inherit the card surface, so they stay correct in both themes.
    linkRow: 'w-full text-left border border-token rounded-xl px-4 py-3 flex items-center gap-3',
    linkRowClickable: 'hover:bg-surface-secondary active:scale-[0.99] transition-all',
    linkLabel: 'text-sm font-medium text-token',
    linkHint: 'text-xs text-token-faint mt-0.5',
    chevron: 'text-token-faint',
  },
}

export default function RoleGuide({ variant, role, icon: Icon, purpose, tasks, links }: RoleGuideProps) {
  const navigate = useNavigate()
  const t = THEMES[variant]

  return (
    <div className={t.page}>
      {/* Header */}
      <div className={t.header}>
        <button onClick={() => navigate(-1)} className={t.back}>
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="flex items-center gap-4">
          <div className={`${t.iconBadge} flex items-center justify-center shrink-0`}>
            <Icon className={`w-7 h-7 ${t.iconColor}`} />
          </div>
          <div>
            <h1 className={t.title}>About the {role} role</h1>
            <p className={t.subtitle}>What you do here, day to day</p>
          </div>
        </div>
      </div>

      <div className={t.content}>
        {/* What this role is for */}
        <section className={t.card}>
          <div className="flex items-center gap-2 mb-3">
            <Info className={`w-4 h-4 ${t.sectionIcon}`} />
            <h2 className={t.sectionTitle}>What this role is for</h2>
          </div>
          <p className={t.purpose}>{purpose}</p>
        </section>

        {/* Your daily tasks */}
        <section className={t.card}>
          <div className="flex items-center gap-2 mb-3">
            <ListChecks className={`w-4 h-4 ${t.sectionIcon}`} />
            <h2 className={t.sectionTitle}>Your daily tasks</h2>
          </div>
          <ul className="space-y-2.5">
            {tasks.map((task, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <CheckCircle2 className={`w-5 h-5 shrink-0 ${t.taskIcon}`} />
                <span className={t.taskText}>{task}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Where to find things */}
        <section className={t.card}>
          <div className="flex items-center gap-2 mb-3">
            <Compass className={`w-4 h-4 ${t.sectionIcon}`} />
            <h2 className={t.sectionTitle}>Where to find things</h2>
          </div>
          <div className="space-y-2">
            {links.map((link, i) => {
              const clickable = Boolean(link.to)
              const body = (
                <>
                  <div className="flex-1 min-w-0">
                    <p className={t.linkLabel}>{link.label}</p>
                    {link.hint && <p className={t.linkHint}>{link.hint}</p>}
                  </div>
                  {clickable && <ChevronRight className={`w-4 h-4 shrink-0 ${t.chevron}`} />}
                </>
              )
              return clickable ? (
                <button
                  key={i}
                  onClick={() => navigate(link.to!)}
                  className={`${t.linkRow} ${t.linkRowClickable}`}
                >
                  {body}
                </button>
              ) : (
                <div key={i} className={t.linkRow}>
                  {body}
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
