import { useState, useEffect } from 'react'
import ReportPage from '../../../components/reports/ReportPage'
import { reportsService } from '../../../services/reports.service'

export default function SalesExceptionsReport() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<Record<string, any>>({ period: 'mtd' })

  useEffect(() => {
    loadReport()
  }, [filters])

  const loadReport = async () => {
    setLoading(true)
    try {
      const response = await reportsService.getSalesReport('exceptions', filters)
      setData(Array.isArray(response.data) ? response.data : (response.data?.data || []))
    } catch (error) {
      console.error('Failed to load sales exceptions report:', error)
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    { key: 'order_number', label: 'Order #', type: 'text' as const },
    { key: 'customer_name', label: 'Customer', type: 'text' as const },
    { key: 'order_date', label: 'Order Date', type: 'date' as const },
    { key: 'exception_type', label: 'Exception Type', type: 'text' as const },
    { key: 'order_amount', label: 'Amount', type: 'currency' as const },
    { key: 'status', label: 'Status', type: 'text' as const },
    { key: 'days_overdue', label: 'Days Overdue', type: 'number' as const }
  ]

  const reportFilters = [
    {
      key: 'exception_type',
      label: 'Exception Type',
      type: 'select' as const,
      options: [
        { value: 'all', label: 'All Exceptions' },
        { value: 'overdue_payment', label: 'Overdue Payment' },
        { value: 'credit_limit_exceeded', label: 'Credit Limit Exceeded' },
        { value: 'large_discount', label: 'Large Discount' },
        { value: 'cancelled_order', label: 'Cancelled Order' },
        { value: 'return_requested', label: 'Return Requested' }
      ]
    },
    {
      key: 'severity',
      label: 'Severity',
      type: 'select' as const,
      options: [
        { value: 'all', label: 'All Severities' },
        { value: 'high', label: 'High' },
        { value: 'medium', label: 'Medium' },
        { value: 'low', label: 'Low' }
      ]
    }
  ]

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    try {
      await reportsService.exportReport('sales', 'exceptions', format, filters)
    } catch (error) {
      console.error('Failed to export report:', error)
    }
  }

  return (
    <ReportPage
      title="Sales Exceptions Report"
      description="Identify and track sales exceptions requiring attention"
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
