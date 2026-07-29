import React, { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../../services/api.service'
import { useAuthStore } from '../../../store/auth.store'
import { canViewAllCompanies } from '../../../lib/capabilities'
import CompanyToggle from '../../../components/field-ops/CompanyToggle'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { AlertTriangle, RefreshCw, Bell, CheckCircle2, Clock, ShieldAlert, Download, History } from 'lucide-react'
import toast from 'react-hot-toast'
import { saveRowsAsCsv } from '../../../lib/downloadCsv'
import DateRangePresets from '../../../components/ui/DateRangePresets'

// Mirrors the payload from GET /field-ops/escalation-report.
interface StageCell {
  reached: boolean
  actioned?: { by: string; byName: string; at: string } | null
  overdue?: boolean
  current?: boolean
}
interface EscRow {
  agentId: string
  name: string
  teamLeadId: string | null
  companyId: string | null
  company: string | null
  quietSince: string | null
  quietMinutes: number
  currentStage: 'team_lead' | 'manager' | 'backoffice_admin' | 'general_manager'
  stages: { team_lead?: StageCell; manager?: StageCell; backoffice_admin?: StageCell }
  gmNotified: boolean
}
interface EscConfig { minIdleMinutes: number; managerAfterH: number; backofficeAfterH: number; gmAfterH: number }
interface EscResponse { success: boolean; asOf: string; config: EscConfig; rows: EscRow[] }

// Mirrors GET /field-ops/escalation-report/history — audit trail of past "Action nudge" clicks.
interface EscHistoryRow {
  id: string
  agentId: string
  agentName: string
  company: string | null
  stage: 'team_lead' | 'manager' | 'backoffice_admin'
  actorName: string | null
  at: string
}
interface EscHistoryResponse { success: boolean; rows: EscHistoryRow[] }

// The three actionable stages, in ladder order, with column headers.
const ACTION_STAGES: Array<{ key: 'team_lead' | 'manager' | 'backoffice_admin'; label: string }> = [
  { key: 'team_lead', label: 'Team Lead' },
  { key: 'manager', label: 'Manager' },
  { key: 'backoffice_admin', label: 'Back Office / Admin' },
]
const STAGE_LABEL: Record<EscRow['currentStage'], string> = {
  team_lead: 'Team Lead',
  manager: 'Manager',
  backoffice_admin: 'Back Office / Admin',
  general_manager: 'General Manager',
}

// SQLite UTC datetime string -> "HH:MM" in the viewer's locale. null-safe.
function fmtTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z')
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

// Plain-text stage status for the CSV export — same three states renderCell shows.
function stageCellText(cell: StageCell | undefined): string {
  if (!cell || !cell.reached) return 'Not reached'
  if (cell.actioned) return `Contacted ${fmtTime(cell.actioned.at)}${cell.actioned.byName ? ` · ${cell.actioned.byName}` : ''}`
  return cell.overdue ? 'Overdue' : 'Pending'
}

const StageBadge: React.FC<{ stage: EscRow['currentStage'] }> = ({ stage }) => {
  const cls =
    stage === 'team_lead' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
      : stage === 'manager' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
        : stage === 'backoffice_admin' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${cls}`}>{STAGE_LABEL[stage]}</span>
}

const EscalationReport: React.FC = () => {
  const role = useAuthStore((s) => s.user?.role)
  const allowAll = canViewAllCompanies(role)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null) // `${agentId}:${stage}` being actioned
  const [view, setView] = useState<'live' | 'history'>('live')
  const [historyStart, setHistoryStart] = useState<string>('')
  const [historyEnd, setHistoryEnd] = useState<string>('')

  const { data: companies = [] } = useQuery({
    queryKey: ['field-companies'],
    queryFn: async () => {
      const res = await apiClient.get('/field-ops/companies')
      return (res.data?.data || res.data || []) as Array<{ id: string; name: string }>
    },
    staleTime: 300_000,
  })
  // Roles that can't view all companies must sit on a real company id (CompanyToggle enforces
  // this too, but seed it so the first fetch is already scoped).
  useEffect(() => {
    if (!allowAll && companyId == null && companies.length > 0) setCompanyId(companies[0].id)
  }, [allowAll, companyId, companies])

  const { data, isLoading, isError, refetch, isFetching } = useQuery<EscResponse>({
    queryKey: ['escalation-report', companyId],
    queryFn: async () => {
      const res = await apiClient.get('/field-ops/escalation-report', {
        params: companyId ? { company_id: companyId } : {},
      })
      return res.data as EscResponse
    },
    refetchInterval: 60_000, // real-time-ish: the ladder moves on the hour
    staleTime: 30_000,
  })

  const rows = data?.rows ?? []
  const cfg = data?.config

  const { data: historyData, isLoading: historyLoading, isError: historyError, refetch: refetchHistory, isFetching: historyFetching } = useQuery<EscHistoryResponse>({
    queryKey: ['escalation-report-history', companyId, historyStart, historyEnd],
    queryFn: async () => {
      const res = await apiClient.get('/field-ops/escalation-report/history', {
        params: {
          ...(companyId ? { company_id: companyId } : {}),
          ...(historyStart ? { startDate: historyStart } : {}),
          ...(historyEnd ? { endDate: historyEnd } : {}),
        },
      })
      return res.data as EscHistoryResponse
    },
    enabled: view === 'history',
    staleTime: 30_000,
  })
  const historyRows = historyData?.rows ?? []

  const actionNudge = async (agentId: string, stage: string) => {
    const key = `${agentId}:${stage}`
    if (busy) return
    setBusy(key)
    try {
      await apiClient.post('/field-ops/escalation-report/action', { agentId, stage })
      toast.success('Nudge sent')
      await refetch()
    } catch {
      toast.error('Could not send nudge')
    } finally {
      setBusy(null)
    }
  }

  // Same rows already on screen — CSV built client-side, no extra endpoint.
  const exportCsv = () => {
    saveRowsAsCsv(
      ['Agent', 'Company', 'Quiet since', 'Quiet duration', 'Current stage', 'Team Lead', 'Manager', 'Back Office / Admin', 'GM notified'],
      rows.map((row) => [
        row.name,
        row.company || '',
        fmtTime(row.quietSince),
        fmtDuration(row.quietMinutes),
        STAGE_LABEL[row.currentStage],
        stageCellText(row.stages.team_lead),
        stageCellText(row.stages.manager),
        stageCellText(row.stages.backoffice_admin),
        row.gmNotified ? 'Yes' : 'No',
      ]),
      `escalation-report-${data?.asOf || new Date().toISOString().slice(0, 10)}.csv`,
    )
  }

  const exportHistoryCsv = () => {
    saveRowsAsCsv(
      ['Date', 'Time', 'Agent', 'Company', 'Stage', 'Actioned by'],
      historyRows.map((row) => [
        row.at ? row.at.slice(0, 10) : '',
        fmtTime(row.at),
        row.agentName,
        row.company || '',
        STAGE_LABEL[row.stage],
        row.actorName || '',
      ]),
      `escalation-history-${historyStart || 'all'}_${historyEnd || 'all'}.csv`,
    )
  }

  const renderCell = (row: EscRow, stageKey: 'team_lead' | 'manager' | 'backoffice_admin') => {
    const cell = row.stages[stageKey]
    if (!cell || !cell.reached) return <span className="text-gray-300 dark:text-gray-600">—</span>
    if (cell.actioned) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Contacted {fmtTime(cell.actioned.at)}
          {cell.actioned.byName ? <span className="text-gray-400 dark:text-gray-500">· {cell.actioned.byName}</span> : null}
        </span>
      )
    }
    const busyThis = busy === `${row.agentId}:${stageKey}`
    return (
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1 text-xs font-medium ${cell.overdue ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
          <AlertTriangle className="h-3.5 w-3.5" />
          {cell.overdue ? 'Overdue' : 'Pending'}
        </span>
        <button
          onClick={() => actionNudge(row.agentId, stageKey)}
          disabled={!!busy}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary text-on-primary text-xs font-medium hover:bg-primary-strong disabled:opacity-50"
        >
          <Bell className="h-3 w-3" /> {busyThis ? 'Sending…' : 'Action nudge'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Escalation Report</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {view === 'live'
              ? 'Live view of idle agents climbing the escalation ladder. Automatic nudges keep running — action a stage here to record who stepped in.'
              : 'Audit trail of past "Action nudge" clicks — who actioned which stage, and when.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CompanyToggle companies={companies} value={companyId} onChange={setCompanyId} allowAll={allowAll} />
          {view === 'live' ? (
            <>
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
              </button>
              <button
                onClick={exportCsv}
                disabled={rows.length === 0}
                className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium disabled:opacity-50"
              >
                <Download className="h-4 w-4" /> Export CSV
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => refetchHistory()}
                disabled={historyFetching}
                className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${historyFetching ? 'animate-spin' : ''}`} /> Refresh
              </button>
              <button
                onClick={exportHistoryCsv}
                disabled={historyRows.length === 0}
                className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium disabled:opacity-50"
              >
                <Download className="h-4 w-4" /> Export CSV
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
        <button
          onClick={() => setView('live')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
            view === 'live'
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm font-medium'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Clock className="h-3.5 w-3.5" /> Live ladder
        </button>
        <button
          onClick={() => setView('history')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
            view === 'history'
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm font-medium'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <History className="h-3.5 w-3.5" /> History
        </button>
      </div>

      {view === 'history' && (
        <DateRangePresets startDate={historyStart} endDate={historyEnd} onStartDateChange={setHistoryStart} onEndDateChange={setHistoryEnd} />
      )}

      {view === 'live' && isLoading ? <LoadingSpinner /> : view === 'live' && isError ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Could not load the escalation report</p>
          <button onClick={() => refetch()} className="mt-4 flex items-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg text-sm">
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </div>
      ) : view === 'history' && historyLoading ? <LoadingSpinner /> : view === 'history' && historyError ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Could not load the escalation history</p>
          <button onClick={() => refetchHistory()} className="mt-4 flex items-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg text-sm">
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </div>
      ) : view === 'history' ? (
        <>
          {historyRows.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-400 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">No escalation actions in this date range.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                      <th className="text-left py-2.5 px-4 text-xs text-gray-500 dark:text-gray-400 font-medium">Date</th>
                      <th className="text-left py-2.5 px-4 text-xs text-gray-500 dark:text-gray-400 font-medium">Agent</th>
                      <th className="text-left py-2.5 px-4 text-xs text-gray-500 dark:text-gray-400 font-medium">Company</th>
                      <th className="text-left py-2.5 px-4 text-xs text-gray-500 dark:text-gray-400 font-medium">Stage</th>
                      <th className="text-left py-2.5 px-4 text-xs text-gray-500 dark:text-gray-400 font-medium">Actioned by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyRows.map((row) => (
                      <tr key={row.id} className="border-b border-gray-100 dark:border-gray-700/40 hover:bg-gray-50 dark:hover:bg-gray-700/20">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-medium text-gray-700 dark:text-gray-200">{row.at ? row.at.slice(0, 10) : ''}</span>
                          <span className="text-gray-400 dark:text-gray-500 ml-1">{fmtTime(row.at)}</span>
                        </td>
                        <td className="py-3 px-4 font-medium text-gray-900 dark:text-white whitespace-nowrap">{row.agentName}</td>
                        <td className="py-3 px-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">{row.company || '—'}</td>
                        <td className="py-3 px-4 whitespace-nowrap"><StageBadge stage={row.stage} /></td>
                        <td className="py-3 px-4 text-gray-700 dark:text-gray-200 whitespace-nowrap">{row.actorName || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {historyRows.length > 0 && (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {historyRows.length} action{historyRows.length !== 1 ? 's' : ''} in range
            </div>
          )}
        </>
      ) : (
        <>
      {/* Ladder legend — the configured stage clock */}
      {cfg && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Stage clock:</span>
          <span><span className="font-medium text-blue-600 dark:text-blue-400">Team Lead</span> 0–{cfg.managerAfterH}h</span>
          <span><span className="font-medium text-amber-600 dark:text-amber-400">Manager</span> {cfg.managerAfterH}–{cfg.backofficeAfterH}h</span>
          <span><span className="font-medium text-orange-600 dark:text-orange-400">Back Office / Admin</span> {cfg.backofficeAfterH}–{cfg.gmAfterH}h</span>
          <span><span className="font-medium text-red-600 dark:text-red-400">General Manager</span> {cfg.gmAfterH}h+</span>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <CheckCircle2 className="h-10 w-10 text-green-400 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">No agents are currently on the escalation ladder.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                  <th className="text-left py-2.5 px-4 text-xs text-gray-500 dark:text-gray-400 font-medium">Agent</th>
                  <th className="text-left py-2.5 px-4 text-xs text-gray-500 dark:text-gray-400 font-medium">Quiet since</th>
                  {ACTION_STAGES.map((s) => (
                    <th key={s.key} className="text-left py-2.5 px-4 text-xs text-gray-500 dark:text-gray-400 font-medium">{s.label}</th>
                  ))}
                  <th className="text-left py-2.5 px-4 text-xs text-gray-500 dark:text-gray-400 font-medium">Current stage</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.agentId} className="border-b border-gray-100 dark:border-gray-700/40 hover:bg-gray-50 dark:hover:bg-gray-700/20">
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900 dark:text-white whitespace-nowrap">{row.name}</div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">{row.company || '—'}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-medium text-gray-700 dark:text-gray-200">{fmtDuration(row.quietMinutes)}</span>
                    </td>
                    {ACTION_STAGES.map((s) => (
                      <td key={s.key} className="py-3 px-4">{renderCell(row, s.key)}</td>
                    ))}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <StageBadge stage={row.currentStage} />
                        {row.gmNotified && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400" title="General Manager notified (fallback)">
                            <ShieldAlert className="h-3.5 w-3.5" /> GM notified
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {rows.length} agent{rows.length !== 1 ? 's' : ''} on the ladder · updates every minute
        </div>
      )}
        </>
      )}
    </div>
  )
}

export default EscalationReport
