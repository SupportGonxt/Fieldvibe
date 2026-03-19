import { useState, useEffect } from 'react'
import ReportPage from '../../../components/reports/ReportPage'
import { reportsService } from '../../../services/reports.service'

export default function VarianceAnalysisReport() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<Record<string, any>>({ period: 'mtd' })

  useEffect(() => {
    loadReport()
  }, [filters])

  const loadReport = async () => {
    setLoading(true)
    try {
      const response = await reportsService.getInventoryReport('variance-analysis', filters)
      setData(Array.isArray(response.data) ? response.data : (response.data?.data || []))
    } catch (error) {
      console.error('Failed to load variance analysis report:', error)
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    { key: 'product_code', label: 'Product Code', type: 'text' as const },
    { key: 'product_name', label: 'Product Name', type: 'text' as const },
    { key: 'warehouse', label: 'Warehouse', type: 'text' as const },
    { key: 'system_count', label: 'System Count', type: 'number' as const },
    { key: 'physical_count', label: 'Physical Count', type: 'number' as const },
    { key: 'variance_qty', label: 'Variance Qty', type: 'number' as const },
    { key: 'variance_percentage', label: 'Variance %', type: 'percentage' as const },
    { key: 'variance_value', label: 'Variance Value', type: 'currency' as const },
    { key: 'count_date', label: 'Count Date', type: 'date' as const },
    { key: 'counted_by', label: 'Counted By', type: 'text' as const }
  ]

  const reportFilters = [
    {
      key: 'warehouse',
      label: 'Warehouse',
      type: 'select' as const,
      options: [
        { value: 'all', label: 'All Warehouses' },
        { value: 'main', label: 'Main Warehouse' },
        { value: 'regional_1', label: 'Regional 1' },
        { value: 'regional_2', label: 'Regional 2' }
      ]
    },
    {
      key: 'variance_type',
      label: 'Variance Type',
      type: 'select' as const,
      options: [
        { value: 'all', label: 'All Variances' },
        { value: 'positive', label: 'Positive (Surplus)' },
        { value: 'negative', label: 'Negative (Shortage)' },
        { value: 'significant', label: 'Significant (>50%)' }
      ]
    },
    {
      key: 'category',
      label: 'Category',
      type: 'select' as const,
      options: [
        { value: 'all', label: 'All Categories' },
        { value: 'beverages', label: 'Beverages' },
        { value: 'snacks', label: 'Snacks' },
        { value: 'tobacco', label: 'Tobacco' }
      ]
    }
  ]

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    try {
      await reportsService.exportReport('inventory', 'variance-analysis', format, filters)
    } catch (error) {
      console.error('Failed to export report:', error)
    }
  }

  return (
    <ReportPage
      title="Variance Analysis Report"
      description="Analyze stock count variances and identify discrepancies"
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
