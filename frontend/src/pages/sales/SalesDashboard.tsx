import { useState, useEffect } from 'react'
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  LinearProgress,
} from '@mui/material'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Target,
  Award,
} from 'lucide-react'
import { apiClient as api } from '../../services/api.service'
import ErrorState from '../../components/ui/ErrorState'
import EmptyState from '../../components/ui/EmptyState'

interface SalesMetrics {
  totalSales: number
  salesChange: number
  totalOrders: number
  ordersChange: number
  averageOrderValue: number
  aovChange: number
  conversionRate: number
  salesTarget: number
  salesAchieved: number
  targetProgress: number
  pendingOrders: number
  fulfilledOrders: number
}

const fallbackMetrics: SalesMetrics = {
  totalSales: 0,
  salesChange: 0,
  totalOrders: 0,
  ordersChange: 0,
  averageOrderValue: 0,
  aovChange: 0,
  conversionRate: 0,
  salesTarget: 0,
  salesAchieved: 0,
  targetProgress: 0,
  pendingOrders: 0,
  fulfilledOrders: 0,
}

const SalesDashboard = () => {
  const [metrics, setMetrics] = useState<SalesMetrics>(fallbackMetrics)
  const [loading, setLoading] = useState(true)
  const [usingFallback, setUsingFallback] = useState(false)

  useEffect(() => {
    fetchSalesMetrics()
  }, [])

  const fetchSalesMetrics = async () => {
    try {
      setLoading(true)
      const response = await api.get('/sales-orders/dashboard')
      const raw = response.data?.data || response.data
      if (raw) {
        setMetrics({
          totalSales: raw.totalSales || raw.total_revenue || raw.month_revenue || 0,
          salesChange: raw.salesChange || 0,
          totalOrders: raw.totalOrders || raw.total_orders || raw.month_orders || 0,
          ordersChange: raw.ordersChange || 0,
          averageOrderValue: raw.averageOrderValue || (raw.total_revenue && raw.total_orders ? raw.total_revenue / raw.total_orders : 0),
          aovChange: raw.aovChange || 0,
          conversionRate: raw.conversionRate || 0,
          salesTarget: raw.salesTarget || 0,
          salesAchieved: raw.salesAchieved || raw.total_revenue || 0,
          targetProgress: raw.targetProgress || 0,
          pendingOrders: raw.pendingOrders || raw.pending_orders || 0,
          fulfilledOrders: raw.fulfilledOrders || raw.fulfilled_orders || 0,
        })
      } else {
        setUsingFallback(true)
      }
    } catch (err: any) {
      console.error('Sales dashboard error:', err)
      setUsingFallback(true)
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatPercentage = (value: number) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
  }

  const MetricCard = ({ title, value, change, icon: Icon, color }: any) => (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography color="text.secondary" gutterBottom variant="body2">
              {title}
            </Typography>
            <Typography variant="h4" component="div" fontWeight="bold">
              {value}
            </Typography>
            {change !== undefined && (
              <Box display="flex" alignItems="center" mt={1}>
                {change > 0 ? (
                  <TrendingUp size={16} color="green" />
                ) : (
                  <TrendingDown size={16} color="red" />
                )}
                <Typography
                  variant="body2"
                  color={change > 0 ? 'success.main' : 'error.main'}
                  ml={0.5}
                >
                  {formatPercentage(change)}
                </Typography>
                <Typography variant="body2" color="text.secondary" ml={0.5}>
                  vs last month
                </Typography>
              </Box>
            )}
          </Box>
          <Box
            sx={{
              backgroundColor: `${color}.50`,
              borderRadius: 2,
              p: 1,
            }}
          >
            <Icon size={24} color={color} />
          </Box>
        </Box>
      </CardContent>
    </Card>
  )

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Sales Dashboard
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={3}>
        Track sales performance, orders, and revenue targets
      </Typography>

      {usingFallback && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Sales data is not yet available. Showing default values. Create orders to populate this dashboard.
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Sales (MTD)"
            value={formatCurrency(metrics.totalSales)}
            change={metrics.salesChange}
            icon={DollarSign}
            color="#10b981"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Orders"
            value={metrics.totalOrders.toLocaleString()}
            change={metrics.ordersChange}
            icon={ShoppingCart}
            color="#3b82f6"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Average Order Value"
            value={formatCurrency(metrics.averageOrderValue)}
            change={metrics.aovChange}
            icon={Target}
            color="#f59e0b"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="body2">
                    Conversion Rate
                  </Typography>
                  <Typography variant="h4" component="div" fontWeight="bold" color="success.main">
                    {metrics.conversionRate.toFixed(1)}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mt={1}>
                    Leads to orders
                  </Typography>
                </Box>
                <Box sx={{ backgroundColor: '#dcfce7', borderRadius: 2, p: 1 }}>
                  <Award size={24} color="#10b981" />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="body2">
                    Monthly Sales Target
                  </Typography>
                  <Typography variant="h5" component="div" fontWeight="bold">
                    {formatCurrency(metrics.salesAchieved)} / {formatCurrency(metrics.salesTarget)}
                  </Typography>
                </Box>
                <Box textAlign="right">
                  <Typography variant="h4" fontWeight="bold" color="primary.main">
                    {metrics.targetProgress.toFixed(1)}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    achieved
                  </Typography>
                </Box>
              </Box>
              <LinearProgress
                variant="determinate"
                value={metrics.targetProgress}
                sx={{
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: '#e5e7eb',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: metrics.targetProgress >= 100 ? '#10b981' : '#3b82f6',
                  },
                }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                Order Status
              </Typography>
              <Grid container spacing={2} mt={1}>
                <Grid item xs={6}>
                  <Box p={2} sx={{ backgroundColor: '#dbeafe', borderRadius: 2 }}>
                    <Typography variant="h4" fontWeight="bold" color="#3b82f6">
                      {metrics.pendingOrders}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Pending Orders
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box p={2} sx={{ backgroundColor: '#dcfce7', borderRadius: 2 }}>
                    <Typography variant="h4" fontWeight="bold" color="#10b981">
                      {metrics.fulfilledOrders}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Fulfilled Orders
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}

export default SalesDashboard
