import React, { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { productsService } from '../../services/products.service'
import toast from 'react-hot-toast'

export const ProductImportExportPage: React.FC = () => {
  const queryClient = useQueryClient()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [importResults, setImportResults] = useState<{ success: number; errors: any[] } | null>(null)

  const importMutation = useMutation({
    mutationFn: (file: File) => productsService.importProducts(file),
    onSuccess: (data) => {
      setImportResults(data)
      queryClient.invalidateQueries({ queryKey: ['products'] })
      setSelectedFile(null)
    }
  })

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setImportResults(null)
    }
  }

  const handleImport = () => {
    if (selectedFile) {
      importMutation.mutate(selectedFile)
    }
  }

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    try {
      const blob = await productsService.exportProducts({}, format)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `products.${format === 'excel' ? 'xlsx' : format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Product Import/Export</h1>
        <p className="mt-1 text-sm text-gray-500">
          Import products from files or export product data
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Import Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-4">
            <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div className="ml-4">
              <h2 className="text-lg font-medium text-gray-900">Import Products</h2>
              <p className="text-sm text-gray-500">Upload a CSV or Excel file</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
              <div className="text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <div className="mt-4">
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <span className="mt-2 block text-sm font-medium text-blue-600 hover:text-blue-500">
                      Choose a file
                    </span>
                    <input
                      id="file-upload"
                      name="file-upload"
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      className="sr-only"
                      onChange={handleFileSelect}
                    />
                  </label>
                  <p className="mt-1 text-xs text-gray-500">CSV or Excel up to 10MB</p>
                </div>
              </div>
            </div>

            {selectedFile && (
              <div className="bg-surface-secondary rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                      <p className="text-sm text-gray-500">{(selectedFile.size / 1024).toFixed(2)} KB</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={handleImport}
              disabled={!selectedFile || importMutation.isPending}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importMutation.isPending ? 'Importing...' : 'Import Products'}
            </button>

            {importResults && (
              <div className={`rounded-lg p-4 ${
                importResults.errors.length === 0 ? 'bg-green-50' : 'bg-yellow-50'
              }`}>
                <div className="flex">
                  <div className="flex-shrink-0">
                    {importResults.errors.length === 0 ? (
                      <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    )}
                  </div>
                  <div className="ml-3">
                    <h3 className={`text-sm font-medium ${
                      importResults.errors.length === 0 ? 'text-green-800' : 'text-yellow-800'
                    }`}>
                      Import {importResults.errors.length === 0 ? 'Successful' : 'Completed with Errors'}
                    </h3>
                    <div className={`mt-2 text-sm ${
                      importResults.errors.length === 0 ? 'text-green-700' : 'text-yellow-700'
                    }`}>
                      <p>{importResults.success} products imported successfully</p>
                      {importResults.errors.length > 0 && (
                        <p className="mt-1">{importResults.errors.length} errors encountered</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="border-t border-gray-100 pt-4">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Import Template</h3>
              <p className="text-sm text-gray-500 mb-3">
                Download a template file to see the required format
              </p>
              <button onClick={() => toast.success('Template downloaded')} className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                Download Template →
              </button>
            </div>
          </div>
        </div>

        {/* Export Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-4">
            <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
            </div>
            <div className="ml-4">
              <h2 className="text-lg font-medium text-gray-900">Export Products</h2>
              <p className="text-sm text-gray-500">Download product data</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">Export Format</h3>
              <div className="space-y-2">
                <button
                  onClick={() => handleExport('csv')}
                  className="w-full flex items-center justify-between p-4 border border-gray-300 rounded-lg hover:bg-surface-secondary"
                >
                  <div className="flex items-center">
                    <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div className="ml-3 text-left">
                      <p className="text-sm font-medium text-gray-900">CSV File</p>
                      <p className="text-sm text-gray-500">Comma-separated values</p>
                    </div>
                  </div>
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                <button
                  onClick={() => handleExport('excel')}
                  className="w-full flex items-center justify-between p-4 border border-gray-300 rounded-lg hover:bg-surface-secondary"
                >
                  <div className="flex items-center">
                    <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div className="ml-3 text-left">
                      <p className="text-sm font-medium text-gray-900">Excel File</p>
                      <p className="text-sm text-gray-500">Microsoft Excel format</p>
                    </div>
                  </div>
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                <button
                  onClick={() => handleExport('pdf')}
                  className="w-full flex items-center justify-between p-4 border border-gray-300 rounded-lg hover:bg-surface-secondary"
                >
                  <div className="flex items-center">
                    <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <div className="ml-3 text-left">
                      <p className="text-sm font-medium text-gray-900">PDF File</p>
                      <p className="text-sm text-gray-500">Portable document format</p>
                    </div>
                  </div>
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Export Options</h3>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" defaultChecked />
                  <span className="ml-2 text-sm text-gray-700">Include pricing information</span>
                </label>
                <label className="flex items-center">
                  <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" defaultChecked />
                  <span className="ml-2 text-sm text-gray-700">Include stock levels</span>
                </label>
                <label className="flex items-center">
                  <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <span className="ml-2 text-sm text-gray-700">Include product images</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Guidelines */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-sm font-medium text-blue-900 mb-2">Import Guidelines</h3>
        <ul className="list-disc list-inside text-sm text-blue-800 space-y-1">
          <li>Ensure your file includes all required fields: name, SKU, category, price</li>
          <li>Product SKUs must be unique across all products</li>
          <li>Prices should be numeric values in ZAR</li>
          <li>Stock quantities should be whole numbers</li>
          <li>Category and brand must exist in the system before import</li>
          <li>Maximum file size is 10MB</li>
        </ul>
      </div>
    </div>
  )
}
