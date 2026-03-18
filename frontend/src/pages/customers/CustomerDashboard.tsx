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
} from '@mui/material'
import {
  TrendingUp,
  TrendingDown,
  Users,
  UserPlus,
  Activity,
  UserX,
  DollarSign,
  Target,
  Award,
} from 'lucide-react'
import { apiClient as api } from '../../services/api.service'
import ErrorState from '../../components/ui/ErrorState'
import EmptyState from '../../components/ui/EmptyState'

interface CustomerMetrics {
  totalCustomers: number
  newCustomers: number
  activeCustomers: number
  inactiveCustomers: number
  customerLifetimeValue: number
  churnRate: number
  retentionRate: number
  topCustomers: Array<{
    id: string
    name: string
    email: string
    phone: string
    order_count: number
    total_spent: number
  }>
}

interface MetricCardProps {
  title: string
  value: string | number
  change?: number
  icon: React.ReactNode
  color: string
}

const MetricCard = ({ title, value, change, icon, color }: MetricCardProps) => (
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
          {change !== undefined && (
            <Box display="flex" alignItems="center" gap={0.5}>
              {change >= 0 ? (
                <TrendingUp size={16} color="#10b981" />
              ) : (
                <TrendingDown size={16} color="#ef4444" />
              )}
              <Typography
                variant="body2"
                color={change >= 0 ? 'success.main' : 'error.main'}
              >
                {Math.abs(change)}%
              </Typography>
            </Box>
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

export default function CustomerDashboard() {
  const [metrics, setMetrics] = useState<CustomerMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchMetrics()
  }, [])

  const fetchMetrics = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await api.get('/dashboard/customers')
      if (response.data.success) {
        setMetrics(response.data.data)
      } else {
        throw new Error(response.data.error?.message || 'Failed to fetch customer metrics')
      }
    } catch (err: any) {
      console.error('Error fetching customer metrics:', err)
      setError(err.message || 'Failed to load customer dashboard')
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
        <Alert severity="warning">No customer data available</Alert>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Customer Dashboard
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Monitor customer metrics, engagement, and lifetime value
      </Typography>

      <Grid container spacing={3}>
        {/* Top Metrics */}
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Customers"
            value={metrics.totalCustomers.toLocaleString()}
            icon={<Users size={24} color="#3b82f6" />}
            color="#3b82f6"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="New Customers"
            value={metrics.newCustomers.toLocaleString()}
            icon={<UserPlus size={24} color="#10b981" />}
            color="#10b981"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Active Customers"
            value={metrics.activeCustomers.toLocaleString()}
            icon={<Activity size={24} color="#8b5cf6" />}
            color="#8b5cf6"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Inactive Customers"
            value={metrics.inactiveCustomers.toLocaleString()}
            icon={<UserX size={24} color="#ef4444" />}
            color="#ef4444"
          />
        </Grid>

        {/* Additional Metrics */}
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Customer Lifetime Value"
            value={`$${metrics.customerLifetimeValue.toLocaleString()}`}
            icon={<DollarSign size={24} color="#f59e0b" />}
            color="#f59e0b"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Retention Rate"
            value={`${metrics.retentionRate}%`}
            icon={<Target size={24} color="#10b981" />}
            color="#10b981"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Churn Rate"
            value={`${metrics.churnRate}%`}
            icon={<Award size={24} color="#ef4444" />}
            color="#ef4444"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography color="text.secondary" variant="body2" gutterBottom>
                Active Rate
              </Typography>
              <Typography variant="h4" fontWeight="bold" sx={{ my: 1 }}>
                {metrics.totalCustomers > 0
                  ? Math.round((metrics.activeCustomers / metrics.totalCustomers) * 100)
                  : 0}
                %
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {metrics.activeCustomers} of {metrics.totalCustomers} customers
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Top Customers Table */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              Top Customers
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Highest value customers by total purchase amount
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Customer Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell align="right">Orders</TableCell>
                    <TableCell align="right">Total Spent</TableCell>
                    <TableCell align="center">Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {metrics.topCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography color="text.secondary">No customer data available</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    (metrics?.topCustomers || []).map((customer) => (
                      <TableRow key={customer.id} hover>
                        <TableCell>
                          <Typography fontWeight="medium">{customer.name}</Typography>
                        </TableCell>
                        <TableCell>{customer.email || 'N/A'}</TableCell>
                        <TableCell>{customer.phone || 'N/A'}</TableCell>
                        <TableCell align="right">{customer.order_count}</TableCell>
                        <TableCell align="right">
                          <Typography fontWeight="bold" color="primary">
                            ${customer.total_spent.toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={customer.total_spent > 5000 ? 'VIP' : 'Regular'}
                            color={customer.total_spent > 5000 ? 'primary' : 'default'}
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
