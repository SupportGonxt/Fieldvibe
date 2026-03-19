import { useState, useEffect } from 'react'
import ReportPage from '../../../components/reports/ReportPage'
import { reportsService } from '../../../services/reports.service'

export default function CommissionSummaryReport() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<Record<string, any>>({ period: 'mtd' })

  useEffect(() => {
    loadReport()
  }, [filters])

  const loadReport = async () => {
    setLoading(true)
    try {
      const response = await reportsService.getFinanceReport('commission-summary', filters)
      setData(Array.isArray(response.data) ? response.data : (response.data?.data || []))
    } catch (error) {
      console.error('Failed to load commission summary report:', error)
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    { key: 'agent_name', label: 'Agent', type: 'text' as const },
    { key: 'agent_type', label: 'Type', type: 'text' as const },
    { key: 'total_sales', label: 'Total Sales', type: 'currency' as const },
    { key: 'commission_rate', label: 'Rate %', type: 'percentage' as const },
    { key: 'commission_earned', label: 'Commission Earned', type: 'currency' as const },
    { key: 'commission_paid', label: 'Paid', type: 'currency' as const },
    { key: 'commission_pending', label: 'Pending', type: 'currency' as const },
    { key: 'last_payout_date', label: 'Last Payout', type: 'date' as const }
  ]

  const reportFilters = [
    {
      key: 'agent_type',
      label: 'Agent Type',
      type: 'select' as const,
      options: [
        { value: 'all', label: 'All Types' },
        { value: 'field_agent', label: 'Field Agent' },
        { value: 'van_sales', label: 'Van Sales' },
        { value: 'merchandiser', label: 'Merchandiser' }
      ]
    },
    {
      key: 'payout_status',
      label: 'Payout Status',
      type: 'select' as const,
      options: [
        { value: 'all', label: 'All Status' },
        { value: 'pending', label: 'Pending' },
        { value: 'approved', label: 'Approved' },
        { value: 'paid', label: 'Paid' }
      ]
    }
  ]

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    try {
      await reportsService.exportReport('finance', 'commission-summary', format, filters)
    } catch (error) {
      console.error('Failed to export report:', error)
    }
  }

  return (
    <ReportPage
      title="Commission Summary Report"
      description="Overview of agent commissions earned and paid"
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
