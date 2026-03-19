import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import TransactionForm from '../../../components/transactions/TransactionForm'
import { salesService } from '../../../services/sales.service'

export default function PaymentCreate() {
  const navigate = useNavigate()
  const [invoices, setInvoices] = useState([])

  useEffect(() => {
    loadInvoices()
  }, [])

  const loadInvoices = async () => {
    try {
      const response = await salesService.getInvoices()
      const rawInvoices = response.data?.data || response.data || []
      const invoicesList = Array.isArray(rawInvoices) ? rawInvoices : (rawInvoices.invoices || [])
      const unpaidInvoices = invoicesList.filter((i: any) => 
        (i.status === 'sent' || i.status === 'overdue') && i.balance_due > 0
      )
      setInvoices(unpaidInvoices)
    } catch (error) {
      console.error('Failed to load invoices:', error)
    }
  }

  const fields = [
    {
      name: 'payment_date',
      label: 'Payment Date',
      type: 'date' as const,
      required: true
    },
    {
      name: 'invoice_id',
      label: 'Invoice',
      type: 'select' as const,
      required: true,
      options: invoices.map((i: any) => ({
        value: i.id.toString(),
        label: `${i.invoice_number} - ${i.customer_name} (Balance: R ${i.balance_due})`
      }))
    },
    {
      name: 'payment_amount',
      label: 'Payment Amount (R)',
      type: 'number' as const,
      required: true,
      validation: (value: number) => value <= 0 ? 'Payment amount must be greater than 0' : null
    },
    {
      name: 'payment_method',
      label: 'Payment Method',
      type: 'select' as const,
      required: true,
      options: [
        { value: 'cash', label: 'Cash' },
        { value: 'cheque', label: 'Cheque' },
        { value: 'eft', label: 'EFT' },
        { value: 'card', label: 'Card' },
        { value: 'mobile', label: 'Mobile Payment' }
      ]
    },
    {
      name: 'reference_number',
      label: 'Reference Number',
      type: 'text' as const,
      placeholder: 'Cheque number, transaction ID, etc.'
    },
    {
      name: 'notes',
      label: 'Notes',
      type: 'textarea' as const,
      placeholder: 'Add payment notes...'
    }
  ]

  const handleSubmit = async (data: any) => {
    try {
      await salesService.createPayment(data)
      navigate('/sales/payments')
    } catch (error: any) {
      throw new Error(error.message || 'Failed to record payment')
    }
  }

  return (
    <TransactionForm
      title="Record Sales Payment"
      fields={fields}
      onSubmit={handleSubmit}
      onCancel={() => navigate('/sales/payments')}
      submitLabel="Record Payment"
    />
  )
}
