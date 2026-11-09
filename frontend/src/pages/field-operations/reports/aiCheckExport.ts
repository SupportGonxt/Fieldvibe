import * as XLSX from 'xlsx'

// AI Check export: one workbook with everything on the AI Check page, unpaged.
// The "By Team Lead" sheet groups each Team Lead with their agents (Team Lead total row,
// then one row per agent); every detail sheet is sorted Team Lead → agent → time.

export const FLAG_LABELS: Record<string, string> = {
  REUSED_STATUS_BAR: 'Frozen phone status bar (reused template)',
  GREEN_THEME: 'Green page — no such Goldrush theme',
  FUTURE_ID: 'Goldrush ID not issued yet (shown in photo)',
  PLACEHOLDER_TEXT: 'Placeholder text in name',
  FONT_MISMATCH: 'Font does not match golden (3+ checks)',
  THEME_COLOUR: 'Navy/black page + font deviation',
  CARD_COLOUR: 'ID card not Goldrush mustard yellow',
  GLYPH_ARTIFACT: 'AI glyph artifact in name',
  FONT_DEVIATION: 'Font deviation (2 checks)',
  ID_MISMATCH: 'Screenshot ID differs from typed ID',
  DUPLICATE_ID: 'Goldrush ID used more than once',
  FUTURE_ID_ENTERED: 'Typed ID beyond issued range (typo?)',
  MANUAL_REVIEW: 'Confirmed fake on manual review',
}

type Verdict = 'definite' | 'likely' | 'review' | 'unverifiable' | 'not_profile' | 'pass'

const VERDICT_LABELS: Record<Verdict, string> = {
  definite: 'Definite fake (excluded)',
  likely: 'Likely AI / edited',
  review: 'Review',
  pass: 'Matches golden',
  unverifiable: 'Unverifiable (crop / photo)',
  not_profile: 'Not a Goldrush profile',
}

const OUTCOME_LABELS: Record<string, string> = {
  can_retry: 'Still has attempts',
  passed_later: 'A later photo passed',
  abandoned: 'Visit not continued',
  review_pending: 'Sent for review',
  review_approved: 'Approved on review',
  review_rejected: 'Rejected on review',
}

const REVIEW_STATUS: Record<string, string> = { pending: 'Waiting', approved: 'Approved — real', rejected: 'Rejected — fake' }

interface Tally {
  key: string; total: number; definite: number; likely: number; review: number
  unverifiable: number; not_profile: number; pass: number; counted: number; flagged_pct: number
}

interface ExportData {
  period: { start: string; end: string }
  generated_at: string
  totals: Tally
  by_month: Tally[]
  flag_counts: Record<string, number>
  checkins: {
    visit_id: string; visit_date: string; agent_id: string; agent: string
    team_lead_id: string | null; team_lead: string | null
    verdict: Verdict; rule_verdict: Verdict; flags: string[]; goldrush_id: string | null
    reasons: string; source: string; photo_url: string | null
    review: { decision: 'fake' | 'genuine'; by: string | null; at: string; detail: string | null } | null
  }[]
  precheck: {
    agent_id: string; agent: string | null; team_lead_id: string | null; team_lead: string | null
    visit_date: string; created_at: string; stage: string; flags: string[]; detail: string | null; goldrush_id: string | null
  }[]
  failed_attempts: {
    id: string; created_at: string; agent_id: string; agent_name: string
    team_lead_id: string | null; team_lead_name: string | null; stage: string; attempt: number | null
    outcome: string; reasons: string[]; detail: string | null; extracted_id: string | null
    avatar_letters: string | null; profile_name: string | null; photo_url: string | null
  }[]
  failed_by_reason: { code: string; label: string; n: number }[]
  photo_reviews: {
    id: string; status: string; created_at: string; agent_id: string; agent: string | null
    team_lead_id: string | null; team_lead: string | null; goldrush_id: string | null
    first_name: string | null; last_name: string | null; reviewed_by_name: string | null
    reviewed_at: string | null; note: string | null; photo_url: string | null; attempts: string[]
  }[]
}

const NO_TL = 'No Team Lead'
const when = (iso: string | null | undefined) => {
  if (!iso) return ''
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z')
  return isNaN(d.getTime()) ? iso : d.toLocaleString('en-ZA', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
}
const flagText = (codes: string[]) => codes.map(c => FLAG_LABELS[c] || c).join('; ')
const pct = (n: number, d: number) => (d ? Math.round((1000 * n) / d) / 10 : 0)

// Sort key shared by every detail sheet: Team Lead (no Team Lead last), then agent.
const byTeam = <T>(tl: (r: T) => string | null, agent: (r: T) => string | null, time: (r: T) => string) => (a: T, b: T) =>
  Number(!tl(a)) - Number(!tl(b)) || (tl(a) || '').localeCompare(tl(b) || '') ||
  (agent(a) || '').localeCompare(agent(b) || '') || time(a).localeCompare(time(b))

function sheet(rows: Record<string, unknown>[], widths: number[], linkCol?: string) {
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = widths.map(wch => ({ wch }))
  if (linkCol && rows.length) {
    const col = Object.keys(rows[0]).indexOf(linkCol)
    rows.forEach((r, i) => {
      const url = r[linkCol]
      const cell = ws[XLSX.utils.encode_cell({ r: i + 1, c: col })]
      if (cell && typeof url === 'string' && url) cell.l = { Target: url, Tooltip: 'Open photo' }
    })
  }
  return ws
}

interface AgentStats {
  team_lead: string | null; agent: string
  total: number; definite: number; likely: number; review: number; unverifiable: number; not_profile: number; pass: number
  manual: number; precheck: number; failed: number; locked: number; pending: number; approved: number; rejected: number
}

const COUNTS = ['total', 'definite', 'likely', 'review', 'unverifiable', 'not_profile', 'pass', 'manual', 'precheck', 'failed', 'locked', 'pending', 'approved', 'rejected'] as const
const blank = (tl: string | null, agent: string): AgentStats =>
  ({ team_lead: tl, agent, ...Object.fromEntries(COUNTS.map(k => [k, 0])) }) as AgentStats

function teamLeadSheet(d: ExportData) {
  const agents = new Map<string, AgentStats>()
  const get = (id: string, name: string | null, tl: string | null) => {
    if (!agents.has(id)) agents.set(id, blank(tl, name || 'Unknown'))
    const a = agents.get(id) as AgentStats
    if (!a.team_lead && tl) a.team_lead = tl
    return a
  }
  for (const c of d.checkins) {
    const a = get(c.agent_id, c.agent, c.team_lead)
    a.total++; a[c.verdict]++
    if (c.review) a.manual++
  }
  for (const p of d.precheck) get(p.agent_id, p.agent, p.team_lead).precheck++
  for (const f of d.failed_attempts) get(f.agent_id, f.agent_name, f.team_lead_name).failed++
  for (const r of d.photo_reviews) {
    const a = get(r.agent_id, r.agent, r.team_lead)
    a.locked++
    if (r.status === 'pending') a.pending++; else if (r.status === 'approved') a.approved++; else if (r.status === 'rejected') a.rejected++
  }

  const groups = new Map<string, AgentStats[]>()
  for (const a of agents.values()) {
    const k = a.team_lead || NO_TL
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)?.push(a)
  }
  const order = [...groups.keys()].sort((x, y) => Number(x === NO_TL) - Number(y === NO_TL) || x.localeCompare(y))

  const sum = (list: AgentStats[]): AgentStats => {
    const s = blank(null, '')
    for (const a of list) for (const k of COUNTS) s[k] += a[k]
    return s
  }

  const row = (tl: string, agent: string, s: AgentStats) => ({
    'Team Lead': tl,
    'Agent': agent,
    'Agents': '' as number | string,
    'Check-ins': s.total,
    'Definite fake (excluded)': s.definite,
    'Likely AI / edited': s.likely,
    'Review': s.review,
    'Matches golden': s.pass,
    'Unverifiable': s.unverifiable,
    'Not a Goldrush profile': s.not_profile,
    'Counted in reports': s.total - s.definite,
    'Flagged %': pct(s.definite + s.likely, s.total),
    'Manually reviewed': s.manual,
    'Caught before submit': s.precheck,
    'Failed photo attempts': s.failed,
    'Locked after 3 fails': s.locked,
    'Locked — waiting': s.pending,
    'Locked — approved real': s.approved,
    'Locked — rejected fake': s.rejected,
  })

  const rows: Record<string, unknown>[] = []
  for (const tl of order) {
    const list = (groups.get(tl) || []).sort((a, b) => pct(b.definite + b.likely, b.total) - pct(a.definite + a.likely, a.total) || a.agent.localeCompare(b.agent))
    rows.push({ ...row(tl, `TEAM TOTAL`, sum(list)), 'Agents': list.length })
    for (const a of list) rows.push(row(tl, a.agent, a))
    rows.push({})
  }
  const all = [...agents.values()]
  rows.push({ ...row('ALL TEAMS', 'GRAND TOTAL', sum(all)), 'Agents': all.length })
  return sheet(rows, [24, 26, 8, 10, 12, 12, 9, 10, 12, 12, 11, 10, 11, 12, 12, 12, 11, 13, 13])
}

export function buildAiCheckWorkbook(d: ExportData) {
  const wb = XLSX.utils.book_new()
  const t = d.totals

  const summary: (string | number)[][] = [
    ['AI Check — detailed report'],
    ['Period', `${d.period.start} to ${d.period.end}`],
    ['Generated', when(d.generated_at)],
    [],
    ['Check-in verdicts', 'Count', '% of check-ins'],
    ['Check-ins captured', t.total, 100],
    ...(Object.keys(VERDICT_LABELS) as Verdict[]).map(v => [VERDICT_LABELS[v], t[v], pct(t[v], t.total)]),
    ['Counted in reports (all except definite fakes)', t.counted, pct(t.counted, t.total)],
    ['Flagged % (definite + likely)', '', t.flagged_pct],
    [],
    ['Other activity', 'Count'],
    ['Fake photos caught before submit', d.precheck.length],
    ['Failed photo attempts', d.failed_attempts.length],
    ['Visits locked after 3 failed attempts', d.photo_reviews.length],
    ...Object.entries(REVIEW_STATUS).map(([k, label]) => [`  ${label}`, d.photo_reviews.filter(r => r.status === k).length]),
    [],
    ['What was detected (check-ins)', 'Count'],
    ...Object.entries(d.flag_counts).sort((a, b) => b[1] - a[1]).map(([code, n]) => [FLAG_LABELS[code] || code, n]),
    [],
    ['Why photo attempts failed', 'Count'],
    ...d.failed_by_reason.map(r => [r.label, r.n]),
  ]
  const ws = XLSX.utils.aoa_to_sheet(summary)
  ws['!cols'] = [{ wch: 48 }, { wch: 24 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Summary')

  XLSX.utils.book_append_sheet(wb, teamLeadSheet(d), 'By Team Lead')

  const checkins = [...d.checkins].sort(byTeam(r => r.team_lead, r => r.agent, r => r.visit_date)).map(c => ({
    'Team Lead': c.team_lead || NO_TL,
    'Agent': c.agent,
    'Visit date': c.visit_date,
    'Verdict': c.review ? (c.review.decision === 'fake' ? 'Fake (manual review)' : 'Genuine (manual review)') : VERDICT_LABELS[c.verdict],
    'AI check verdict': VERDICT_LABELS[c.rule_verdict],
    'Counted in reports': c.verdict === 'definite' ? 'No' : 'Yes',
    'Goldrush ID': c.goldrush_id || '',
    'What was detected': flagText(c.flags),
    'Why flagged': c.reasons,
    'Reviewed by': c.review?.by || '',
    'Reviewed at': when(c.review?.at),
    'Review detail': c.review?.detail || '',
    'Source': c.source,
    'Visit ID': c.visit_id,
    'Photo': c.photo_url || '',
  }))
  XLSX.utils.book_append_sheet(wb, sheet(checkins, [22, 24, 11, 24, 24, 9, 12, 40, 50, 18, 17, 40, 16, 38, 50], 'Photo'), 'Check-ins')

  const failed = [...d.failed_attempts].sort(byTeam(r => r.team_lead_name, r => r.agent_name, r => r.created_at)).map(a => ({
    'Team Lead': a.team_lead_name || NO_TL,
    'Agent': a.agent_name,
    'When': when(a.created_at),
    'Attempt': a.attempt ? `${a.attempt} of 3` : '',
    'Stage': a.stage === 'submit' ? 'At submit' : a.stage,
    'Why it failed': a.reasons.join('; '),
    'Detail': a.detail || '',
    'Name read from photo': a.profile_name || '',
    'Avatar letters': a.avatar_letters || '',
    'ID read from photo': a.extracted_id || '',
    'What happened to the visit': OUTCOME_LABELS[a.outcome] || a.outcome,
    'Photo': a.photo_url || '',
  }))
  XLSX.utils.book_append_sheet(wb, sheet(failed, [22, 24, 17, 9, 10, 44, 50, 24, 10, 14, 22, 50], 'Photo'), 'Failed attempts')

  const maxAttempts = Math.max(3, ...d.photo_reviews.map(r => r.attempts.length))
  const locked = [...d.photo_reviews].sort(byTeam(r => r.team_lead, r => r.agent, r => r.created_at)).map(r => ({
    'Team Lead': r.team_lead || NO_TL,
    'Agent': r.agent || 'Unknown',
    'Locked at': when(r.created_at),
    'Status': REVIEW_STATUS[r.status] || r.status,
    ...Object.fromEntries(Array.from({ length: maxAttempts }, (_, i) => [`Attempt ${i + 1} — why it failed`, r.attempts[i] || ''])),
    'Goldrush ID': r.goldrush_id || '',
    'Name': [r.first_name, r.last_name].filter(Boolean).join(' '),
    'Reviewed by': r.reviewed_by_name || '',
    'Reviewed at': when(r.reviewed_at),
    'Note': r.note || '',
    'Last photo': r.photo_url || '',
  }))
  XLSX.utils.book_append_sheet(wb, sheet(locked, [22, 24, 17, 16, ...Array(maxAttempts).fill(36), 12, 22, 18, 17, 40, 50], 'Last photo'), '3-strike reviews')

  const precheck = [...d.precheck].sort(byTeam(r => r.team_lead, r => r.agent, r => r.created_at)).map(p => ({
    'Team Lead': p.team_lead || NO_TL,
    'Agent': p.agent || p.agent_id,
    'Date': p.visit_date,
    'When': when(p.created_at),
    'Stage': p.stage === 'blocked' ? 'Blocked at submit' : 'Warned while capturing',
    'What was detected': flagText(p.flags),
    'Detail': p.detail || '',
    'Goldrush ID': p.goldrush_id || '',
  }))
  XLSX.utils.book_append_sheet(wb, sheet(precheck, [22, 24, 11, 17, 22, 40, 50, 12]), 'Caught before submit')

  const months = d.by_month.map(m => ({
    'Month': m.key, 'Check-ins': m.total,
    'Definite fake (excluded)': m.definite, 'Likely AI / edited': m.likely, 'Review': m.review, 'Matches golden': m.pass,
    'Unverifiable': m.unverifiable, 'Not a Goldrush profile': m.not_profile, 'Counted in reports': m.counted, 'Flagged %': m.flagged_pct,
  }))
  XLSX.utils.book_append_sheet(wb, sheet(months, [10, 10, 12, 12, 9, 10, 12, 12, 11, 10]), 'By month')

  return wb
}

export function downloadAiCheckReport(d: ExportData) {
  XLSX.writeFile(buildAiCheckWorkbook(d), `ai-check-report_${d.period.start}_to_${d.period.end}.xlsx`)
}

export type { ExportData as AiCheckExportData }
