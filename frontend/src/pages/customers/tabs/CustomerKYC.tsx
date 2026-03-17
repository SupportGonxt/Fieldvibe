import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, FileCheck } from 'lucide-react'
import { kycService } from '../../../services/kyc.service'

export default function CustomerKYC() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: kycRecords = [], isLoading, isError } = useQuery({
    queryKey: ['customer-kyc', id],
    queryFn: () => kycService.getKYCRecords({ customer_id: id }),
  })

  const latestKYC = kycRecords[0]

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Customer KYC</h2>
          {latestKYC && (
            <p className="text-sm text-gray-600">
              Status: <span className={`font-semibold ${
                latestKYC.status === 'approved' ? 'text-green-600' :
                latestKYC.status === 'pending' ? 'text-yellow-600' :
                latestKYC.status === 'rejected' ? 'text-red-600' :
                'text-gray-600'
              }`}>
                {latestKYC.status}
              </span>
            </p>
          )}
        </div>
        <button
          onClick={() => navigate(`/kyc/create?customer_id=${id}`)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Add KYC Record
        </button>
      </div>

      <div className="bg-white rounded-lg shadow">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading KYC records...</div>
        ) : kycRecords.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <FileCheck className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>No KYC records found for this customer.</p>
            <button
              onClick={() => navigate(`/kyc/create?customer_id=${id}`)}
              className="mt-4 btn-primary"
            >
              Create KYC Record
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-surface-secondary">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submission Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Document Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Verified By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expiry Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {kycRecords.map((kyc: any) => (
                  <tr key={kyc.id} className="hover:bg-surface-secondary">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(kyc.submission_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {kyc.document_type || 'ID'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {kyc.verified_by || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        kyc.status === 'approved' ? 'bg-green-100 text-green-800' :
                        kyc.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        kyc.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {kyc.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {kyc.expiry_date ? new Date(kyc.expiry_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => navigate(`/kyc/${kyc.id}`)}
                        className="text-primary-600 hover:text-primary-900"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
