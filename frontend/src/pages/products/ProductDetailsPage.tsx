import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit2, Package, DollarSign, TrendingUp, TrendingDown, BarChart3, ShoppingCart, AlertCircle, CheckCircle, Image as ImageIcon, Save, X, Plus } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import ErrorState from '../../components/ui/ErrorState'
import toast from 'react-hot-toast'

interface Product {
  id: string
  sku: string
  name: string
  description: string
  category: string
  brand: string
  unitPrice: number
  costPrice: number
  unit: string
  stockQuantity: number
  reorderLevel: number
  status: 'active' | 'inactive' | 'discontinued'
  images: string[]
  createdAt: string
  totalSales: number
  totalRevenue: number
  avgOrderValue: number
}

interface StockHistory {
  date: string
  quantity: number
  type: 'in' | 'out'
  reference: string
}

interface SalesData {
  month: string
  sales: number
  revenue: number
}

export default function ProductDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState<Product | null>(null)
  const [stockHistory, setStockHistory] = useState<StockHistory[]>([])
  const [salesData, setSalesData] = useState<SalesData[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Product>>({})

  useEffect(() => {
    fetchProductDetails()
  }, [id])

  const fetchProductDetails = async () => {
    if (!id) {
      console.error('No product ID provided')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      
      // Fetch product details from API
      const productResponse = await productsService.getProduct(id)
      if (!productResponse) {
        throw new Error('Product not found')
      }
      
      setProduct(productResponse)
      setEditForm(productResponse)

      // Fetch stock history from API
      try {
        const stockHistoryResponse = await productsService.getStockHistory(id)
        setStockHistory(stockHistoryResponse || [])
      } catch (error) {
        console.error('Failed to fetch stock history:', error)
        setStockHistory([])
      }

      // Fetch sales data from API
      try {
        const salesDataResponse = await productsService.getProductSalesData(id)
        setSalesData(salesDataResponse || [])
      } catch (error) {
        console.error('Failed to fetch sales data:', error)
        setSalesData([])
      }
    } catch (error) {
      console.error('Failed to fetch product details:', error)
      // In production, don't use mock data - show error to user
      if (import.meta.env.PROD || import.meta.env.VITE_ENABLE_MOCK_DATA === 'false') {
        setProduct(null)
        setStockHistory([])
        setSalesData([])
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setProduct({ ...product!, ...editForm })
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to update product:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'inactive': return 'bg-gray-100 text-gray-800'
      case 'discontinued': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStockStatus = () => {
    if (!product) return { status: 'unknown', color: 'gray', icon: AlertCircle }
    if (product.stockQuantity === 0) return { status: 'Out of Stock', color: 'red', icon: AlertCircle }
    if (product.stockQuantity <= product.reorderLevel) return { status: 'Low Stock', color: 'yellow', icon: AlertCircle }
    return { status: 'In Stock', color: 'green', icon: CheckCircle }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Product not found</h3>
        <button onClick={() => navigate('/products')} className="btn btn-primary mt-4">
          Back to Products
        </button>
      </div>
    )
  }

  const stockStatus = getStockStatus()
  const StockIcon = stockStatus.icon
  const profitMargin = ((product.unitPrice - product.costPrice) / product.unitPrice * 100).toFixed(1)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/products')} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
            <p className="text-sm text-gray-600">SKU: {product.sku} | Category: {product.category}</p>
          </div>
          <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(product.status)}`}>
            {product.status.toUpperCase()}
          </span>
        </div>
        <div className="flex gap-3">
          {isEditing ? (
            <>
              <button onClick={() => setIsEditing(false)} className="btn btn-secondary flex items-center gap-2">
                <X className="w-4 h-4" /> Cancel
              </button>
              <button onClick={handleSave} className="btn btn-primary flex items-center gap-2">
                <Save className="w-4 h-4" /> Save Changes
              </button>
            </>
          ) : (
            <button onClick={() => setIsEditing(true)} className="btn btn-primary flex items-center gap-2">
              <Edit2 className="w-4 h-4" /> Edit Product
            </button>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center gap-4">
            <div className={`p-3 bg-${stockStatus.color}-100 rounded-lg`}>
              <StockIcon className={`w-6 h-6 text-${stockStatus.color}-600`} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Stock Level</p>
              <p className="text-2xl font-bold text-gray-900">{product.stockQuantity}</p>
              <p className={`text-xs text-${stockStatus.color}-600`}>{stockStatus.status}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <ShoppingCart className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Sales</p>
              <p className="text-2xl font-bold text-gray-900">{product.totalSales.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">${product.totalRevenue.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Profit Margin</p>
              <p className="text-2xl font-bold text-gray-900">{profitMargin}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-100">
        <nav className="-mb-px flex space-x-8">
          {['overview', 'stock', 'analytics', 'pricing'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Product Information */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Product Information</h3>
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                  <input
                    type="text"
                    value={editForm.name || ''}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={editForm.description || ''}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <input
                      type="text"
                      value={editForm.category || ''}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                    <input
                      type="text"
                      value={editForm.brand || ''}
                      onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Description</p>
                  <p className="text-sm font-medium text-gray-900">{product.description}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Category</p>
                    <p className="text-sm font-medium text-gray-900">{product.category}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Brand</p>
                    <p className="text-sm font-medium text-gray-900">{product.brand}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Unit</p>
                    <p className="text-sm font-medium text-gray-900">{product.unit}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Created</p>
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(product.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Pricing Information */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Pricing Information</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Unit Price</p>
                  <p className="text-2xl font-bold text-blue-600">${product.unitPrice.toFixed(2)}</p>
                </div>
                <div className="p-4 bg-orange-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Cost Price</p>
                  <p className="text-2xl font-bold text-orange-600">${product.costPrice.toFixed(2)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Profit per Unit</p>
                  <p className="text-2xl font-bold text-green-600">
                    ${(product.unitPrice - product.costPrice).toFixed(2)}
                  </p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Margin</p>
                  <p className="text-2xl font-bold text-purple-600">{profitMargin}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Product Image */}
          <div className="card lg:col-span-2">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Product Images</h3>
            <div className="flex items-center justify-center h-48 bg-gray-100 rounded-lg">
              <div className="text-center">
                <ImageIcon className="w-16 h-16 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">No images available</p>
                <button onClick={() => toast.success('View full history')} className="btn btn-secondary mt-4 flex items-center gap-2 mx-auto">
                  <Plus className="w-4 h-4" /> Upload Image
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'stock' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card">
              <h4 className="text-sm font-medium text-gray-600 mb-2">Current Stock</h4>
              <p className="text-3xl font-bold text-gray-900">{product.stockQuantity}</p>
            </div>
            <div className="card">
              <h4 className="text-sm font-medium text-gray-600 mb-2">Reorder Level</h4>
              <p className="text-3xl font-bold text-orange-600">{product.reorderLevel}</p>
            </div>
            <div className="card">
              <h4 className="text-sm font-medium text-gray-600 mb-2">Stock Value</h4>
              <p className="text-3xl font-bold text-green-600">
                ${(product.stockQuantity * product.costPrice).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Stock Movement History</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-surface-secondary">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {stockHistory.map((entry, index) => (
                    <tr key={index} className="hover:bg-surface-secondary">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {new Date(entry.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          entry.type === 'in' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {entry.type === 'in' ? 'Stock In' : 'Stock Out'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-right">
                        <span className={entry.type === 'in' ? 'text-green-600' : 'text-red-600'}>
                          {entry.type === 'in' ? '+' : '-'}{entry.quantity}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{entry.reference}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Sales Trend (Last 6 Months)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="sales" stroke="#3B82F6" name="Units Sold" />
                <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#10B981" name="Revenue ($)" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Month</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" fill="#10B981" name="Revenue ($)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === 'pricing' && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Pricing Analysis</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-surface-secondary rounded-lg">
                <span className="text-sm text-gray-600">List Price</span>
                <span className="text-lg font-semibold text-gray-900">${product.unitPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-surface-secondary rounded-lg">
                <span className="text-sm text-gray-600">Cost Price</span>
                <span className="text-lg font-semibold text-gray-900">${product.costPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
                <span className="text-sm text-gray-600">Profit per Unit</span>
                <span className="text-lg font-semibold text-green-600">
                  ${(product.unitPrice - product.costPrice).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
                <span className="text-sm text-gray-600">Average Order Value</span>
                <span className="text-lg font-semibold text-blue-600">${product.avgOrderValue.toLocaleString()}</span>
              </div>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-purple-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Profit Margin</p>
                <p className="text-3xl font-bold text-purple-600">{profitMargin}%</p>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-purple-600 h-2 rounded-full"
                    style={{ width: `${profitMargin}%` }}
                  />
                </div>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Total Profit</p>
                <p className="text-3xl font-bold text-green-600">
                  ${((product.unitPrice - product.costPrice) * product.totalSales).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
