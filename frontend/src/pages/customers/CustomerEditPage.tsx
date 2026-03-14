import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import TransactionForm from '../../components/transactions/TransactionForm'
import { customersService } from '../../services/customers.service'
import ErrorState from '../../components/ui/ErrorState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function CustomerEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCustomer()
  }, [id])

  const loadCustomer = async () => {
    setLoading(true)
    try {
      const response = await customersService.getCustomer(id!)
      setCustomer(response)
    } catch (error) {
      console.error('Failed to load customer:', error)
    } finally {
      setLoading(false)
    }
  }

  const fields = [
    {
      name: 'code',
      label: 'Customer Code',
      type: 'text' as const,
      required: true,
      disabled: true
    },
    {
      name: 'name',
      label: 'Customer Name',
      type: 'text' as const,
      required: true
    },
    {
      name: 'type',
      label: 'Customer Type',
      type: 'select' as const,
      required: true,
      options: [
        { value: 'retail', label: 'Retail' },
        { value: 'wholesale', label: 'Wholesale' },
        { value: 'distributor', label: 'Distributor' }
      ]
    },
    {
      name: 'phone',
      label: 'Phone Number',
      type: 'text' as const,
      required: true
    },
    {
      name: 'email',
      label: 'Email',
      type: 'text' as const
    },
    {
      name: 'address',
      label: 'Address',
      type: 'textarea' as const,
      required: true
    },
    {
      name: 'city',
      label: 'City',
      type: 'text' as const
    },
    {
      name: 'region',
      label: 'Region',
      type: 'text' as const
    },
    {
      name: 'credit_limit',
      label: 'Credit Limit',
      type: 'number' as const
    },
    {
      name: 'payment_terms',
      label: 'Payment Terms',
      type: 'select' as const,
      options: [
        { value: 'cash', label: 'Cash' },
        { value: 'credit_7', label: 'Credit 7 Days' },
        { value: 'credit_30', label: 'Credit 30 Days' },
        { value: 'credit_60', label: 'Credit 60 Days' }
      ]
    },
    {
      name: 'status',
      label: 'Status',
      type: 'select' as const,
      required: true,
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
        { value: 'suspended', label: 'Suspended' }
      ]
    }
  ]

  const handleSubmit = async (data: any) => {
    try {
      await customersService.updateCustomer(id!, data)
      navigate(`/customers/${id}`)
    } catch (error: any) {
      throw new Error(error.message || 'Failed to update customer')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!customer) {
    return <ErrorState title="Customer not found" message="The customer you are looking for does not exist or has been deleted." />
  }

  return (
    <TransactionForm
      title={`Edit Customer ${customer.code || customer.name}`}
      fields={fields}
      initialData={customer}
      onSubmit={handleSubmit}
      onCancel={() => navigate(`/customers/${id}`)}
      submitLabel="Update Customer"
    />
  )
}
