import { useState, useEffect } from 'react'
import ReportPage from '../../../components/reports/ReportPage'
import { reportsService } from '../../../services/reports.service'

export default function FieldOperationsProductivityReport() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<Record<string, any>>({ period: 'mtd' })

  useEffect(() => {
    loadReport()
  }, [filters])

  const loadReport = async () => {
    setLoading(true)
    try {
      const response = await reportsService.getFieldOperationsReport('productivity', filters)
      setData(Array.isArray(response.data) ? response.data : (response.data?.data || []))
    } catch (error) {
      console.error('Failed to load field operations productivity report:', error)
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    { key: 'agent_name', label: 'Agent', type: 'text' as const },
    { key: 'total_visits', label: 'Total Visits', type: 'number' as const },
    { key: 'completed_visits', label: 'Completed', type: 'number' as const },
    { key: 'completion_rate', label: 'Completion %', type: 'percentage' as const },
    { key: 'avg_visit_duration', label: 'Avg Duration (min)', type: 'number' as const },
    { key: 'total_orders', label: 'Orders', type: 'number' as const },
    { key: 'total_revenue', label: 'Revenue', type: 'currency' as const },
    { key: 'commission_earned', label: 'Commission', type: 'currency' as const }
  ]

  const reportFilters = [
    {
      key: 'agent_type',
      label: 'Agent Type',
      type: 'select' as const,
      options: [
        { value: 'all', label: 'All Agents' },
        { value: 'field_agent', label: 'Field Agent' },
        { value: 'van_sales', label: 'Van Sales' },
        { value: 'merchandiser', label: 'Merchandiser' }
      ]
    },
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
    }
  ]

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    try {
      await reportsService.exportReport('field-operations', 'productivity', format, filters)
    } catch (error) {
      console.error('Failed to export report:', error)
    }
  }

  return (
    <ReportPage
      title="Field Operations Productivity Report"
      description="Track agent performance and productivity metrics"
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
