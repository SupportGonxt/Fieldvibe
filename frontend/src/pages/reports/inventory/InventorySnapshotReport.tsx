import { useState, useEffect } from 'react'
import ReportPage from '../../../components/reports/ReportPage'
import { reportsService } from '../../../services/reports.service'

export default function InventorySnapshotReport() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<Record<string, any>>({})

  useEffect(() => {
    loadReport()
  }, [filters])

  const loadReport = async () => {
    setLoading(true)
    try {
      const response = await reportsService.getInventoryReport('snapshot', filters)
      setData(Array.isArray(response.data) ? response.data : (response.data?.data || []))
    } catch (error) {
      console.error('Failed to load inventory snapshot report:', error)
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    { key: 'product_code', label: 'Product Code', type: 'text' as const },
    { key: 'product_name', label: 'Product Name', type: 'text' as const },
    { key: 'warehouse', label: 'Warehouse', type: 'text' as const },
    { key: 'current_stock', label: 'Current Stock', type: 'number' as const },
    { key: 'reserved_stock', label: 'Reserved', type: 'number' as const },
    { key: 'available_stock', label: 'Available', type: 'number' as const },
    { key: 'reorder_level', label: 'Reorder Level', type: 'number' as const },
    { key: 'stock_value', label: 'Stock Value', type: 'currency' as const },
    { key: 'last_movement_date', label: 'Last Movement', type: 'date' as const }
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
      key: 'category',
      label: 'Category',
      type: 'select' as const,
      options: [
        { value: 'all', label: 'All Categories' },
        { value: 'beverages', label: 'Beverages' },
        { value: 'snacks', label: 'Snacks' },
        { value: 'tobacco', label: 'Tobacco' }
      ]
    },
    {
      key: 'stock_status',
      label: 'Stock Status',
      type: 'select' as const,
      options: [
        { value: 'all', label: 'All Status' },
        { value: 'in_stock', label: 'In Stock' },
        { value: 'low_stock', label: 'Low Stock' },
        { value: 'out_of_stock', label: 'Out of Stock' }
      ]
    }
  ]

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    try {
      await reportsService.exportReport('inventory', 'snapshot', format, filters)
    } catch (error) {
      console.error('Failed to export report:', error)
    }
  }

  return (
    <ReportPage
      title="Inventory Snapshot Report"
      description="Current inventory levels across all warehouses"
      columns={columns}
      filters={reportFilters}
      data={data}
      loading={loading}
      onRefresh={loadReport}
      onExport={handleExport}
      onFilterChange={setFilters}
      showPeriodSelector={false}
    />
  )
}
