import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft, Save } from 'lucide-react'
import { toast } from 'react-hot-toast'

import { apiClient } from '../../services/api.service'
interface KYCFormData {
  customer_id: string
  business_name: string
  registration_number: string
  tax_number: string
  owner_name: string
  owner_id: string
  phone: string
  email: string
  address: string
  status: string
  notes: string
}

export default function KYCCreate() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { register, handleSubmit, formState: { errors } } = useForm<KYCFormData>({
    defaultValues: {
      status: 'pending'
    }
  })

  const createMutation = useMutation({
    mutationFn: async (data: KYCFormData) => {
      const response = await apiClient.post('/kyc/cases', data)
      return response.data?.data || response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['kyc'] })
      toast.success('KYC created successfully')
      navigate(`/kyc/${data.id}`)
    },
    onError: () => {
      toast.error('Failed to create KYC')
    },
  })

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
        <h1 className="text-2xl font-bold text-gray-900">Create KYC Record</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit((data) => createMutation.mutate(data))} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Customer *
            </label>
            <select
              {...register('customer_id', { required: 'Customer is required' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Select customer</option>
              <option value="cust-1">ABC Store</option>
              <option value="cust-2">XYZ Shop</option>
            </select>
            {errors.customer_id && (
              <p className="mt-1 text-sm text-red-600">{errors.customer_id.message}</p>
            )}
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Business Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Business Name *
                </label>
                <input
                  type="text"
                  {...register('business_name', { required: 'Business name is required' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {errors.business_name && (
                  <p className="mt-1 text-sm text-red-600">{errors.business_name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Registration Number *
                </label>
                <input
                  type="text"
                  {...register('registration_number', { required: 'Registration number is required' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {errors.registration_number && (
                  <p className="mt-1 text-sm text-red-600">{errors.registration_number.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tax Number *
                </label>
                <input
                  type="text"
                  {...register('tax_number', { required: 'Tax number is required' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {errors.tax_number && (
                  <p className="mt-1 text-sm text-red-600">{errors.tax_number.message}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address *
                </label>
                <input
                  type="text"
                  {...register('address', { required: 'Address is required' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {errors.address && (
                  <p className="mt-1 text-sm text-red-600">{errors.address.message}</p>
                )}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Owner Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Owner Name *
                </label>
                <input
                  type="text"
                  {...register('owner_name', { required: 'Owner name is required' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {errors.owner_name && (
                  <p className="mt-1 text-sm text-red-600">{errors.owner_name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ID Number *
                </label>
                <input
                  type="text"
                  {...register('owner_id', { required: 'ID number is required' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {errors.owner_id && (
                  <p className="mt-1 text-sm text-red-600">{errors.owner_id.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone *
                </label>
                <input
                  type="tel"
                  {...register('phone', { required: 'Phone is required' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {errors.phone && (
                  <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  {...register('email', { required: 'Email is required' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              {...register('notes')}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Enter any notes"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/kyc')}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="btn-primary flex items-center gap-2"
            >
              <Save className="h-5 w-5" />
              {createMutation.isPending ? 'Creating...' : 'Create KYC'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
