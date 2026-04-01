import { useNavigate } from 'react-router-dom'
import TransactionForm from '../../components/transactions/TransactionForm'
import { customersService } from '../../services/customers.service'

export default function CustomerCreatePage() {
  const navigate = useNavigate()

  const fields = [
    {
      name: 'code',
      label: 'Customer Code',
      type: 'text' as const,
      required: true,
      placeholder: 'e.g., CUST001'
    },
    {
      name: 'name',
      label: 'Customer Name',
      type: 'text' as const,
      required: true,
      placeholder: 'e.g., ABC Store'
    },
    {
      name: 'type',
      label: 'Customer Type',
      type: 'select' as const,
      required: true,
      options: [
        { value: 'retail', label: 'Retail' },
        { value: 'wholesale', label: 'Wholesale' },
        { value: 'distributor', label: 'Distributor' },
        { value: 'store', label: 'Store' }
      ]
    },
    {
      name: 'phone',
      label: 'Phone Number',
      type: 'text' as const,
      required: true,
      placeholder: 'e.g., +27 12 345 6789'
    },
    {
      name: 'email',
      label: 'Email',
      type: 'text' as const,
      placeholder: 'e.g., contact@abcstore.co.za'
    },
    {
      name: 'address',
      label: 'Address',
      type: 'textarea' as const,
      required: true,
      placeholder: 'Street address, suburb, city'
    },
    {
      name: 'city',
      label: 'City',
      type: 'text' as const,
      placeholder: 'e.g., Johannesburg'
    },
    {
      name: 'region',
      label: 'Region',
      type: 'text' as const,
      placeholder: 'e.g., Gauteng'
    },
    {
      name: 'credit_limit',
      label: 'Credit Limit',
      type: 'number' as const,
      placeholder: 'e.g., 50000'
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
        { value: 'inactive', label: 'Inactive' }
      ]
    }
  ]

  const handleSubmit = async (data: any) => {
    try {
      const result = await customersService.createCustomer(data)
      navigate('/customers')
    } catch (error: any) {
      throw new Error(error.message || 'Failed to create customer')
    }
  }

  return (
    <TransactionForm
      title="Create Customer"
      fields={fields}
      onSubmit={handleSubmit}
      onCancel={() => navigate('/customers')}
      submitLabel="Create Customer"
    />
  )
}
