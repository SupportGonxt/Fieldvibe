import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { productsService } from '../../services/products.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

interface HierarchyNode {
  id: string
  name: string
  type: 'category' | 'subcategory' | 'product'
  product_count?: number
  total_value?: number
  children?: HierarchyNode[]
}

export const ProductHierarchyPage: React.FC = () => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [selectedNode, setSelectedNode] = useState<HierarchyNode | null>(null)

  const { data: productsData, isLoading, isError } = useQuery({
    queryKey: ['products-hierarchy'],
    queryFn: () => productsService.getProducts({ limit: 200 }),
  })

  const mockHierarchy: HierarchyNode[] = (() => {
    const products = productsData?.products || productsData || []
    const categories: Record<string, any> = {}
    products.forEach((p: any) => {
      const cat = p.category_name || p.category || 'Uncategorized'
      if (!categories[cat]) categories[cat] = { id: cat, name: cat, type: 'category' as const, children: [], product_count: 0 }
      categories[cat].children.push({ id: String(p.id), name: p.name, type: 'product' as const, children: [], product_count: 0 })
      categories[cat].product_count++
    })
    return Object.values(categories)
  })()

  if (isLoading) return <LoadingSpinner />


  if (isError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-500 text-lg font-medium">Failed to load data</p>
          <p className="text-gray-500 mt-2">Please try refreshing the page</p>
        </div>
      </div>
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR'
    }).format(amount)
  }

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId)
    } else {
      newExpanded.add(nodeId)
    }
    setExpandedNodes(newExpanded)
  }

  const getNodeIcon = (type: string) => {
    const icons = {
      category: (
        <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      ),
      subcategory: (
        <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      ),
      product: (
        <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      )
    }
    return icons[type as keyof typeof icons] || icons.product
  }

  const renderNode = (node: HierarchyNode, level: number = 0) => {
    const isExpanded = expandedNodes.has(node.id)
    const hasChildren = node.children && node.children.length > 0

    return (
      <div key={node.id} style={{ marginLeft: `${level * 24}px` }}>
        <div
          className={`flex items-center p-3 hover:bg-surface-secondary cursor-pointer rounded-lg ${
            selectedNode?.id === node.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
          }`}
          onClick={() => setSelectedNode(node)}
        >
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleNode(node.id)
              }}
              className="mr-2 focus:outline-none"
            >
              {isExpanded ? (
                <svg className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              ) : (
                <svg className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>
          )}
          {!hasChildren && <div className="w-6 mr-2"></div>}
          <div className="mr-3">{getNodeIcon(node.type)}</div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-900">{node.name}</span>
                <span className="ml-2 text-xs text-gray-500 uppercase">{node.type}</span>
              </div>
              <div className="flex items-center space-x-4 text-sm">
                {node.product_count !== undefined && (
                  <span className="text-gray-600">
                    {node.product_count} {node.product_count === 1 ? 'product' : 'products'}
                  </span>
                )}
                {node.total_value !== undefined && (
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(node.total_value)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        {isExpanded && hasChildren && (
          <div className="mt-1">
            {node.children!.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Product Hierarchy</h1>
          <p className="mt-1 text-sm text-gray-500">
            Navigate through categories, subcategories, and products
          </p>
        </div>
        <div className="flex space-x-2">
          <button className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-surface-secondary">
            Export Hierarchy
          </button>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
            Manage Categories
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Categories</p>
              <p className="text-2xl font-semibold text-gray-900">
                {mockHierarchy.length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Subcategories</p>
              <p className="text-2xl font-semibold text-gray-900">
                {mockHierarchy.reduce((sum, c) => sum + (c.children?.length || 0), 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-purple-100 rounded-md p-3">
              <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Products</p>
              <p className="text-2xl font-semibold text-gray-900">
                {mockHierarchy.reduce((sum, c) => sum + (c.product_count || 0), 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-indigo-100 rounded-md p-3">
              <svg className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Value</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatCurrency(mockHierarchy.reduce((sum, c) => sum + (c.total_value || 0), 0))}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hierarchy Tree */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-medium text-gray-900">Category Tree</h2>
          </div>
          <div className="p-6">
            {mockHierarchy.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No hierarchy data</h3>
                <p className="mt-1 text-sm text-gray-500">Set up your product hierarchy to get started.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {mockHierarchy.map(node => renderNode(node))}
              </div>
            )}
          </div>
        </div>

        {/* Details Panel */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-medium text-gray-900">Details</h2>
          </div>
          <div className="p-6">
            {selectedNode ? (
              <div className="space-y-4">
                <div className="flex items-center">
                  {getNodeIcon(selectedNode.type)}
                  <div className="ml-3">
                    <h3 className="text-lg font-medium text-gray-900">{selectedNode.name}</h3>
                    <p className="text-sm text-gray-500 uppercase">{selectedNode.type}</p>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-4 space-y-3">
                  {selectedNode.product_count !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Products</span>
                      <span className="text-sm font-medium text-gray-900">{selectedNode.product_count}</span>
                    </div>
                  )}
                  {selectedNode.total_value !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Total Value</span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatCurrency(selectedNode.total_value)}
                      </span>
                    </div>
                  )}
                  {selectedNode.children && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Sub-nodes</span>
                      <span className="text-sm font-medium text-gray-900">{selectedNode.children.length}</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-100 pt-4">
                  <button className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                    View Products
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="mt-2 text-sm text-gray-500">Select a node to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
