import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, Calendar } from 'lucide-react'

export default function BoardComplianceChecks() {
  const { boardId } = useParams<{ boardId: string }>()
  const navigate = useNavigate()

  const { data: board } = useQuery({
    queryKey: ['board', boardId],
    queryFn: async () => {
      const response = await fetch(`/api/boards/${boardId}`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return null
      const result = await response.json()
      return result.data
    },
  })

  const { data: checks, isLoading, isError } = useQuery({
    queryKey: ['board-compliance-checks', boardId],
    queryFn: async () => {
      const response = await fetch(`/api/boards/${boardId}/compliance`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return []
      const result = await response.json()
      return result.data || []
    },
  })

  const oldChecks = [
      {
        id: '1',
        check_type: 'brand_guidelines',
        check_date: '2024-01-25T10:00:00Z',
        status: 'passed',
        checked_by: 'Jane Manager',
        notes: 'All brand guidelines met',
        issues_found: 0,
      },
      {
        id: '2',
        check_type: 'safety_standards',
        check_date: '2024-01-25T10:15:00Z',
        status: 'passed',
        checked_by: 'Jane Manager',
        notes: 'Board securely mounted, no safety concerns',
        issues_found: 0,
      },
      {
        id: '3',
        check_type: 'visibility_requirements',
        check_date: '2024-01-25T10:30:00Z',
        status: 'warning',
        checked_by: 'Jane Manager',
        notes: 'Partially obscured by store signage during certain hours',
        issues_found: 1,
      },
      {
        id: '4',
        check_type: 'maintenance_schedule',
        check_date: '2024-01-25T10:45:00Z',
        status: 'passed',
        checked_by: 'Jane Manager',
        notes: 'Regular maintenance being performed on schedule',
        issues_found: 0,
      },
    ]

  if (isLoading) {
    return <div className="p-6">Loading compliance checks...</div>
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


  const passedChecks = checks?.filter(c => c.status === 'passed').length || 0
  const totalChecks = checks?.length || 0
  const complianceRate = totalChecks > 0 ? ((passedChecks / totalChecks) * 100).toFixed(0) : 0

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/field-operations/boards/${boardId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Board
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Board Compliance Checks</h1>
        <p className="text-gray-600">{board?.board_number} - {board?.brand_name}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Compliance Rate</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{complianceRate}%</p>
          <p className="text-sm text-gray-600 mt-1">{passedChecks}/{totalChecks} checks passed</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Total Checks</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{totalChecks}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <h3 className="font-semibold text-gray-900">Issues Found</h3>
          </div>
          <p className="text-3xl font-bold text-yellow-600">
            {checks?.reduce((sum, c) => sum + c.issues_found, 0) || 0}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {checks?.map((check) => (
          <div key={check.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-3">
                {check.status === 'passed' ? (
                  <CheckCircle className="h-6 w-6 text-green-600 mt-0.5" />
                ) : check.status === 'warning' ? (
                  <AlertTriangle className="h-6 w-6 text-yellow-600 mt-0.5" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-600 mt-0.5" />
                )}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 capitalize">
                    {check.check_type.replace('_', ' ')}
                  </h3>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full mt-1 ${
                    check.status === 'passed' ? 'bg-green-100 text-green-800' :
                    check.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {check.status}
                  </span>
                </div>
              </div>
              {check.issues_found > 0 && (
                <span className="inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-yellow-100 text-yellow-800">
                  {check.issues_found} issue{check.issues_found !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            <dl className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Check Date</dt>
                <dd className="mt-1 text-sm text-gray-900 flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  {new Date(check.check_date).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Checked By</dt>
                <dd className="mt-1 text-sm text-gray-900">{check.checked_by}</dd>
              </div>
            </dl>

            {check.notes && (
              <div className="mt-3 p-3 bg-surface-secondary rounded">
                <p className="text-sm text-gray-700">{check.notes}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
