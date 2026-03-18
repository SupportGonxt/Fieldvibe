import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Shield, CheckCircle, AlertTriangle } from 'lucide-react'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { apiClient } from '../../../services/api.service'

export default function PhotoEvidence() {
  const { visitId } = useParams<{ visitId: string }>()
  const navigate = useNavigate()

  const { data: visit } = useQuery({
    queryKey: ['visit', visitId],
    queryFn: async () => {
      const response = await fetch(`${apiClient.defaults.baseURL}/visits/${visitId}`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return null
      const result = await response.json()
      return result.data
    },
  })

  const { data: evidence, isLoading, isError } = useQuery({
    queryKey: ['visit-photo-evidence', visitId],
    queryFn: async () => {
      const response = await fetch(`${apiClient.defaults.baseURL}/visits/${visitId}/photos/evidence`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return null
      const result = await response.json()
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


  if (!evidence) {
    return <div className="p-6">Evidence not found</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/field-operations/visits/${visitId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Visit
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Photo Evidence</h1>
        <p className="text-gray-600">
          {visit?.visit_number} - {visit?.customer_name}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Total Photos</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{evidence.total_photos}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Verified</h3>
          </div>
          <p className="text-3xl font-bold text-green-600">{evidence.verified_photos}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">GPS Verified</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{evidence.gps_verified}</p>
        </div>
      </div>

      <div className="space-y-4">
        {evidence.evidence_items.map((item) => (
          <div key={item.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start gap-4">
              <img
                src={item.photo_url}
                alt={item.caption}
                onClick={() => navigate(`/field-operations/visits/${visitId}/photos/${item.id}`)}
                className="w-32 h-32 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
              />
              <div className="flex-1">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{item.caption}</h3>
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 capitalize mt-1">
                      {item.evidence_type.replace('_', ' ')}
                    </span>
                  </div>
                  <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                    item.verification_status === 'verified' ? 'bg-green-100 text-green-800' :
                    item.verification_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {item.verification_status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="flex items-center gap-2">
                    {item.gps_match ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    )}
                    <span className="text-sm text-gray-700">GPS Match</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.timestamp_match ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    )}
                    <span className="text-sm text-gray-700">Timestamp Match</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {new Date(item.taken_at).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
