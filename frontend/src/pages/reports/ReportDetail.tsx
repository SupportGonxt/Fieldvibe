import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Edit, Download, Share2, Calendar } from 'lucide-react'
import { reportsService } from '../../services/reports.service'
import ErrorState from '../../components/ui/ErrorState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function ReportDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: report, isLoading, isError } = useQuery({
    queryKey: ['report', id],
    queryFn: () => reportsService.getReport(id!),
  })

  if (isLoading) {
    return <div className="p-6">Loading report details...</div>
  }

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


  if (!report) {
    return <div className="p-6">Report not found</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate('/reports')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Reports
        </button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{report.name}</h1>
            <p className="text-gray-600">{report.description}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/reports/${id}/edit`)}
              className="btn-secondary flex items-center gap-2"
            >
              <Edit className="h-5 w-5" />
              Edit
            </button>
            <button className="btn-primary flex items-center gap-2">
              <Download className="h-5 w-5" />
              Download
            </button>
            <button className="btn-secondary flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Share
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Report Information</h2>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">Report Type</dt>
                <dd className="mt-1 text-sm text-gray-900 capitalize">{report.type}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Format</dt>
                <dd className="mt-1 text-sm text-gray-900">{report.format}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Schedule</dt>
                <dd className="mt-1 text-sm text-gray-900">{report.schedule}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Last Run</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(report.last_run).toLocaleDateString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Created By</dt>
                <dd className="mt-1 text-sm text-gray-900">{report.created_by}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Created Date</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(report.created_at).toLocaleDateString()}
                </dd>
              </div>
            </dl>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Report Preview</h2>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600">Report preview will be displayed here</p>
              <button className="mt-4 btn-primary">Generate Preview</button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recipients</h3>
            <div className="space-y-2">
              {report.recipients.map((email, index) => (
                <div key={index} className="flex items-center gap-2 text-sm text-gray-700">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  {email}
                </div>
              ))}
            </div>
            <button className="mt-4 text-sm text-primary-600 hover:text-primary-800">
              + Add Recipient
            </button>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Run History</h3>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border-l-2 border-primary-500 pl-3">
                  <p className="text-sm font-medium text-gray-900">
                    Run #{i}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(Date.now() - i * 86400000).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
            <button className="mt-4 text-sm text-primary-600 hover:text-primary-800">
              View All History
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
