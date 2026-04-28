import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import TransactionForm from '../../../components/transactions/TransactionForm'
import { vanSalesService } from '../../../services/van-sales.service'

export default function CashReconciliationCreate() {
  const navigate = useNavigate()
  const [vans, setVans] = useState([])

  useEffect(() => {
    loadVans()
  }, [])

  const loadVans = async () => {
    try {
      const response = await vanSalesService.getVans()
      setVans(Array.isArray(response.data) ? response.data : (response.data?.data || []))
    } catch (error) {
      console.error('Failed to load vans:', error)
    }
  }

  const fields = [
    {
      name: 'reconciliation_date',
      label: 'Reconciliation Date',
      type: 'date' as const,
      required: true
    },
    {
      name: 'van_id',
      label: 'Van',
      type: 'select' as const,
      required: true,
      options: vans.map((v: any) => ({
        value: String(v.id),
        // Schema fields: name + registration_number; driver_name comes from join.
        label: [v.name, v.registration_number, v.driver_name].filter(Boolean).join(' — '),
      }))
    },
    {
      name: 'expected_cash',
      label: 'Expected Cash (R)',
      type: 'number' as const,
      required: true,
      validation: (value: number) => value < 0 ? 'Expected cash cannot be negative' : null
    },
    {
      name: 'actual_cash',
      label: 'Actual Cash (R)',
      type: 'number' as const,
      required: true,
      validation: (value: number) => value < 0 ? 'Actual cash cannot be negative' : null
    },
    {
      name: 'notes',
      label: 'Notes',
      type: 'textarea' as const,
      placeholder: 'Add any notes about variances or issues...'
    }
  ]

  const handleSubmit = async (data: any) => {
    try {
      await vanSalesService.createCashReconciliation(data)
      navigate('/van-sales/cash-reconciliation')
    } catch (error: any) {
      throw new Error(error.message || 'Failed to create cash reconciliation')
    }
  }

  return (
    <TransactionForm
      title="Create Cash Reconciliation"
      fields={fields}
      onSubmit={handleSubmit}
      onCancel={() => navigate('/van-sales/cash-reconciliation')}
      submitLabel="Create Reconciliation"
    />
  )
}
