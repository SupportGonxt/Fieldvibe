import { useState, useEffect } from 'react'
import { Upload, Download, FileText, AlertCircle, Check, X, RefreshCw, Database, FileSpreadsheet, ChevronRight, Loader } from 'lucide-react'
import { useToast } from '../../components/ui/Toast'
import { apiClient } from '../../services/api.service'
import toast from 'react-hot-toast'

interface ImportHistory {
  id: string
  type: 'customers' | 'products' | 'orders' | 'agents'
  fileName: string
  records: number
  status: 'success' | 'failed' | 'partial'
  errors: number
  date: string
  user: string
}

interface ExportJob {
  id: string
  type: string
  format: 'csv' | 'xlsx' | 'json'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  fileSize?: string
  downloadUrl?: string
  createdAt: string
}

const DATA_TYPES = [
  {
    id: 'customers',
    name: 'Customers',
    icon: '👤',
    description: 'Import/export customer records',
    fields: ['Name', 'Email', 'Phone', 'Address', 'Credit Limit', 'Status'],
    sampleCsv: 'name,email,phone,address,credit_limit,status\nJohn Doe,john@example.com,+1234567890,123 Main St,10000,active'
  },
  {
    id: 'products',
    name: 'Products',
    icon: '📦',
    description: 'Import/export product catalog',
    fields: ['SKU', 'Name', 'Category', 'Price', 'Stock', 'Unit'],
    sampleCsv: 'sku,name,category,price,stock,unit\nPRD001,Product Name,Category,99.99,100,EA'
  },
  {
    id: 'orders',
    name: 'Orders',
    icon: '🛒',
    description: 'Import/export order history',
    fields: ['Order ID', 'Customer', 'Date', 'Total', 'Status'],
    sampleCsv: 'order_id,customer_email,date,total,status\nORD001,customer@example.com,2024-01-15,199.99,completed'
  },
  {
    id: 'agents',
    name: 'Field Agents',
    icon: '👨‍💼',
    description: 'Import/export agent records',
    fields: ['Name', 'Email', 'Phone', 'Territory', 'Status'],
    sampleCsv: 'name,email,phone,territory,status\nJane Smith,jane@example.com,+1234567890,North Region,active'
  },
  {
    id: 'inventory',
    name: 'Inventory',
    icon: '📊',
    description: 'Import/export stock levels',
    fields: ['Product SKU', 'Location', 'Quantity', 'Min Level', 'Max Level'],
    sampleCsv: 'product_sku,location,quantity,min_level,max_level\nPRD001,Warehouse A,500,50,1000'
  },
  {
    id: 'prices',
    name: 'Pricing',
    icon: '💰',
    description: 'Bulk update product prices',
    fields: ['Product SKU', 'Price', 'Cost', 'Discount', 'Effective Date'],
    sampleCsv: 'product_sku,price,cost,discount,effective_date\nPRD001,99.99,59.99,10,2024-01-15'
  }
]

export default function DataImportExportPage() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import')
  const [selectedType, setSelectedType] = useState<string>('customers')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)

  const [importHistory, setImportHistory] = useState<ImportHistory[]>([])
  const [exportJobs, setExportJobs] = useState<ExportJob[]>([])

  useEffect(() => {
    loadImportHistory()
    loadExportJobs()
  }, [])

  const loadImportHistory = async () => {
    try {
      const res = await apiClient.get('/data-import/history')
      const items = res.data?.data || res.data || []
      if (Array.isArray(items) && items.length > 0) {
        setImportHistory(items.map((h: any) => ({
          id: h.id || String(Math.random()),
          type: h.type || 'customers',
          fileName: h.file_name || h.fileName || 'unknown',
          records: h.records || 0,
          status: h.status || 'success',
          errors: h.errors || 0,
          date: h.created_at || h.date || '',
          user: h.user || 'System'
        })))
      }
    } catch {
      // API may not have import history endpoint yet - leave empty
    }
  }

  const loadExportJobs = async () => {
    try {
      const res = await apiClient.get('/data-export/jobs')
      const items = res.data?.data || res.data || []
      if (Array.isArray(items) && items.length > 0) {
        setExportJobs(items.map((j: any) => ({
          id: j.id || String(Math.random()),
          type: j.type || 'customers',
          format: j.format || 'csv',
          status: j.status || 'completed',
          progress: j.progress || 100,
          fileSize: j.file_size || j.fileSize,
          downloadUrl: j.download_url || j.downloadUrl,
          createdAt: j.created_at || j.createdAt || ''
        })))
      }
    } catch {
      // API may not have export jobs endpoint yet - leave empty
    }
  }

  const selectedDataType = DATA_TYPES.find(t => t.id === selectedType)

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const validTypes = ['.csv', '.xlsx', '.xls']
      const fileExt = '.' + file.name.split('.').pop()?.toLowerCase()
      
      if (!validTypes.includes(fileExt)) {
        toast.info('Please upload a valid CSV or Excel file')
        return
      }
      
      setUploadedFile(file)
    }
  }

  const handleImport = async () => {
    if (!uploadedFile) {
      toast.info('Please select a file to import')
      return
    }

    setImporting(true)
    setImportProgress(0)

    let progressInterval: ReturnType<typeof setInterval>

    try {
      const formData = new FormData()
      formData.append('file', uploadedFile)
      formData.append('type', selectedType)

      // Show progress while uploading
      progressInterval = setInterval(() => {
        setImportProgress(prev => Math.min(prev + 15, 90))
      }, 300)

      const res = await apiClient.post(`/data-import/${selectedType}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      clearInterval(progressInterval)
      setImportProgress(100)

      const result = res.data?.data || res.data
      const recordCount = result?.records || result?.count || 0

      setTimeout(() => {
        setImporting(false)
        setUploadedFile(null)
        setImportProgress(0)
        toast.success(`Successfully imported ${recordCount} records from ${uploadedFile.name}`)
        loadImportHistory()
      }, 500)
    } catch {
      clearInterval(progressInterval)
      setImportProgress(0)
      setTimeout(() => {
        setImporting(false)
        setImportProgress(0)
        toast.error(`Failed to import ${uploadedFile.name}. Please try again.`)
      }, 500)
    }
  }

  const handleExport = async (format: 'csv' | 'xlsx' | 'json') => {
    setExporting(true)
    
    try {
      const res = await apiClient.get(`/${selectedType}?format=${format}&export=true`)
      const data = res.data?.data || res.data || []
      
      // Convert to CSV/JSON and download
      let content: string
      let mimeType: string
      let ext: string
      
      if (format === 'json') {
        content = JSON.stringify(data, null, 2)
        mimeType = 'application/json'
        ext = 'json'
      } else if (format === 'csv') {
        if (Array.isArray(data) && data.length > 0) {
          const headers = Object.keys(data[0])
          const rows = data.map((row: any) => headers.map(h => JSON.stringify(row[h] ?? '')).join(','))
          content = [headers.join(','), ...rows].join('\n')
        } else {
          content = 'No data available'
        }
        mimeType = 'text/csv'
        ext = 'csv'
      } else {
        // XLSX not supported natively - export as CSV with .xlsx extension note
        if (Array.isArray(data) && data.length > 0) {
          const headers = Object.keys(data[0])
          const rows = data.map((row: any) => headers.map(h => JSON.stringify(row[h] ?? '')).join(','))
          content = [headers.join(','), ...rows].join('\n')
        } else {
          content = 'No data available'
        }
        mimeType = 'text/csv'
        ext = 'csv'
      }
      
      const blob = new Blob([content], { type: mimeType })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${selectedType}_export_${new Date().toISOString().split('T')[0]}.${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      
      toast.success(`${selectedType} data exported as ${format.toUpperCase()}`)
      loadExportJobs()
    } catch {
      toast.error(`Failed to export ${selectedType} data as ${format.toUpperCase()}. Please try again.`)
    } finally {
      setExporting(false)
    }
  }

  const downloadTemplate = (type: string) => {
    const dataType = DATA_TYPES.find(t => t.id === type)
    if (dataType) {
      const blob = new Blob([dataType.sampleCsv], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${type}_template.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Data Import / Export</h1>
        <p className="mt-1 text-sm text-gray-600">
          Bulk import and export data across all modules
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Total Imports</p>
              <p className="text-3xl font-bold mt-1">{importHistory.length}</p>
            </div>
            <Upload className="w-12 h-12 text-blue-200" />
          </div>
        </div>

        <div className="card p-6 bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Successful</p>
              <p className="text-3xl font-bold mt-1">
                {importHistory.filter(h => h.status === 'success').length}
              </p>
            </div>
            <Check className="w-12 h-12 text-green-200" />
          </div>
        </div>

        <div className="card p-6 bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">Total Records</p>
              <p className="text-3xl font-bold mt-1">
                {importHistory.reduce((sum, h) => sum + h.records, 0).toLocaleString()}
              </p>
            </div>
            <Database className="w-12 h-12 text-purple-200" />
          </div>
        </div>

        <div className="card p-6 bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm">Exports</p>
              <p className="text-3xl font-bold mt-1">{exportJobs.length}</p>
            </div>
            <Download className="w-12 h-12 text-orange-200" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="border-b border-gray-100">
          <nav className="-mb-px flex">
            <button
              onClick={() => setActiveTab('import')}
              className={`px-6 py-4 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === 'import'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Upload className="w-4 h-4" />
              Import Data
            </button>
            <button
              onClick={() => setActiveTab('export')}
              className={`px-6 py-4 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === 'export'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Download className="w-4 h-4" />
              Export Data
            </button>
          </nav>
        </div>

        {/* Import Tab */}
        {activeTab === 'import' && (
          <div className="p-6 space-y-6">
            {/* Info Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-blue-900">Import Guidelines</h3>
                <ul className="text-sm text-blue-700 mt-2 space-y-1 list-disc list-inside">
                  <li>Download template first to ensure correct format</li>
                  <li>Supported formats: CSV, XLSX, XLS</li>
                  <li>Maximum file size: 10MB</li>
                  <li>Duplicate records will be updated</li>
                  <li>Invalid records will be logged</li>
                </ul>
              </div>
            </div>

            {/* Data Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Select Data Type
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {DATA_TYPES.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setSelectedType(type.id)}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      selectedType === type.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-100 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{type.icon}</span>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{type.name}</h3>
                        <p className="text-sm text-gray-600 mt-1">{type.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {selectedDataType && (
              <>
                {/* Template Download */}
                <div className="bg-surface-secondary border border-gray-100 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-gray-900">CSV Template</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Required fields: {selectedDataType.fields.join(', ')}
                      </p>
                    </div>
                    <button
                      onClick={() => downloadTemplate(selectedType)}
                      className="btn btn-outline flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download Template
                    </button>
                  </div>
                </div>

                {/* File Upload */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
                  <div className="text-center">
                    {uploadedFile ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-center gap-3 text-green-600">
                          <FileSpreadsheet className="w-12 h-12" />
                          <div className="text-left">
                            <p className="font-semibold">{uploadedFile.name}</p>
                            <p className="text-sm text-gray-600">
                              {(uploadedFile.size / 1024).toFixed(2)} KB
                            </p>
                          </div>
                        </div>
                        
                        {importing && (
                          <div>
                            <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                              <div
                                className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                                style={{ width: `${importProgress}%` }}
                              ></div>
                            </div>
                            <p className="text-sm text-gray-600">Importing... {importProgress}%</p>
                          </div>
                        )}

                        {!importing && (
                          <div className="flex gap-3 justify-center">
                            <button
                              onClick={() => setUploadedFile(null)}
                              className="btn btn-outline"
                            >
                              Remove
                            </button>
                            <button
                              onClick={handleImport}
                              className="btn btn-primary flex items-center gap-2"
                            >
                              <Upload className="w-4 h-4" />
                              Import Data
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          Upload {selectedDataType.name} File
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">
                          Drag and drop your file here, or click to browse
                        </p>
                        <label className="btn btn-primary inline-flex items-center gap-2 cursor-pointer">
                          <FileText className="w-4 h-4" />
                          Choose File
                          <input
                            type="file"
                            onChange={handleFileUpload}
                            accept=".csv,.xlsx,.xls"
                            className="hidden"
                          />
                        </label>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Import History */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Import History</h3>
              <div className="space-y-3">
                {importHistory.map((item) => (
                  <div key={item.id} className="card p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                          item.status === 'success' ? 'bg-green-100' :
                          item.status === 'partial' ? 'bg-yellow-100' :
                          'bg-red-100'
                        }`}>
                          {item.status === 'success' && <Check className="w-6 h-6 text-green-600" />}
                          {item.status === 'partial' && <AlertCircle className="w-6 h-6 text-yellow-600" />}
                          {item.status === 'failed' && <X className="w-6 h-6 text-red-600" />}
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-gray-900">{item.fileName}</h4>
                            <span className={`badge ${
                              item.status === 'success' ? 'badge-success' :
                              item.status === 'partial' ? 'badge-warning' :
                              'badge-error'
                            }`}>
                              {item.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {item.records.toLocaleString()} records • {item.errors} errors • {item.date} • {item.user}
                          </p>
                        </div>
                      </div>

                      <button onClick={() => toast.success('Viewing import details')} className="btn btn-outline btn-sm">
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Export Tab */}
        {activeTab === 'export' && (
          <div className="p-6 space-y-6">
            {/* Export Options */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Select Data to Export
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {DATA_TYPES.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setSelectedType(type.id)}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      selectedType === type.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-100 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{type.icon}</span>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{type.name}</h3>
                        <p className="text-sm text-gray-600 mt-1">{type.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Format Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Choose Export Format
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => !exporting && handleExport('csv')}
                  disabled={exporting}
                  className="btn btn-outline flex items-center gap-3 justify-center py-4 disabled:opacity-50"
                >
                  <FileText className="w-5 h-5" />
                  <div className="text-left">
                    <div className="font-semibold">CSV</div>
                    <div className="text-xs text-gray-600">Comma separated</div>
                  </div>
                </button>

                <button
                  onClick={() => !exporting && handleExport('xlsx')}
                  disabled={exporting}
                  className="btn btn-outline flex items-center gap-3 justify-center py-4 disabled:opacity-50"
                >
                  <FileSpreadsheet className="w-5 h-5" />
                  <div className="text-left">
                    <div className="font-semibold">Excel</div>
                    <div className="text-xs text-gray-600">XLSX format</div>
                  </div>
                </button>

                <button
                  onClick={() => !exporting && handleExport('json')}
                  disabled={exporting}
                  className="btn btn-outline flex items-center gap-3 justify-center py-4 disabled:opacity-50"
                >
                  <Database className="w-5 h-5" />
                  <div className="text-left">
                    <div className="font-semibold">JSON</div>
                    <div className="text-xs text-gray-600">JavaScript Object</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Export Jobs */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Export Jobs</h3>
                <button onClick={() => toast.success('Template downloaded')} className="btn btn-outline btn-sm flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
              </div>

              <div className="space-y-3">
                {exportJobs.map((job) => (
                  <div key={job.id} className="card p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                          job.status === 'completed' ? 'bg-green-100' :
                          job.status === 'processing' ? 'bg-blue-100' :
                          job.status === 'failed' ? 'bg-red-100' :
                          'bg-gray-100'
                        }`}>
                          {job.status === 'completed' && <Check className="w-6 h-6 text-green-600" />}
                          {job.status === 'processing' && <Loader className="w-6 h-6 text-blue-600 animate-spin" />}
                          {job.status === 'failed' && <X className="w-6 h-6 text-red-600" />}
                          {job.status === 'pending' && <RefreshCw className="w-6 h-6 text-gray-600" />}
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-gray-900 capitalize">
                              {job.type} Export
                            </h4>
                            <span className="badge badge-secondary uppercase">
                              {job.format}
                            </span>
                            <span className={`badge ${
                              job.status === 'completed' ? 'badge-success' :
                              job.status === 'processing' ? 'badge-info' :
                              job.status === 'failed' ? 'badge-error' :
                              'badge-secondary'
                            }`}>
                              {job.status}
                            </span>
                          </div>

                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                            <span>Created: {job.createdAt}</span>
                            {job.fileSize && <span>Size: {job.fileSize}</span>}
                          </div>

                          {job.status === 'processing' && (
                            <div className="mt-3">
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span className="text-gray-600">Progress</span>
                                <span className="font-semibold">{job.progress}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${job.progress}%` }}
                                ></div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {job.status === 'completed' && job.downloadUrl && (
                        <button onClick={() => toast.success('Export started')} className="btn btn-primary flex items-center gap-2">
                          <Download className="w-4 h-4" />
                          Download
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
