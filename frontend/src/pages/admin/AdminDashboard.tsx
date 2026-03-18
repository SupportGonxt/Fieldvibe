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
} from '@mui/material'
import {
  Users,
  UserCheck,
  Shield,
  Package,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react'
import { apiClient as api } from '../../services/api.service'
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
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchMetrics()
  }, [])

  const fetchMetrics = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await api.get('/dashboard/admin')
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

  const userActivityRate = metrics.totalUsers > 0
    ? Math.round((metrics.activeUsers / metrics.totalUsers) * 100)
    : 0

  const agentActivityRate = metrics.totalAgents > 0
    ? Math.round((metrics.activeAgents / metrics.totalAgents) * 100)
    : 0

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Admin Dashboard
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        System overview, user management, and agent performance
      </Typography>

      <Grid container spacing={3}>
        {/* System Statistics */}
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Users"
            value={metrics.totalUsers.toLocaleString()}
            subtitle={`${metrics.activeUsers} active`}
            icon={<Users size={24} color="#3b82f6" />}
            color="#3b82f6"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Agents"
            value={metrics.totalAgents.toLocaleString()}
            subtitle={`${metrics.activeAgents} active`}
            icon={<Shield size={24} color="#8b5cf6" />}
            color="#8b5cf6"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Customers"
            value={metrics.totalCustomers.toLocaleString()}
            icon={<UserCheck size={24} color="#10b981" />}
            color="#10b981"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Products"
            value={metrics.totalProducts.toLocaleString()}
            icon={<Package size={24} color="#f59e0b" />}
            color="#f59e0b"
          />
        </Grid>

        {/* Business Metrics */}
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Orders"
            value={metrics.totalOrders.toLocaleString()}
            icon={<ShoppingCart size={24} color="#06b6d4" />}
            color="#06b6d4"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Revenue"
            value={`$${metrics.totalRevenue.toLocaleString()}`}
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
                      {metrics.systemHealth.pendingPayments}
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
                      {metrics.systemHealth.overdueOrders}
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
                      {metrics.systemHealth.inactiveAgents}
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
                            ${agent.total_sales.toLocaleString()}
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
