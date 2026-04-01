import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { customersService, Customer, CustomerFilter, CustomerStats } from '../../services/customers.service'
import { formatCurrency, formatDate, formatPhoneNumber } from '../../utils/format'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import SearchableSelect from '../../components/ui/SearchableSelect'

export default function CustomersPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<CustomerFilter>({
    page: 1,
    limit: 10,
    sort_by: 'created_at',
    sort_order: 'desc'
  })
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const queryClient = useQueryClient()

  const { data: customersData, isLoading, error, refetch } = useQuery({
    queryKey: ['customers', filter],
    queryFn: () => customersService.getCustomers(filter),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  const { data: stats } = useQuery({
    queryKey: ['customer-stats'],
    queryFn: () => customersService.getCustomerStats(),
    staleTime: 1000 * 60 * 10, // 10 minutes
  })

  const customers = customersData?.customers || []
  const pagination = customersData?.pagination || {}

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const deleteCustomerMutation = useMutation({
    mutationFn: (id: string) => customersService.deleteCustomer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customer-stats'] })
    }
  })

  const getStatusBadge = (status: string) => {
    const statusColors = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      suspended: 'bg-red-100 text-red-800'
    }
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  const getTypeBadge = (type: string) => {
    const typeColors = {
      retail: 'bg-blue-100 text-blue-800',
      wholesale: 'bg-purple-100 text-purple-800',
      distributor: 'bg-orange-100 text-orange-800',
      store: 'bg-teal-100 text-teal-800'
    }
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeColors[type as keyof typeof typeColors] || 'bg-gray-100 text-gray-800'}`}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </span>
    )
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCustomers(customers.map(c => c.id))
    } else {
      setSelectedCustomers([])
    }
  }

  const handleSelectCustomer = (customerId: string, checked: boolean) => {
    if (checked) {
      setSelectedCustomers([...selectedCustomers, customerId])
    } else {
      setSelectedCustomers(selectedCustomers.filter(id => id !== customerId))
    }
  }

  const handleDeleteCustomer = (id: string) => {
    setDeleteConfirmId(id)
  }

  const confirmDeleteCustomer = async () => {
    if (!deleteConfirmId) return
    try {
      await deleteCustomerMutation.mutateAsync(deleteConfirmId)
    } catch (error) {
      console.error('Failed to delete customer:', error)
    }
    setDeleteConfirmId(null)
  }

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    try {
      const blob = await customersService.exportCustomers(filter, format)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `customers.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Failed to export customers:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage your customer database and relationships
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/3 mb-1"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
        
        <div className="card animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage your customer database and relationships
          </p>
        </div>
        
        <div className="card">
          <div className="text-center py-12">
            <div className="text-red-500 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Error Loading Customers
            </h3>
            <p className="text-gray-600 mb-4">
              There was an error loading the customer data.
            </p>
            <button
              onClick={() => refetch()}
              className="btn btn-primary"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage your customer database and relationships ({pagination.total || 0} total)
          </p>
        </div>
        
        <div className="flex space-x-3">
          <button 
            onClick={() => setShowImportModal(true)}
            className="btn btn-secondary"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
            Import
          </button>
          <div className="relative">
            <button onClick={() => handleExport('csv')} className="btn btn-secondary dropdown-toggle">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export
            </button>
          </div>
          <button 
            onClick={() => navigate('/customers/create')}
            className="btn btn-primary"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            New Customer
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Customers</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.total_customers}</p>
                <p className="text-sm text-green-600">{stats.active_customers} active</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Sales</p>
                <p className="text-2xl font-semibold text-gray-900">{formatCurrency(stats.total_sales)}</p>
                <p className="text-sm text-gray-500">All time</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg Order Value</p>
                <p className="text-2xl font-semibold text-gray-900">{formatCurrency(stats.average_order_value)}</p>
                <p className="text-sm text-gray-500">Per order</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H9m0 0H5m4 0V9a2 2 0 011-1h4a2 2 0 011 1v12m-6 0h6" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Customer Types</p>
                <p className="text-2xl font-semibold text-gray-900">{(stats.customers_by_type?.retail || 0) + (stats.customers_by_type?.wholesale || 0)}</p>
                <p className="text-sm text-gray-500">{stats.customers_by_type?.retail || 0} retail, {stats.customers_by_type?.wholesale || 0} wholesale</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              type="text"
              placeholder="Search customers..."
              value={filter.search || ''}
              onChange={(e) => setFilter({ ...filter, search: e.target.value || undefined, page: 1 })}
              className="input"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <SearchableSelect
              options={[
                { value: '', label: 'All Types' },
                { value: 'retail', label: 'Retail' },
                { value: 'wholesale', label: 'Wholesale' },
                { value: 'distributor', label: 'Distributor' },
                { value: 'store', label: 'Store' },
              ]}
              value={filter.type || null}
              onChange={(val) => setFilter({ ...filter, type: val || undefined, page: 1 })}
              placeholder="Filter by type..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <SearchableSelect
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
                { value: 'suspended', label: 'Suspended' },
              ]}
              value={filter.status || null}
              onChange={(val) => setFilter({ ...filter, status: val || undefined, page: 1 })}
              placeholder="Filter by status..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sort By
            </label>
            <SearchableSelect
              options={[
                { value: 'created_at', label: 'Date Created' },
                { value: 'name', label: 'Name' },
                { value: 'total_sales', label: 'Total Sales' },
                { value: 'total_orders', label: 'Total Orders' },
              ]}
              value={filter.sort_by || 'created_at'}
              onChange={(val) => setFilter({ ...filter, sort_by: val || 'created_at', page: 1 })}
              placeholder="Sort by..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Order
            </label>
            <SearchableSelect
              options={[
                { value: 'desc', label: 'Descending' },
                { value: 'asc', label: 'Ascending' },
              ]}
              value={filter.sort_order || 'desc'}
              onChange={(val) => setFilter({ ...filter, sort_order: (val as 'asc' | 'desc') || 'desc', page: 1 })}
              placeholder="Order..."
            />
          </div>
        </div>
      </div>

      {/* Customers Table */}
      <div className="card overflow-hidden">
        {customers.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No customers found</h3>
            <p className="mt-1 text-sm text-gray-500">
              No customers match your current filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-surface-secondary">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedCustomers.length === customers.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Route
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sales
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-surface-secondary">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedCustomers.includes(customer.id)}
                        onChange={(e) => handleSelectCustomer(customer.id, e.target.checked)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {customer.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {customer.code}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getTypeBadge(customer.type)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        {customer.phone && (
                          <div className="text-sm text-gray-900">
                            {formatPhoneNumber(customer.phone)}
                          </div>
                        )}
                        {customer.email && (
                          <div className="text-sm text-gray-500">
                            {customer.email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm text-gray-900">
                          {customer.route_name || 'No Route'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {customer.area_name}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(customer.total_sales)}
                        </div>
                        <div className="text-sm text-gray-500">
                          {customer.total_orders} orders
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(customer.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                        onClick={() => navigate(`/customers/${customer.id}`)}
                        className="text-indigo-600 hover:text-indigo-900 mr-3"
                      >
                        View
                      </button>
                      <button 
                        onClick={() => navigate(`/customers/${customer.id}/edit`)}
                        className="text-gray-600 hover:text-gray-900 mr-3"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleDeleteCustomer(customer.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {((pagination.page || 1) - 1) * (pagination.limit || 10) + 1} to{' '}
            {Math.min((pagination.page || 1) * (pagination.limit || 10), pagination.total || 0)} of {pagination.total || 0} results
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setFilter({ ...filter, page: (filter.page || 1) - 1 })}
              disabled={(filter.page || 1) <= 1}
              className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setFilter({ ...filter, page: (filter.page || 1) + 1 })}
              disabled={(filter.page || 1) >= (pagination.totalPages || 1)}
              className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
      <ConfirmDialog
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={confirmDeleteCustomer}
        title="Delete Customer"
        message="Are you sure you want to delete this customer? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  )
}
