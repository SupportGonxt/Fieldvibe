import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Package, 
  Plus, 
  Search, 
  Filter,
  Download,
  Upload,
  Eye,
  Edit,
  Trash2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  BarChart3,
  MapPin,
  Calendar,
  RefreshCw,
  Archive,
  ShoppingCart,
  Truck,
  DollarSign
} from 'lucide-react'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { inventoryService, InventoryItem, InventoryFilter } from '../../services/inventory.service'
import { formatDate, formatNumber, formatCurrency } from '../../utils/format'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { DataTable } from '../../components/ui/tables/DataTable'
import toast from 'react-hot-toast'

export default function InventoryManagement() {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [showStockAdjustDialog, setShowStockAdjustDialog] = useState(false)
  const [showLocationDialog, setShowLocationDialog] = useState(false)
  const [filter, setFilter] = useState<InventoryFilter>({
    page: 1,
    limit: 20,
    sort_by: 'updated_at',
    sort_order: 'desc'
  })
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showStockModal, setShowStockModal] = useState(false)
  const [stockAdjustment, setStockAdjustment] = useState({ type: 'add', quantity: 0, reason: '' })
  const queryClient = useQueryClient()

  const { data: inventoryData, isLoading, error, refetch } = useQuery({
    queryKey: ['inventory-items', filter],
    queryFn: () => inventoryService.getInventoryItems(filter),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  })

  const { data: rawStats } = useQuery({
    queryKey: ['inventory-stats'],
    queryFn: () => inventoryService.getInventoryStats(),
    staleTime: 1000 * 60 * 10,
    retry: 1,
  })

  const stats = rawStats ? {
    total_items: rawStats.total_items ?? 0,
    total_value: rawStats.total_value ?? 0,
    low_stock_items: rawStats.low_stock_items ?? 0,
    out_of_stock_items: rawStats.out_of_stock_items ?? 0,
    total_locations: rawStats.total_locations ?? 0,
  } : null

  const { data: locations } = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: () => inventoryService.getLocations(),
    staleTime: 1000 * 60 * 30,
    retry: 1,
  })

  const items = inventoryData?.items || []
  const pagination = inventoryData?.pagination || {}

  const adjustStockMutation = useMutation({
    mutationFn: ({ id, adjustment }: { id: string; adjustment: any }) => 
      inventoryService.adjustStock(id, adjustment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-stats'] })
      toast.success('Stock adjusted successfully')
      setShowStockModal(false)
      setStockAdjustment({ type: 'add', quantity: 0, reason: '' })
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to adjust stock')
    }
  })

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => inventoryService.deleteInventoryItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-stats'] })
      toast.success('Item deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete item')
    }
  })

  const bulkUpdateMutation = useMutation({
    mutationFn: ({ ids, updates }: { ids: string[]; updates: any }) => 
      inventoryService.bulkUpdateItems(ids, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
      toast.success('Items updated successfully')
      setSelectedItems([])
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update items')
    }
  })

  const getStockStatusBadge = (item: InventoryItem) => {
    const currentStock = item.current_stock || 0
    const minStock = item.minimum_stock || 0
    const maxStock = item.maximum_stock || 0

    if (currentStock === 0) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
        <AlertTriangle className="w-3 h-3 mr-1" />
        OUT OF STOCK
      </span>
    }
    
    if (currentStock <= minStock) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
        <AlertTriangle className="w-3 h-3 mr-1" />
        LOW STOCK
      </span>
    }
    
    if (maxStock && currentStock >= maxStock) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        OVERSTOCK
      </span>
    }
    
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
      IN STOCK
    </span>
  }

  const getMovementTrend = (item: any) => {
    // Calculate trend based on current vs minimum stock
    const current = item.current_stock || 0
    const minimum = item.minimum_stock || 0
    const trend = current - minimum
    
    if (trend > minimum * 0.5) {
      return <TrendingUp className="w-4 h-4 text-green-500" />
    } else if (trend < 0) {
      return <TrendingDown className="w-4 h-4 text-red-500" />
    }
    return <div className="w-4 h-4" />
  }

  const handleViewDetails = async (id: string) => {
    try {
      const item = await inventoryService.getInventoryItem(id)
      setSelectedItem(item)
      setShowDetailsModal(true)
    } catch (error) {
      toast.error('Failed to load item details')
    }
  }

  const handleStockAdjustment = (item: InventoryItem) => {
    setSelectedItem(item)
    setShowStockModal(true)
  }

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id)
  }

  const confirmDelete = () => {
    if (deleteConfirmId) {
      deleteItemMutation.mutate(deleteConfirmId)
      setDeleteConfirmId(null)
    }
  }

  const handleExport = () => {
    inventoryService.exportInventoryReport('excel', filter)
    toast.success('Export started - file will download shortly')
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.csv,.xlsx'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        try {
          await inventoryService.importInventoryItems(file)
          queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
          toast.success('Import completed successfully')
        } catch (error) {
          toast.error('Import failed')
        }
      }
    }
    input.click()
  }

  const handleBulkStockAdjustment = () => {
    if (selectedItems.length === 0) return
    setShowStockAdjustDialog(true)
  }

  const confirmBulkStockAdjustment = (input?: string) => {
    setShowStockAdjustDialog(false)
    if (!input) return
    const parts = input.split(',')
    const quantity = parseInt(parts[0]?.trim() || '0')
    if (isNaN(quantity)) return
    const reason = parts[1]?.trim() || 'Bulk adjustment'
    bulkUpdateMutation.mutate({
      ids: selectedItems,
      updates: { stock_adjustment: { quantity, reason } }
    })
  }

  const handleBulkLocationUpdate = () => {
    if (selectedItems.length === 0) return
    setShowLocationDialog(true)
  }

  const confirmBulkLocationUpdate = (locationId?: string) => {
    setShowLocationDialog(false)
    if (!locationId) return
    bulkUpdateMutation.mutate({
      ids: selectedItems,
      updates: { location_id: locationId }
    })
  }

  const columns = [
    {
      key: 'product_name',
      title: 'Product',
      render: (value: any, row: any) => (
        <div className="flex items-center">
          {row.product_image && (
            <img 
              src={row.product_image} 
              alt={row.product_name}
              className="w-10 h-10 rounded-lg object-cover mr-3"
            />
          )}
          <div>
            <div className="font-medium text-gray-900">{row.product_name}</div>
            <div className="text-sm text-gray-500">{row.product_code}</div>
          </div>
        </div>
      )
    },
    {
      key: 'location_name',
      title: 'Location',
      render: (value: any, row: any) => (
        <div className="flex items-center">
          <MapPin className="w-4 h-4 text-gray-400 mr-1" />
          <span className="text-sm text-gray-900">{row.location_name || 'N/A'}</span>
        </div>
      )
    },
    {
      key: 'current_stock',
      title: 'Current Stock',
      render: (value: any, row: any) => (
        <div className="text-center">
          <div className="font-medium text-gray-900">{formatNumber(row.current_stock || 0)}</div>
          <div className="text-xs text-gray-500">
            Min: {row.minimum_stock || 0} | Max: {row.maximum_stock || 'N/A'}
          </div>
        </div>
      )
    },
    {
      key: 'stock_status',
      title: 'Status',
      render: (value: any, row: any) => getStockStatusBadge(row)
    },
    {
      key: 'stock_value',
      title: 'Value',
      render: (value: any, row: any) => (
        <div className="text-right">
          <div className="font-medium text-gray-900">
            {formatCurrency((row.current_stock || 0) * (row.unit_cost || 0))}
          </div>
          <div className="text-xs text-gray-500">
            @ {formatCurrency(row.unit_cost || 0)}/unit
          </div>
        </div>
      )
    },
    {
      key: 'movement_trend',
      title: 'Trend',
      render: (value: any, row: any) => (
        <div className="flex items-center justify-center">
          {getMovementTrend(row)}
        </div>
      )
    },
    {
      key: 'updated_at',
      title: 'Last Updated',
      render: (value: any, row: any) => (
        <div className="text-sm text-gray-900">
          {formatDate(row.updated_at)}
        </div>
      )
    },
    {
      key: 'actions',
      title: 'Actions',
      render: (value: any, row: any) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleViewDetails(row.id)}
            className="text-blue-600 hover:text-blue-900"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleStockAdjustment(row)}
            className="text-green-600 hover:text-green-900"
            title="Adjust Stock"
          >
            <Package className="w-4 h-4" />
          </button>
          <button
            onClick={() => window.open(`/inventory/${row.id}/movements`, '_blank')}
            className="text-purple-600 hover:text-purple-900"
            title="View Movements"
          >
            <BarChart3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => window.open(`/inventory/${row.id}/edit`, '_blank')}
            className="text-blue-600 hover:text-blue-900"
            title="Edit"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(row.id)}
            className="text-red-600 hover:text-red-900"
            title="Delete"
            disabled={deleteItemMutation.isPending}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-gray-600">Manage stock levels, locations, and inventory movements</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-outline flex items-center space-x-2"
          >
            <Filter className="w-4 h-4" />
            <span>Filters</span>
          </button>
          <button
            onClick={handleImport}
            className="btn-outline flex items-center space-x-2"
          >
            <Upload className="w-4 h-4" />
            <span>Import</span>
          </button>
          <button
            onClick={handleExport}
            className="btn-outline flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
          <button
            onClick={() => window.open('/inventory/create', '_blank')}
            className="btn-primary flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Item</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="p-3 rounded-lg bg-blue-100">
                  <Package className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Items</p>
                <p className="text-2xl font-semibold text-gray-900">{formatNumber(stats.total_items)}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="p-3 rounded-lg bg-green-100">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Value</p>
                <p className="text-2xl font-semibold text-gray-900">{formatCurrency(stats.total_value)}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="p-3 rounded-lg bg-red-100">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Low Stock</p>
                <p className="text-2xl font-semibold text-gray-900">{formatNumber(stats.low_stock_items)}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="p-3 rounded-lg bg-yellow-100">
                  <Archive className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Out of Stock</p>
                <p className="text-2xl font-semibold text-gray-900">{formatNumber(stats.out_of_stock_items)}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="p-3 rounded-lg bg-purple-100">
                  <MapPin className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Locations</p>
                <p className="text-2xl font-semibold text-gray-900">{formatNumber(stats.total_locations)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search products..."
                  className="input pl-10"
                  value={filter.search || ''}
                  onChange={(e) => setFilter({ ...filter, search: e.target.value, page: 1 })}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <select
                className="input"
                value={filter.location_id || ''}
                onChange={(e) => setFilter({ ...filter, location_id: e.target.value || undefined, page: 1 })}
              >
                <option value="">All Locations</option>
                {(locations || []).map((location: any) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stock Status
              </label>
              <select
                className="input"
                value={filter.stock_status || ''}
                onChange={(e) => setFilter({ ...filter, stock_status: e.target.value || undefined, page: 1 })}
              >
                <option value="">All Status</option>
                <option value="in_stock">In Stock</option>
                <option value="low_stock">Low Stock</option>
                <option value="out_of_stock">Out of Stock</option>
                <option value="overstock">Overstock</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                className="input"
                value={filter.category || ''}
                onChange={(e) => setFilter({ ...filter, category: e.target.value || undefined, page: 1 })}
              >
                <option value="">All Categories</option>
                <option value="beverages">Beverages</option>
                <option value="snacks">Snacks</option>
                <option value="dairy">Dairy</option>
                <option value="frozen">Frozen</option>
                <option value="household">Household</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="card">
        <DataTable
          data={items}
          columns={columns}
          title="Inventory Items"
          searchable={true}
          exportable={true}
          pagination={true}
          pageSize={filter.limit || 20}
        />
      </div>

      {/* Bulk Actions */}
      {selectedItems.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-lg border p-4">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-700">
              {selectedItems.length} selected
            </span>
            <button
              onClick={handleBulkStockAdjustment}
              className="btn-primary btn-sm"
            >
              Adjust Stock
            </button>
            <button
              onClick={handleBulkLocationUpdate}
              className="btn-outline btn-sm"
            >
              Update Location
            </button>
            <button
              onClick={() => setSelectedItems([])}
              className="btn-outline btn-sm"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {showStockModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Adjust Stock</h2>
              <button
                onClick={() => setShowStockModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="font-medium text-gray-900">{selectedItem.product_name}</p>
                <p className="text-sm text-gray-500">Current stock: {selectedItem.current_stock}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adjustment Type
                </label>
                <select
                  className="input"
                  value={stockAdjustment.type}
                  onChange={(e) => setStockAdjustment({ ...stockAdjustment, type: e.target.value })}
                >
                  <option value="add">Add Stock</option>
                  <option value="remove">Remove Stock</option>
                  <option value="set">Set Stock Level</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  className="input"
                  value={stockAdjustment.quantity}
                  onChange={(e) => setStockAdjustment({ ...stockAdjustment, quantity: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason
                </label>
                <textarea
                  className="input"
                  rows={3}
                  value={stockAdjustment.reason}
                  onChange={(e) => setStockAdjustment({ ...stockAdjustment, reason: e.target.value })}
                  placeholder="Reason for stock adjustment..."
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowStockModal(false)}
                className="btn-outline"
              >
                Cancel
              </button>
              <button
                onClick={() => adjustStockMutation.mutate({ 
                  id: selectedItem.id, 
                  adjustment: stockAdjustment 
                })}
                className="btn-primary"
                disabled={adjustStockMutation.isPending}
              >
                {adjustStockMutation.isPending ? 'Adjusting...' : 'Adjust Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Inventory Item Details</h2>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Product Information</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Product Name</label>
                    <p className="text-gray-900">{selectedItem.product_name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Product Code</label>
                    <p className="text-gray-900">{selectedItem.product_code}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Location</label>
                    <p className="text-gray-900">{selectedItem.warehouse_name || selectedItem.van_code || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Status</label>
                    <div className="mt-1">{getStockStatusBadge(selectedItem)}</div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Stock Information</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Current Stock</label>
                    <p className="text-gray-900">{formatNumber(selectedItem.current_stock || 0)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Minimum Stock</label>
                    <p className="text-gray-900">{formatNumber(selectedItem.minimum_stock || 0)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Maximum Stock</label>
                    <p className="text-gray-900">{formatNumber(selectedItem.maximum_stock || 0)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Unit Cost</label>
                    <p className="text-gray-900">{formatCurrency(selectedItem.unit_cost || 0)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Total Value</label>
                    <p className="text-gray-900">
                      {formatCurrency((selectedItem.current_stock || 0) * (selectedItem.unit_cost || 0))}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => handleStockAdjustment(selectedItem)}
                className="btn-primary"
              >
                Adjust Stock
              </button>
              <button
                onClick={() => window.open(`/inventory/${selectedItem.id}/movements`, '_blank')}
                className="btn-outline"
              >
                View Movements
              </button>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="btn-outline"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={confirmDelete}
        title="Delete Inventory Item"
        message="Are you sure you want to delete this inventory item? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />

      <ConfirmDialog
        isOpen={showStockAdjustDialog}
        onClose={() => setShowStockAdjustDialog(false)}
        onConfirm={confirmBulkStockAdjustment}
        title="Bulk Stock Adjustment"
        message={`Adjust stock for ${selectedItems.length} selected item(s). Enter quantity and reason separated by comma (e.g. "+10, Restock").`}
        confirmLabel="Apply Adjustment"
        variant="warning"
        showReasonInput
        reasonPlaceholder="e.g. +10, Restock delivery"
        reasonRequired
      />

      <ConfirmDialog
        isOpen={showLocationDialog}
        onClose={() => setShowLocationDialog(false)}
        onConfirm={confirmBulkLocationUpdate}
        title="Update Location"
        message={`Update location for ${selectedItems.length} selected item(s).`}
        confirmLabel="Update Location"
        variant="info"
        showReasonInput
        reasonPlaceholder="Enter new location ID..."
        reasonRequired
      />
    </div>
  )
}
