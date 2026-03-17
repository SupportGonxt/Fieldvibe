import { useState, useEffect } from 'react'
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  CreditCard,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import { apiClient as api } from '../../services/api.service'
import ErrorState from '../../components/ui/ErrorState'
import EmptyState from '../../components/ui/EmptyState'

interface FinanceMetrics {
  totalRevenue: number
  revenueChange: number
  outstandingInvoices: number
  overduePayments: number
  cashFlow: number
  cashFlowChange: number
  accountsReceivable: number
  accountsPayable: number
  profitMargin: number
  collectionRate: number
}

const fallbackMetrics: FinanceMetrics = {
  totalRevenue: 0,
  revenueChange: 0,
  outstandingInvoices: 0,
  overduePayments: 0,
  cashFlow: 0,
  cashFlowChange: 0,
  accountsReceivable: 0,
  accountsPayable: 0,
  profitMargin: 0,
  collectionRate: 0,
}

const FinanceDashboard = () => {
  const [metrics, setMetrics] = useState<FinanceMetrics>(fallbackMetrics)
  const [loading, setLoading] = useState(true)
  const [usingFallback, setUsingFallback] = useState(false)

  useEffect(() => {
    fetchFinanceMetrics()
  }, [])

  const fetchFinanceMetrics = async () => {
    try {
      setLoading(true)
      const response = await api.get('/dashboard/finance')
      if (response.data.success) {
        setMetrics(response.data.data)
      } else {
        setUsingFallback(true)
      }
    } catch (err: any) {
      console.error('Finance dashboard error:', err)
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
        Finance Dashboard
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={3}>
        Monitor financial health, cash flow, and payment status
      </Typography>

      {usingFallback && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Finance data is not yet available. Showing default values. Create invoices and record payments to populate this dashboard.
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Revenue */}
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Revenue (MTD)"
            value={formatCurrency(metrics.totalRevenue)}
            change={metrics.revenueChange}
            icon={DollarSign}
            color="#10b981"
          />
        </Grid>

        {/* Cash Flow */}
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Cash Flow"
            value={formatCurrency(metrics.cashFlow)}
            change={metrics.cashFlowChange}
            icon={TrendingUp}
            color="#3b82f6"
          />
        </Grid>

        {/* Outstanding Invoices */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="body2">
                    Outstanding Invoices
                  </Typography>
                  <Typography variant="h4" component="div" fontWeight="bold">
                    {metrics.outstandingInvoices}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mt={1}>
                    {formatCurrency(metrics.accountsReceivable)} total
                  </Typography>
                </Box>
                <Box sx={{ backgroundColor: '#fef3c7', borderRadius: 2, p: 1 }}>
                  <Clock size={24} color="#f59e0b" />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Overdue Payments */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="body2">
                    Overdue Payments
                  </Typography>
                  <Typography variant="h4" component="div" fontWeight="bold" color="error.main">
                    {metrics.overduePayments}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mt={1}>
                    Requires immediate action
                  </Typography>
                </Box>
                <Box sx={{ backgroundColor: '#fee2e2', borderRadius: 2, p: 1 }}>
                  <AlertCircle size={24} color="#ef4444" />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Accounts Receivable */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom variant="body2">
                Accounts Receivable
              </Typography>
              <Typography variant="h5" component="div" fontWeight="bold">
                {formatCurrency(metrics.accountsReceivable)}
              </Typography>
              <Box display="flex" alignItems="center" mt={1}>
                <CheckCircle size={16} color="#10b981" />
                <Typography variant="body2" color="success.main" ml={0.5}>
                  {formatPercentage(metrics.collectionRate)} collected
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Accounts Payable */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom variant="body2">
                Accounts Payable
              </Typography>
              <Typography variant="h5" component="div" fontWeight="bold">
                {formatCurrency(metrics.accountsPayable)}
              </Typography>
              <Typography variant="body2" color="text.secondary" mt={1}>
                Due to vendors
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Profit Margin */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom variant="body2">
                Profit Margin
              </Typography>
              <Typography variant="h5" component="div" fontWeight="bold" color="success.main">
                {formatPercentage(metrics.profitMargin)}
              </Typography>
              <Typography variant="body2" color="text.secondary" mt={1}>
                Gross margin (MTD)
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Collection Rate */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom variant="body2">
                Payment Collection Rate
              </Typography>
              <Typography variant="h5" component="div" fontWeight="bold">
                {formatPercentage(metrics.collectionRate)}
              </Typography>
              <Typography variant="body2" color="text.secondary" mt={1}>
                On-time payments
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                Quick Actions
              </Typography>
              <Grid container spacing={2} mt={1}>
                <Grid item>
                  <Box
                    component="button"
                    sx={{
                      px: 3,
                      py: 1.5,
                      backgroundColor: 'primary.main',
                      color: 'white',
                      border: 'none',
                      borderRadius: 1,
                      cursor: 'pointer',
                      '&:hover': {
                        backgroundColor: 'primary.dark',
                      },
                    }}
                  >
                    Create Invoice
                  </Box>
                </Grid>
                <Grid item>
                  <Box
                    component="button"
                    sx={{
                      px: 3,
                      py: 1.5,
                      backgroundColor: 'secondary.main',
                      color: 'white',
                      border: 'none',
                      borderRadius: 1,
                      cursor: 'pointer',
                      '&:hover': {
                        backgroundColor: 'secondary.dark',
                      },
                    }}
                  >
                    Record Payment
                  </Box>
                </Grid>
                <Grid item>
                  <Box
                    component="button"
                    sx={{
                      px: 3,
                      py: 1.5,
                      backgroundColor: '#f59e0b',
                      color: 'white',
                      border: 'none',
                      borderRadius: 1,
                      cursor: 'pointer',
                      '&:hover': {
                        opacity: 0.9,
                      },
                    }}
                  >
                    View Aging Report
                  </Box>
                </Grid>
                <Grid item>
                  <Box
                    component="button"
                    sx={{
                      px: 3,
                      py: 1.5,
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: 1,
                      cursor: 'pointer',
                      '&:hover': {
                        opacity: 0.9,
                      },
                    }}
                  >
                    Follow Up Overdue
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                Recent Invoices
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Last 5 invoices created
              </Typography>
              <Box mt={2}>
                <Alert severity="info">
                  Invoice list will be integrated with backend API
                </Alert>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Aging Report Preview */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                Accounts Receivable Aging
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Outstanding payments by age
              </Typography>
              <Box mt={2}>
                <Alert severity="info">
                  AR Aging chart will be integrated with backend API
                </Alert>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}

export default FinanceDashboard
