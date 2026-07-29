import { useEffect, useState } from 'react'
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  LinearProgress,
  ToggleButton,
  ToggleButtonGroup,
  Button,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
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
import ErrorState from '../../components/ui/ErrorState'
import EmptyState from '../../components/ui/EmptyState'

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

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ReactNode
  color: string
}

const MetricCard = ({ title, value, subtitle, icon, color }: MetricCardProps) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography color="text.secondary" variant="body2" gutterBottom>
            {title}
          </Typography>
          <Typography variant="h4" fontWeight="bold" sx={{ my: 1 }}>
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        <Box
          sx={{
            backgroundColor: `${color}15`,
            borderRadius: 2,
            p: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </Box>
      </Box>
    </CardContent>
  </Card>
)

const getRoleColor = (role: string) => {
  switch (role.toLowerCase()) {
    case 'superadmin':
      return 'error'
    case 'admin':
      return 'warning'
    case 'manager':
      return 'info'
    case 'agent':
      return 'success'
    default:
      return 'default'
  }
}

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'active':
      return 'success'
    case 'inactive':
      return 'warning'
    case 'suspended':
      return 'error'
    default:
      return 'default'
  }
}

export default function AdminDashboard() {
  const navigate = useNavigate()
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

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Box>
    )
  }

  if (!metrics) {
    return (
      <Box p={3}>
        <Alert severity="warning">No admin data available</Alert>
      </Box>
    )
  }

  const totalUsers = metrics.totalUsers ?? 0
  const activeUsers = metrics.activeUsers ?? 0
  const totalAgents = metrics.totalAgents ?? 0
  const activeAgents = metrics.activeAgents ?? 0
  const totalCustomers = metrics.totalCustomers ?? 0
  const totalProducts = metrics.totalProducts ?? 0
  const totalOrders = metrics.totalOrders ?? 0
  const totalRevenue = metrics.totalRevenue ?? 0
  const systemHealth = metrics.systemHealth ?? { pendingPayments: 0, overdueOrders: 0, inactiveAgents: 0 }

  const userActivityRate = totalUsers > 0
    ? Math.round((activeUsers / totalUsers) * 100)
    : 0

  const agentActivityRate = totalAgents > 0
    ? Math.round((activeAgents / totalAgents) * 100)
    : 0

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
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Admin Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            System overview, user management, and agent performance
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<GraduationCap size={18} />}
          onClick={() => navigate('/admin/role-guide')}
        >
          Help &amp; Training
        </Button>
      </Box>

      {/* Goldrush / Stellr scope. Only field-ops (visit-based) metrics split by company;
          the master-data tiles below are labelled "org-wide" when a company is selected. */}
      {companies.length > 1 && (
        <ToggleButtonGroup
          exclusive
          size="small"
          value={company ?? 'all'}
          onChange={(_e, val) => { if (val !== null) setCompany(val === 'all' ? null : val) }}
          sx={{ mb: 3 }}
        >
          {allowAll && <ToggleButton value="all">All Companies</ToggleButton>}
          {companies.map((co) => (
            <ToggleButton key={co.id} value={co.id}>{co.name}</ToggleButton>
          ))}
        </ToggleButtonGroup>
      )}

      <Grid container spacing={3}>
        {/* System Statistics */}
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Users"
            value={totalUsers.toLocaleString()}
            subtitle={`${activeUsers} active${company ? ' · org-wide' : ''}`}
            icon={<Users size={24} color="#3b82f6" />}
            color="#3b82f6"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Agents"
            value={totalAgents.toLocaleString()}
            subtitle={`${activeAgents} active${company ? ' · org-wide' : ''}`}
            icon={<Shield size={24} color="#8b5cf6" />}
            color="#8b5cf6"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Active Today"
            value={`${activeTodayCount} of ${activeTodayTotal}`}
            subtitle={`${atAgents?.active ?? 0}/${atAgents?.total ?? 0} agents · ${atLeads?.active ?? 0}/${atLeads?.total ?? 0} leads`}
            icon={<Activity size={24} color="#22c55e" />}
            color="#22c55e"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Customers"
            value={totalCustomers.toLocaleString()}
            subtitle={company ? 'org-wide' : undefined}
            icon={<UserCheck size={24} color="#10b981" />}
            color="#10b981"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Products"
            value={totalProducts.toLocaleString()}
            subtitle={company ? 'org-wide' : undefined}
            icon={<Package size={24} color="#f59e0b" />}
            color="#f59e0b"
          />
        </Grid>

        {/* Business Metrics */}
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Orders"
            value={totalOrders.toLocaleString()}
            subtitle={company ? 'org-wide' : undefined}
            icon={<ShoppingCart size={24} color="#06b6d4" />}
            color="#06b6d4"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Revenue"
            value={`$${totalRevenue.toLocaleString()}`}
            subtitle={company ? 'org-wide' : undefined}
            icon={<DollarSign size={24} color="#10b981" />}
            color="#10b981"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography color="text.secondary" variant="body2" gutterBottom>
                User Activity Rate
              </Typography>
              <Typography variant="h4" fontWeight="bold" sx={{ my: 1 }}>
                {userActivityRate}%
              </Typography>
              <LinearProgress
                variant="determinate"
                value={userActivityRate}
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography color="text.secondary" variant="body2" gutterBottom>
                Agent Activity Rate
              </Typography>
              <Typography variant="h4" fontWeight="bold" sx={{ my: 1 }}>
                {agentActivityRate}%
              </Typography>
              <LinearProgress
                variant="determinate"
                value={agentActivityRate}
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Active Today — drillable roster split by team lead / agent */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Box
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              sx={{ cursor: activeTodayTotal > 0 ? 'pointer' : 'default' }}
              onClick={() => activeTodayTotal > 0 && setShowActiveRoster((s) => !s)}
            >
              <Box display="flex" alignItems="center" gap={1}>
                <Activity size={24} color="#22c55e" />
                <Typography variant="h6" fontWeight="bold">
                  Active Today — {activeTodayCount} of {activeTodayTotal}
                </Typography>
              </Box>
              {activeTodayTotal > 0 &&
                (showActiveRoster ? <ChevronUp size={20} /> : <ChevronDown size={20} />)}
            </Box>
            {showActiveRoster && activeTodayTotal > 0 && (
              <TableContainer sx={{ mt: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Last activity</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {activeRoster.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.name || 'Unknown'}</TableCell>
                        <TableCell>{p.kind}</TableCell>
                        <TableCell>
                          <Chip
                            label={p.active ? 'active' : 'inactive'}
                            color={getStatusColor(p.active ? 'active' : 'inactive')}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {p.lastActivity
                            ? new Date(
                                p.lastActivity.includes('T')
                                  ? p.lastActivity
                                  : p.lastActivity.replace(' ', 'T') + 'Z'
                              ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Grid>

        {/* System Health Alerts */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <AlertTriangle size={24} color="#f59e0b" />
              <Typography variant="h6" fontWeight="bold">
                System Health
              </Typography>
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" variant="body2">
                      Pending Payments
                    </Typography>
                    <Typography variant="h3" fontWeight="bold" color="warning.main">
                      {systemHealth.pendingPayments}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" variant="body2">
                      Overdue Orders
                    </Typography>
                    <Typography variant="h3" fontWeight="bold" color="error.main">
                      {systemHealth.overdueOrders}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" variant="body2">
                      Inactive Agents
                    </Typography>
                    <Typography variant="h3" fontWeight="bold" color="warning.main">
                      {systemHealth.inactiveAgents}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Agent Performance */}
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 3 }}>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <TrendingUp size={24} color="#10b981" />
              <Typography variant="h6" fontWeight="bold">
                Top Performing Agents
              </Typography>
            </Box>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Agent Name</TableCell>
                    <TableCell align="right">Orders</TableCell>
                    <TableCell align="right">Sales</TableCell>
                    <TableCell align="right">Visits</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(metrics?.agentPerformance?.length ?? 0) === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        <Typography color="text.secondary">No agent data available</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    (metrics?.agentPerformance || []).map((agent) => (
                      <TableRow key={agent.id} hover>
                        <TableCell>
                          <Typography fontWeight="medium">{agent.name}</Typography>
                        </TableCell>
                        <TableCell align="right">{agent.order_count}</TableCell>
                        <TableCell align="right">
                          <Typography fontWeight="bold" color="primary">
                            ${(agent.total_sales ?? 0).toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">{agent.visit_count}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* Recent Users */}
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              Recent Users
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell align="center">Role</TableCell>
                    <TableCell align="center">Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(metrics?.recentUsers?.length ?? 0) === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        <Typography color="text.secondary">No users available</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    (metrics?.recentUsers || []).map((user) => (
                      <TableRow key={user.id} hover>
                        <TableCell>
                          <Typography fontWeight="medium">
                            {user.first_name} {user.last_name}
                          </Typography>
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell align="center">
                          <Chip
                            label={user.role}
                            color={getRoleColor(user.role)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={user.status}
                            color={getStatusColor(user.status)}
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
}
