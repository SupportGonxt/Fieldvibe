import { useState, useEffect } from 'react'
import ReportPage from '../../../components/reports/ReportPage'
import { reportsService } from '../../../services/reports.service'

export default function SalesSummaryReport() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<Record<string, any>>({ period: 'mtd' })

  useEffect(() => {
    loadReport()
  }, [filters])

  const loadReport = async () => {
    setLoading(true)
    try {
      const response = await reportsService.getSalesReport('summary', filters)
      setData(Array.isArray(response.data) ? response.data : (response.data?.data || []))
    } catch (error) {
      console.error('Failed to load sales summary report:', error)
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    { key: 'period', label: 'Period', type: 'text' as const },
    { key: 'total_orders', label: 'Total Orders', type: 'number' as const },
    { key: 'total_revenue', label: 'Revenue', type: 'currency' as const },
    { key: 'total_customers', label: 'Customers', type: 'number' as const },
    { key: 'avg_order_value', label: 'Avg Order Value', type: 'currency' as const },
    { key: 'growth_rate', label: 'Growth %', type: 'percentage' as const }
  ]

  const reportFilters = [
    {
      key: 'region',
      label: 'Region',
      type: 'select' as const,
      options: [
        { value: 'all', label: 'All Regions' },
        { value: 'gauteng', label: 'Gauteng' },
        { value: 'western_cape', label: 'Western Cape' },
        { value: 'kwazulu_natal', label: 'KwaZulu-Natal' }
      ]
    },
    {
      key: 'customer_type',
      label: 'Customer Type',
      type: 'select' as const,
      options: [
        { value: 'all', label: 'All Types' },
        { value: 'retailer', label: 'Retailer' },
        { value: 'wholesaler', label: 'Wholesaler' },
        { value: 'distributor', label: 'Distributor' }
      ]
    }
  ]

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    try {
      await reportsService.exportReport('sales', 'summary', format, filters)
    } catch (error) {
      console.error('Failed to export report:', error)
    }
  }

  return (
    <ReportPage
      title="Sales Summary Report"
      description="Overview of sales performance with key metrics and trends"
      columns={columns}
      filters={reportFilters}
      data={data}
      loading={loading}
      onRefresh={loadReport}
      onExport={handleExport}
      onFilterChange={setFilters}
      showPeriodSelector={true}
    />
  )
}
