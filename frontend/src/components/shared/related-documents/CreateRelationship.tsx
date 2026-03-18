import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'

interface RelationshipFormData {
  relationship_type: string
  related_entity_type: string
  related_entity_id: string
  description: string
}

interface CreateRelationshipProps {
  entityType: string
  entityId: string
}

export default function CreateRelationship({ entityType, entityId }: CreateRelationshipProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { register, handleSubmit, formState: { errors } } = useForm<RelationshipFormData>()

  const createMutation = useMutation({
    mutationFn: async (data: RelationshipFormData) => {
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['related-documents', entityType, entityId] })
      toast.success('Relationship created successfully')
      navigate(-1)
    },
    onError: () => {
      toast.error('Failed to create relationship')
    },
  })

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Create Relationship</h1>
        <p className="text-gray-600">Link this {entityType} to another document</p>
      </div>

      <form onSubmit={handleSubmit((data) => createMutation.mutate(data))} className="bg-white rounded-lg shadow p-6">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Relationship Type *
            </label>
            <select
              {...register('relationship_type', { required: 'Relationship type is required' })}
              className="input"
            >
              <option value="">Select relationship type</option>
              <option value="parent">Parent</option>
              <option value="child">Child</option>
              <option value="generates">Generates</option>
              <option value="derived_from">Derived From</option>
              <option value="related">Related</option>
              <option value="references">References</option>
            </select>
            {errors.relationship_type && (
              <p className="mt-1 text-sm text-red-600">{errors.relationship_type.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Related Document Type *
            </label>
            <select
              {...register('related_entity_type', { required: 'Document type is required' })}
              className="input"
            >
              <option value="">Select document type</option>
              <option value="order">Order</option>
              <option value="invoice">Invoice</option>
              <option value="payment">Payment</option>
              <option value="delivery">Delivery</option>
              <option value="return">Return</option>
              <option value="quote">Quote</option>
            </select>
            {errors.related_entity_type && (
              <p className="mt-1 text-sm text-red-600">{errors.related_entity_type.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Related Document ID *
            </label>
            <input
              type="text"
              {...register('related_entity_id', { required: 'Document ID is required' })}
              className="input"
              placeholder="Enter document ID or number"
            />
            {errors.related_entity_id && (
              <p className="mt-1 text-sm text-red-600">{errors.related_entity_id.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              {...register('description')}
              rows={3}
              className="input"
              placeholder="Add a description for this relationship..."
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="btn-primary"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Relationship'}
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
