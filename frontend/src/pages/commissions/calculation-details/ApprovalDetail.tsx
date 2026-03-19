import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle, User, Calendar } from 'lucide-react'
import { formatCurrency } from '../../../utils/currency'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { apiClient } from '../../../services/api.service'

export default function ApprovalDetail() {
  const { calculationId } = useParams<{ calculationId: string }>()
  const navigate = useNavigate()

  const { data: approval, isLoading, isError } = useQuery({
    queryKey: ['commission-approval', calculationId],
    queryFn: async () => {
      const response = await apiClient.get(`/commissions/calculations/${calculationId}/approval`)
      const result = response.data
      return result.data
    },
  })

  if (isLoading) {
    return <div className="p-6"><LoadingSpinner size="md" /></div>
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


  if (!approval) {
    return <div className="p-6">Approval not found</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/commissions/calculations/${calculationId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Calculation
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Commission Approval Detail</h1>
        <p className="text-gray-600">{approval.agent_name}</p>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
        <div className="flex items-start gap-3">
          <CheckCircle className="h-8 w-8 text-green-600" />
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-green-900 mb-2">Commission Approved</h2>
            <p className="text-2xl font-bold text-green-900">{formatCurrency(approval.commission_amount)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Approval Information</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Submitted By</dt>
            <dd className="mt-1 text-sm text-gray-900 flex items-center gap-1">
              <User className="h-4 w-4 text-gray-400" />
              {approval.submitted_by}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Submitted At</dt>
            <dd className="mt-1 text-sm text-gray-900 flex items-center gap-1">
              <Calendar className="h-4 w-4 text-gray-400" />
              {new Date(approval.submitted_at).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Approved By</dt>
            <dd className="mt-1 text-sm text-gray-900 flex items-center gap-1">
              <User className="h-4 w-4 text-gray-400" />
              {approval.approved_by}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Approved At</dt>
            <dd className="mt-1 text-sm text-gray-900 flex items-center gap-1">
              <Calendar className="h-4 w-4 text-gray-400" />
              {new Date(approval.approved_at).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Approval Level</dt>
            <dd className="mt-1 text-sm text-gray-900 capitalize">{approval.approval_level}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Status</dt>
            <dd className="mt-1">
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                approval.approval_status === 'approved' ? 'bg-green-100 text-green-800' :
                approval.approval_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {approval.approval_status}
              </span>
            </dd>
          </div>
        </dl>
      </div>

      {approval.approval_notes && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Approval Notes</h2>
          <p className="text-sm text-gray-700">{approval.approval_notes}</p>
        </div>
      )}
    </div>
  )
}
