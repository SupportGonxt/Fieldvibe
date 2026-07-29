import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  UserCheck,
  Shield,
  Package,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Activity,
  ChevronDown,
  ChevronUp,
  GraduationCap,
} from 'lucide-react'
import { apiClient as api } from '../../services/api.service'
import { fieldOperationsService } from '../../services/field-operations.service'
import type { ActiveTodayResponse } from '../../services/field-operations.service'
import { useAuthStore } from '../../store/auth.store'
import { canViewAllCompanies } from '../../lib/capabilities'
import CompanyToggle from '../../components/field-ops/CompanyToggle'
import { formatCurrency, formatNumber } from '../../utils/format'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import ErrorState from '../../components/ui/ErrorState'

interface AdminMetrics {
  totalUsers: number
  activeUsers: number
  totalAgents: number
  activeAgents: number
  totalCustomers: number
  totalProducts: number
  totalOrders: number
  totalRevenue: number
  recentUsers: Array<{
    id: string
    first_name: string
    last_name: string
    email: string
    role: string
    status: string
    created_at: string
  }>
  agentPerformance: Array<{
    id: string
    name: string
    order_count: number
    total_sales: number
    visit_count: number
  }>
  systemHealth: {
    pendingPayments: number
    overdueOrders: number
    inactiveAgents: number
  }
}

// Tile styling matches the GM Business Overview's Kpi component (GmOverviewPage.tsx)
// so the two "office console" dashboards read as one system.
function Kpi({ icon: Icon, label, value, sub, progress, tone = 'blue' }: {
  icon: any; label: string; value: string; sub?: string; progress?: number
  tone?: 'blue' | 'purple' | 'green' | 'amber' | 'cyan' | 'red'
}) {
  const tones: Record<string, string> = {
    blue: 'text-blue-600 bg-blue-50',
    purple: 'text-purple-600 bg-purple-50',
    green: 'text-emerald-600 bg-emerald-50',
    amber: 'text-amber-600 bg-amber-50',
    cyan: 'text-cyan-600 bg-cyan-50',
    red: 'text-red-600 bg-red-50',
  }
  return (
    <div className="card flex items-start justify-between">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-content-secondary">{label}</p>
        <p className="text-2xl font-semibold mt-1">{value}</p>
        {sub && <p className="text-xs text-content-secondary mt-1">{sub}</p>}
        {progress !== undefined && (
          <div className="mt-2 h-1.5 rounded-full bg-surface-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500"
              style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
            />
          </div>
        )}
      </div>
      <div className={`p-2.5 rounded-xl shrink-0 ml-3 ${tones[tone]}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  )
}

function Pill({ label, tone }: { label: string; tone: string }) {
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${tone}`}>{label}</span>
}

const ROLE_TONE: Record<string, string> = {
  superadmin: 'text-red-600 bg-red-50',
  super_admin: 'text-red-600 bg-red-50',
  admin: 'text-amber-600 bg-amber-50',
  backoffice_admin: 'text-amber-600 bg-amber-50',
  general_manager: 'text-amber-600 bg-amber-50',
  manager: 'text-blue-600 bg-blue-50',
  team_lead: 'text-blue-600 bg-blue-50',
  agent: 'text-emerald-600 bg-emerald-50',
  field_agent: 'text-emerald-600 bg-emerald-50',
  sales_rep: 'text-emerald-600 bg-emerald-50',
}
const roleTone = (role: string) => ROLE_TONE[role?.toLowerCase()] ?? 'text-gray-600 bg-gray-100'

const STATUS_TONE: Record<string, string> = {
  active: 'text-emerald-600 bg-emerald-50',
  inactive: 'text-amber-600 bg-amber-50',
  suspended: 'text-red-600 bg-red-50',
}
const statusTone = (status: string) => STATUS_TONE[status?.toLowerCase()] ?? 'text-gray-600 bg-gray-100'

export default function AdminDashboard() {
  const role = useAuthStore((s) => s.user?.role)
  const allowAll = canViewAllCompanies(role)
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null)
  const [activeToday, setActiveToday] = useState<ActiveTodayResponse | null>(null)
  const [showActiveRoster, setShowActiveRoster] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  const [company, setCompany] = useState<string | null>(null)

  useEffect(() => {
    fieldOperationsService
      .getCompanies()
      .then((res: any) => {
        const list = res?.companies ?? res ?? []
        setCompanies(list)
        // Two-button roles must not sit on a blended view — default to a company.
        if (!allowAll && list.length > 0) setCompany((c) => c ?? list[0].id)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowAll])

  useEffect(() => {
    fetchMetrics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company])

  const fetchMetrics = async () => {
    try {
      setLoading(true)
      setError(null)
      const [response, active] = await Promise.all([
        api.get(`/dashboard/admin${company ? `?company_id=${company}` : ''}`),
        fieldOperationsService.getActiveToday(company || undefined).catch(() => null),
      ])
      setActiveToday(active ?? null)
      if (response.data.success) {
        setMetrics(response.data.data)
      } else {
        throw new Error(response.data.error?.message || 'Failed to fetch admin metrics')
      }
    } catch (err: any) {
      console.error('Error fetching admin metrics:', err)
      setError(err.message || 'Failed to load admin dashboard')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="p-8 flex justify-center"><LoadingSpinner size="lg" /></div>
  if (error || !metrics) return <ErrorState message={error ?? 'No admin data available'} onRetry={fetchMetrics} />

  const totalUsers = metrics.totalUsers ?? 0
  const activeUsers = metrics.activeUsers ?? 0
  const totalAgents = metrics.totalAgents ?? 0
  const activeAgents = metrics.activeAgents ?? 0
  const totalCustomers = metrics.totalCustomers ?? 0
  const totalProducts = metrics.totalProducts ?? 0
  const totalOrders = metrics.totalOrders ?? 0
  const totalRevenue = metrics.totalRevenue ?? 0
  const systemHealth = metrics.systemHealth ?? { pendingPayments: 0, overdueOrders: 0, inactiveAgents: 0 }
  const agentPerformance = metrics.agentPerformance ?? []
  const recentUsers = metrics.recentUsers ?? []

  const userActivityRate = totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0
  const agentActivityRate = totalAgents > 0 ? Math.round((activeAgents / totalAgents) * 100) : 0

  // Active today (signup OR GPS) across the whole tenant, split by role. One combined,
  // inactive-first roster for the drill-down — the backend already sorts each group.
  const atAgents = activeToday?.agents
  const atLeads = activeToday?.teamLeads
  const activeTodayCount = (atAgents?.active ?? 0) + (atLeads?.active ?? 0)
  const activeTodayTotal = (atAgents?.total ?? 0) + (atLeads?.total ?? 0)
  const activeRoster = [
    ...(atLeads?.roster ?? []).map((p) => ({ ...p, kind: 'Team Lead' })),
    ...(atAgents?.roster ?? []).map((p) => ({ ...p, kind: 'Agent' })),
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-content-secondary text-sm">System overview, user management, and agent performance.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CompanyToggle companies={companies} value={company} onChange={setCompany} allowAll={allowAll} />
          <Link
            to="/admin/role-guide"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-xl bg-surface-secondary hover:bg-surface-tertiary transition-colors"
          >
            <GraduationCap className="w-4 h-4" />
            <span className="hidden sm:inline">Help &amp; Training</span>
          </Link>
        </div>
      </div>

      {/* Overview */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-content-secondary mb-2">Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi icon={Users} tone="blue" label="Total Users" value={formatNumber(totalUsers)}
            sub={`${formatNumber(activeUsers)} active${company ? ' · org-wide' : ''}`} />
          <Kpi icon={Shield} tone="purple" label="Total Agents" value={formatNumber(totalAgents)}
            sub={`${formatNumber(activeAgents)} active${company ? ' · org-wide' : ''}`} />
          <Kpi icon={UserCheck} tone="green" label="Total Customers" value={formatNumber(totalCustomers)}
            sub={company ? 'org-wide' : undefined} />
          <Kpi icon={Package} tone="amber" label="Total Products" value={formatNumber(totalProducts)}
            sub={company ? 'org-wide' : undefined} />
        </div>
      </div>

      {/* Business Performance */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-content-secondary mb-2">Business Performance</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi icon={ShoppingCart} tone="cyan" label="Total Orders" value={formatNumber(totalOrders)}
            sub={company ? 'org-wide' : undefined} />
          <Kpi icon={DollarSign} tone="green" label="Total Revenue" value={formatCurrency(totalRevenue)}
            sub={company ? 'org-wide' : undefined} />
          <Kpi icon={TrendingUp} tone="blue" label="User Activity Rate" value={`${userActivityRate}%`}
            sub={`${formatNumber(activeUsers)} of ${formatNumber(totalUsers)} active`} progress={userActivityRate} />
          <Kpi icon={TrendingUp} tone="purple" label="Agent Activity Rate" value={`${agentActivityRate}%`}
            sub={`${formatNumber(activeAgents)} of ${formatNumber(totalAgents)} active`} progress={agentActivityRate} />
        </div>
      </div>

      {/* Active Today — drillable roster split by team lead / agent */}
      <div
        className={`card ${activeTodayTotal > 0 ? 'cursor-pointer' : ''}`}
        onClick={() => activeTodayTotal > 0 && setShowActiveRoster((s) => !s)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-600" />
            <h2 className="font-semibold">Active Today — {activeTodayCount} of {activeTodayTotal}</h2>
          </div>
          {activeTodayTotal > 0 && (
            showActiveRoster ? <ChevronUp className="w-4 h-4 text-content-secondary" /> : <ChevronDown className="w-4 h-4 text-content-secondary" />
          )}
        </div>
        {showActiveRoster && activeTodayTotal > 0 && (
          <ul className="mt-3 space-y-2">
            {activeRoster.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 p-2.5 bg-surface-secondary rounded-lg">
                <div className="min-w-0">
                  <span className="font-medium text-sm truncate block">{p.name || 'Unknown'}</span>
                  <span className="text-xs text-content-secondary">
                    {p.kind}
                    {p.lastActivity
                      ? ` · ${new Date(p.lastActivity.includes('T') ? p.lastActivity : p.lastActivity.replace(' ', 'T') + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                      : ''}
                  </span>
                </div>
                <Pill label={p.active ? 'active' : 'inactive'} tone={statusTone(p.active ? 'active' : 'inactive')} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* System Health */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <h2 className="font-semibold">System Health</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-surface-secondary">
            <p className="text-xs text-content-secondary">Pending Payments</p>
            <p className="text-2xl font-semibold text-amber-600 mt-1">{systemHealth.pendingPayments}</p>
          </div>
          <div className="p-3 rounded-xl bg-surface-secondary">
            <p className="text-xs text-content-secondary">Overdue Orders</p>
            <p className="text-2xl font-semibold text-red-600 mt-1">{systemHealth.overdueOrders}</p>
          </div>
          <div className="p-3 rounded-xl bg-surface-secondary">
            <p className="text-xs text-content-secondary">Inactive Agents</p>
            <p className="text-2xl font-semibold text-amber-600 mt-1">{systemHealth.inactiveAgents}</p>
          </div>
        </div>
      </div>

      {/* Agent performance + Recent users */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" /> Top Performing Agents
          </h2>
          {agentPerformance.length === 0 ? (
            <p className="text-sm text-content-secondary">No agent data available.</p>
          ) : (
            <ul className="space-y-2">
              {agentPerformance.map((agent) => (
                <li key={agent.id} className="flex items-center justify-between gap-3 p-2.5 bg-surface-secondary rounded-lg">
                  <div className="min-w-0">
                    <span className="font-medium text-sm truncate block">{agent.name}</span>
                    <span className="text-xs text-content-secondary">
                      {formatNumber(agent.order_count)} orders · {formatNumber(agent.visit_count)} visits
                    </span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-primary shrink-0">
                    {formatCurrency(agent.total_sales ?? 0)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2 className="font-semibold mb-3">Recent Users</h2>
          {recentUsers.length === 0 ? (
            <p className="text-sm text-content-secondary">No users available.</p>
          ) : (
            <ul className="space-y-2">
              {recentUsers.map((user) => (
                <li key={user.id} className="flex items-center justify-between gap-3 p-2.5 bg-surface-secondary rounded-lg">
                  <div className="min-w-0">
                    <span className="font-medium text-sm truncate block">{user.first_name} {user.last_name}</span>
                    <span className="text-xs text-content-secondary truncate block">{user.email}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Pill label={user.role} tone={roleTone(user.role)} />
                    <Pill label={user.status} tone={statusTone(user.status)} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
