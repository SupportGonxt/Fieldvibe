import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft, Save } from 'lucide-react'
import { brandService } from '../../services/brand.service'
import { toast } from 'react-hot-toast'

export default function BrandCreate() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { register, handleSubmit, formState: { errors } } = useForm()

  const createMutation = useMutation({
    mutationFn: (data: any) => brandService.createBrand(data),
    onSuccess: (newBrand) => {
      queryClient.invalidateQueries({ queryKey: ['brands'] })
      toast.success('Brand created successfully')
      navigate(`/brands/${newBrand.id}`)
    },
    onError: () => {
      toast.error('Failed to create brand')
    },
  })

  const onSubmit = (data: any) => {
    createMutation.mutate(data)
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
        <h1 className="text-2xl font-bold text-gray-900">Create New Brand</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-lg shadow p-6">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Brand Name *
            </label>
            <input
              type="text"
              {...register('name', { required: 'Brand name is required' })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-info-500 focus:border-transparent"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message as string}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Brand Code
            </label>
            <input
              type="text"
              {...register('code')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-info-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              {...register('description')}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-info-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              {...register('status')}
              defaultValue="active"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-info-500 focus:border-transparent"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="mt-6 flex gap-4">
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="btn-primary flex items-center gap-2"
          >
            <Save className="h-5 w-5" />
            {createMutation.isPending ? 'Creating...' : 'Create Brand'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/brands')}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
