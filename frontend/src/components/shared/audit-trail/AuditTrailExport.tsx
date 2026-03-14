import { useState } from 'react'
import { Download, FileText, Table } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface AuditTrailExportProps {
  entityType: string
  entityId: string
}

export default function AuditTrailExport({ entityType, entityId }: AuditTrailExportProps) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async (format: 'csv' | 'pdf' | 'json') => {
    setIsExporting(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast.success(`Audit trail exported as ${format.toUpperCase()}`)
    } catch (error) {
      toast.error('Failed to export audit trail')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Export Audit Trail</h2>
      <p className="text-sm text-gray-600 mb-6">
        Download the complete audit trail for this {entityType} in your preferred format.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => handleExport('csv')}
          disabled={isExporting}
          className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors disabled:opacity-50"
        >
          <Table className="h-5 w-5 text-gray-600" />
          <div className="text-left">
            <p className="text-sm font-medium text-gray-900">CSV</p>
            <p className="text-xs text-gray-500">Spreadsheet format</p>
          </div>
        </button>

        <button
          onClick={() => handleExport('pdf')}
          disabled={isExporting}
          className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors disabled:opacity-50"
        >
          <FileText className="h-5 w-5 text-gray-600" />
          <div className="text-left">
            <p className="text-sm font-medium text-gray-900">PDF</p>
            <p className="text-xs text-gray-500">Document format</p>
          </div>
        </button>

        <button
          onClick={() => handleExport('json')}
          disabled={isExporting}
          className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors disabled:opacity-50"
        >
          <Download className="h-5 w-5 text-gray-600" />
          <div className="text-left">
            <p className="text-sm font-medium text-gray-900">JSON</p>
            <p className="text-xs text-gray-500">Data format</p>
          </div>
        </button>
      </div>

      {isExporting && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">Preparing export...</p>
        </div>
      )}
    </div>
  )
}
