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
  ShoppingCart,
  Package,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { apiClient as api } from '../../services/api.service'
import ErrorState from '../../components/ui/ErrorState'
import EmptyState from '../../components/ui/EmptyState'

interface OrderMetrics {
  totalOrders: number
  pending: number
  confirmed: number
  delivered: number
  cancelled: number
  totalValue: number
  averageValue: number
  todayOrders: number
  todayValue: number
  recentOrders: Array<{
    id: string
    order_number: string
    order_date: string
    delivery_date: string
    total_amount: number
    order_status: string
    payment_status: string
    customer_name: string
    customer_phone: string
    agent_name: string
  }>
  trends: Array<{
    date: string
    count: number
    value: number
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

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'delivered':
    case 'paid':
      return 'success'
    case 'confirmed':
      return 'info'
    case 'pending':
    case 'partial':
      return 'warning'
    case 'cancelled':
    case 'rejected':
      return 'error'
    default:
      return 'default'
  }
}

export default function OrderDashboard() {
  const [metrics, setMetrics] = useState<OrderMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchMetrics()
  }, [])

  const fetchMetrics = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await api.get('/dashboard/orders')
      if (response.data.success) {
        setMetrics(response.data.data)
      } else {
        throw new Error(response.data.error?.message || 'Failed to fetch order metrics')
      }
    } catch (err: any) {
      console.error('Error fetching order metrics:', err)
      setError(err.message || 'Failed to load order dashboard')
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
        <Alert severity="warning">No order data available</Alert>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Orders Dashboard
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Monitor order status, trends, and performance
      </Typography>

      <Grid container spacing={3}>
        {/* Top Metrics */}
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Orders"
            value={metrics.totalOrders.toLocaleString()}
            icon={<ShoppingCart size={24} color="#3b82f6" />}
            color="#3b82f6"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Pending Orders"
            value={metrics.pending.toLocaleString()}
            icon={<Clock size={24} color="#f59e0b" />}
            color="#f59e0b"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Delivered Orders"
            value={metrics.delivered.toLocaleString()}
            icon={<CheckCircle size={24} color="#10b981" />}
            color="#10b981"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Cancelled Orders"
            value={metrics.cancelled.toLocaleString()}
            icon={<XCircle size={24} color="#ef4444" />}
            color="#ef4444"
          />
        </Grid>

        {/* Additional Metrics */}
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Order Value"
            value={`$${metrics.totalValue.toLocaleString()}`}
            icon={<DollarSign size={24} color="#8b5cf6" />}
            color="#8b5cf6"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Average Order Value"
            value={`$${metrics.averageValue.toLocaleString()}`}
            icon={<Package size={24} color="#06b6d4" />}
            color="#06b6d4"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Today's Orders"
            value={metrics.todayOrders.toLocaleString()}
            icon={<ShoppingCart size={24} color="#10b981" />}
            color="#10b981"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Today's Revenue"
            value={`$${metrics.todayValue.toLocaleString()}`}
            icon={<DollarSign size={24} color="#10b981" />}
            color="#10b981"
          />
        </Grid>

        {/* Order Trends Chart */}
        {metrics.trends.length > 0 && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Order Trends (Last 7 Days)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Daily order count and revenue
              </Typography>
              <Box sx={{ height: 300, mt: 2 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metrics.trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="count"
                      stackId="1"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      fillOpacity={0.6}
                      name="Orders"
                    />
                    <Area
                      yAxisId="right"
                      type="monotone"
                      dataKey="value"
                      stackId="2"
                      stroke="#10b981"
                      fill="#10b981"
                      fillOpacity={0.6}
                      name="Revenue"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
          </Grid>
        )}

        {/* Recent Orders Table */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              Recent Orders
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Latest orders across all customers
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Order Number</TableCell>
                    <TableCell>Customer</TableCell>
                    <TableCell>Agent</TableCell>
                    <TableCell>Order Date</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell align="center">Order Status</TableCell>
                    <TableCell align="center">Payment Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(metrics?.recentOrders?.length ?? 0) === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        <Typography color="text.secondary">No orders available</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    (metrics?.recentOrders || []).map((order) => (
                      <TableRow key={order.id} hover>
                        <TableCell>
                          <Typography fontWeight="medium">{order.order_number}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography>{order.customer_name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {order.customer_phone || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>{order.agent_name || 'N/A'}</TableCell>
                        <TableCell>
                          {new Date(order.order_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell align="right">
                          <Typography fontWeight="bold" color="primary">
                            ${order.total_amount.toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={order.order_status}
                            color={getStatusColor(order.order_status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={order.payment_status}
                            color={getStatusColor(order.payment_status)}
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
