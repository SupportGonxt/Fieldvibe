import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import TransactionForm from '../../../components/transactions/TransactionForm'
import { financeService } from '../../../services/finance.service'

export default function CashReconciliationCreate() {
  const navigate = useNavigate()
  const [agents, setAgents] = useState([])

  useEffect(() => {
    loadAgents()
  }, [])

  const loadAgents = async () => {
    try {
      const response = await financeService.getAgents()
      setAgents(Array.isArray(response.data) ? response.data : (response.data?.data || []))
    } catch (error) {
      console.error('Failed to load agents:', error)
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
      name: 'agent_id',
      label: 'Agent',
      type: 'select' as const,
      required: true,
      options: agents.map((a: any) => ({
        value: a.id.toString(),
        label: a.name
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
      name: 'cash_breakdown',
      label: 'Cash Breakdown',
      type: 'textarea' as const,
      placeholder: 'Enter denomination breakdown (e.g., R200 x 5 = R1000)'
    },
    {
      name: 'variance_reason',
      label: 'Variance Reason',
      type: 'textarea' as const,
      placeholder: 'Explain any variance between expected and actual cash'
    },
    {
      name: 'notes',
      label: 'Notes',
      type: 'textarea' as const,
      placeholder: 'Add reconciliation notes...'
    }
  ]

  const handleSubmit = async (data: any) => {
    try {
      await financeService.createCashReconciliation(data)
      navigate('/finance/cash-reconciliation')
    } catch (error: any) {
      throw new Error(error.message || 'Failed to create cash reconciliation')
    }
  }

  return (
    <TransactionForm
      title="Create Cash Reconciliation"
      fields={fields}
      onSubmit={handleSubmit}
      onCancel={() => navigate('/finance/cash-reconciliation')}
      submitLabel="Create Reconciliation"
    />
  )
}
