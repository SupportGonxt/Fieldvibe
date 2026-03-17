import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Edit, CheckCircle, XCircle } from 'lucide-react'
import { customersService } from '../../services/customers.service'
import ErrorState from '../../components/ui/ErrorState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function KYCDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: kyc, isLoading, isError } = useQuery({
    queryKey: ['kyc', id],
    queryFn: () => customersService.getCustomer(id!),
  })

  if (isLoading) {
    return <div className="p-6">Loading KYC details...</div>
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


  if (!kyc) {
    return <div className="p-6">KYC record not found</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate('/kyc')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to KYC
        </button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{kyc.customer_name}</h1>
            <p className="text-gray-600">{kyc.business_name}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/kyc/${id}/edit`)}
              className="btn-secondary flex items-center gap-2"
            >
              <Edit className="h-5 w-5" />
              Edit
            </button>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1 ${
              kyc.status === 'approved' ? 'bg-green-100 text-green-800' : 
              kyc.status === 'rejected' ? 'bg-red-100 text-red-800' : 
              'bg-yellow-100 text-yellow-800'
            }`}>
              {kyc.status === 'approved' ? <CheckCircle className="h-4 w-4" /> : 
               kyc.status === 'rejected' ? <XCircle className="h-4 w-4" /> : null}
              {kyc.status}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Business Information</h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">Business Name</dt>
              <dd className="mt-1 text-sm text-gray-900">{kyc.business_name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Registration Number</dt>
              <dd className="mt-1 text-sm text-gray-900">{kyc.registration_number}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Tax Number</dt>
              <dd className="mt-1 text-sm text-gray-900">{kyc.tax_number}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Address</dt>
              <dd className="mt-1 text-sm text-gray-900">{kyc.address}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Owner Information</h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">Owner Name</dt>
              <dd className="mt-1 text-sm text-gray-900">{kyc.owner_name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">ID Number</dt>
              <dd className="mt-1 text-sm text-gray-900">{kyc.owner_id}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Phone</dt>
              <dd className="mt-1 text-sm text-gray-900">{kyc.phone}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Email</dt>
              <dd className="mt-1 text-sm text-gray-900">{kyc.email}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Verification Details</h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="mt-1 text-sm text-gray-900">{kyc.status}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Verified By</dt>
              <dd className="mt-1 text-sm text-gray-900">{kyc.verified_by || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Verified At</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {kyc.verified_at ? new Date(kyc.verified_at).toLocaleString() : '-'}
              </dd>
            </div>
            <div className="md:col-span-2">
              <dt className="text-sm font-medium text-gray-500">Notes</dt>
              <dd className="mt-1 text-sm text-gray-900">{kyc.notes || '-'}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  )
}
