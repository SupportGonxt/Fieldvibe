/**
 * Enhanced Dashboard Page with Charts
 */

import React, { useEffect, useState } from 'react';
import { Container, Typography, Box, Alert, CircularProgress, Button } from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import Dashboard from '../components/DashboardCharts';
import api from '../services/api';
import ErrorState from '../components/ui/ErrorState'
import EmptyState from '../components/ui/EmptyState'

const DashboardPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch dashboard stats
      const statsResponse = await api.get('/dashboard/stats');
      const stats = statsResponse.data;

      // Transform data for charts
      const kpiData = {
        revenue: {
          value: stats.totalRevenue || 0,
          change: calculateChange(stats.totalRevenue, stats.previousRevenue || 0),
        },
        orders: {
          value: stats.totalOrders || 0,
          change: calculateChange(stats.totalOrders, stats.previousOrders || 0),
        },
        customers: {
          value: stats.totalCustomers || 0,
          change: calculateChange(stats.totalCustomers, stats.previousCustomers || 0),
        },
        products: {
          value: stats.totalProducts || 0,
          change: 0,
        },
      };

      // Fetch revenue data from API
      const revenueResponse = await api.get('/dashboard/revenue-trends');
      const revenueData = revenueResponse.data.data || [];

      // Fetch sales by category from API
      const salesResponse = await api.get('/dashboard/sales-by-category');
      const salesData = salesResponse.data.data || [];

      // Order status distribution from stats
      const orderStatusData = [
        { name: 'Pending', value: stats.pendingOrders || 0, color: '#ff9800' },
        { name: 'Processing', value: stats.processingOrders || 0, color: '#2196f3' },
        { name: 'Shipped', value: stats.shippedOrders || 0, color: '#4caf50' },
        { name: 'Delivered', value: stats.deliveredOrders || 0, color: '#8bc34a' },
        { name: 'Cancelled', value: stats.cancelledOrders || 0, color: '#f44336' },
      ];

      // Fetch top products from API
      const topProductsResponse = await api.get('/dashboard/top-products');
      const topProducts = topProductsResponse.data.data || [];

      setDashboardData({
        kpiData,
        revenueData,
        salesData,
        orderStatusData,
        topProducts,
      });
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch dashboard data');
      console.error('Dashboard data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateChange = (current: number, previous: number): number => {
    if (previous === 0) return 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box
        sx={{
          p: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Box>
          <Typography variant="h4" gutterBottom>
            Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Real-time business insights and analytics
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchDashboardData}
        >
          Refresh
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mx: 3, mb: 2 }}>
          {error}
        </Alert>
      )}

      {dashboardData && <Dashboard {...dashboardData} />}
    </Box>
  );
};

export default DashboardPage;
