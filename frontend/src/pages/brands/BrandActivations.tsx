import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Plus, Target } from 'lucide-react'
import { brandService } from '../../services/brand.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function BrandActivations() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: brand } = useQuery({
    queryKey: ['brand', id],
    queryFn: () => brandService.getBrand(id!),
  })

  const { data: activations = [], isLoading, isError } = useQuery({
    queryKey: ['brand-activations', id],
    queryFn: () => brandService.getBrandActivations(id!),
  })

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/brands/${id}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Brand
        </button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{brand?.name} - Activations</h1>
            <p className="text-gray-600">Brand activation campaigns and events</p>
          </div>
          <button
            onClick={() => navigate(`/marketing/activations/create?brand_id=${id}`)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            Create Activation
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500"><LoadingSpinner size="md" /></div>
        ) : activations.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Target className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>No activations found for this brand.</p>
            <button
              onClick={() => navigate(`/marketing/activations/create?brand_id=${id}`)}
              className="mt-4 btn-primary"
            >
              Create First Activation
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-surface-secondary">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Activation Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reach
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {activations.map((activation: any) => (
                  <tr key={activation.id} className="hover:bg-surface-secondary">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{activation.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                        {activation.type || 'event'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(activation.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        activation.status === 'active' ? 'bg-green-100 text-green-800' : 
                        activation.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {activation.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {activation.reach || 0} people
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => navigate(`/marketing/activations/${activation.id}`)}
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
