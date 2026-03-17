import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Edit, Package, Target, FileText, LayoutGrid } from 'lucide-react'
import { brandService } from '../../services/brand.service'
import { EntityRefLink } from '../../components/generic/EntityRefLink'
import ErrorState from '../../components/ui/ErrorState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function BrandDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: brand, isLoading, isError } = useQuery({
    queryKey: ['brand', id],
    queryFn: () => brandService.getBrand(id!),
  })

  if (isLoading) {
    return <div className="p-6">Loading brand details...</div>
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


  if (!brand) {
    return <div className="p-6">Brand not found</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate('/brands')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Brands
        </button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{brand.name}</h1>
            <p className="text-gray-600">{brand.code}</p>
          </div>
          <button
            onClick={() => navigate(`/brands/${id}/edit`)}
            className="btn-primary flex items-center gap-2"
          >
            <Edit className="h-5 w-5" />
            Edit Brand
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Package className="h-5 w-5 text-primary-600" />
            <h3 className="font-semibold text-gray-900">Products</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{brand.product_count || 0}</p>
          <button
            onClick={() => navigate(`/brands/${id}/products`)}
            className="text-sm text-primary-600 hover:text-primary-800 mt-2"
          >
            View all products →
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="h-5 w-5 text-primary-600" />
            <h3 className="font-semibold text-gray-900">Surveys</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{brand.survey_count || 0}</p>
          <button
            onClick={() => navigate(`/brands/${id}/surveys`)}
            className="text-sm text-primary-600 hover:text-primary-800 mt-2"
          >
            View surveys →
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Target className="h-5 w-5 text-primary-600" />
            <h3 className="font-semibold text-gray-900">Activations</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{brand.activation_count || 0}</p>
          <button
            onClick={() => navigate(`/brands/${id}/activations`)}
            className="text-sm text-primary-600 hover:text-primary-800 mt-2"
          >
            View activations →
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Brand Information</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Brand Name</dt>
            <dd className="mt-1 text-sm text-gray-900">{brand.name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Brand Code</dt>
            <dd className="mt-1 text-sm text-gray-900">{brand.code || '-'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Status</dt>
            <dd className="mt-1">
              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                brand.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {brand.status || 'active'}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Description</dt>
            <dd className="mt-1 text-sm text-gray-900">{brand.description || '-'}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <button
          onClick={() => navigate(`/brands/${id}/boards`)}
          className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow text-left"
        >
          <div className="flex items-center gap-3 mb-2">
            <LayoutGrid className="h-6 w-6 text-primary-600" />
            <h3 className="font-semibold text-gray-900">Board Placements</h3>
          </div>
          <p className="text-sm text-gray-600">View and manage brand board placements</p>
        </button>
      </div>
    </div>
  )
}
