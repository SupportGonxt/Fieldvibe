import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import TransactionDetail from '../../../components/transactions/TransactionDetail'
import DocumentActions from '../../../components/export/DocumentActions'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { salesService } from '../../../services/sales.service'
import { formatCurrency, formatDate } from '../../../utils/format'
import type { DocumentData } from '../../../utils/pdf/document-generator'

export default function SalesOrderDetail() {
  const { id } = useParams()
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadOrder()
  }, [id])

  const loadOrder = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await salesService.getOrder(id!)
      setOrder(response.data)
    } catch (err: any) {
      console.error('Failed to load order:', err)
      setError(err.message || 'Failed to load order details')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return <ErrorState title="Failed to load order" message={error} onRetry={loadOrder} />
  }

  if (!order) {
    return <ErrorState title="Order not found" message="The order you are looking for does not exist or has been deleted." />
  }

  const fields = [
    { label: 'Order Number', value: order.order_number },
    { label: 'Order Date', value: formatDate(order.order_date) },
    { label: 'Customer', value: order.customer_name },
    { label: 'Sales Rep', value: order.sales_rep },
    { label: 'Order Amount', value: formatCurrency(order.order_amount) },
    { label: 'Delivery Date', value: formatDate(order.delivery_date) },
    { label: 'Payment Terms', value: order.payment_terms },
    { label: 'Status', value: order.status },
    { label: 'Notes', value: order.notes },
    { label: 'Created By', value: order.created_by },
    { label: 'Created At', value: formatDate(order.created_at) }
  ]

  const statusColor = {
    draft: 'gray',
    pending: 'yellow',
    confirmed: 'blue',
    fulfilled: 'green',
    cancelled: 'red'
  }[order.status] as 'green' | 'yellow' | 'red' | 'gray'

  const documentData: DocumentData = {
    type: 'order',
    number: order.order_number || `ORD-${id}`,
    date: order.order_date || new Date().toISOString(),
    due_date: order.delivery_date,
    status: order.status,
    company: { name: 'Fieldvibe', email: 'sales@fieldvibe.com' },
    customer: {
      name: order.customer_name || 'Customer',
      address: order.customer_address,
      phone: order.customer_phone,
      email: order.customer_email,
    },
    items: (order.items || []).map((item: any) => ({
      description: item.product_name || item.description || 'Item',
      sku: item.sku || item.product_code,
      quantity: item.quantity || 0,
      unit_price: item.unit_price || 0,
      discount: item.discount,
      tax: item.tax,
      total: item.total || (item.quantity || 0) * (item.unit_price || 0),
    })),
    subtotal: order.subtotal || order.order_amount || 0,
    tax_total: order.tax_total || 0,
    discount_total: order.discount_total,
    total: order.order_amount || 0,
    notes: order.notes,
    payment_terms: order.payment_terms,
    sales_rep: order.sales_rep,
    po_number: order.po_number,
    shipping_address: order.shipping_address,
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <DocumentActions documentData={documentData} />
      </div>
      <TransactionDetail
        title={`Sales Order ${order.order_number}`}
        fields={fields}
        auditTrail={order.audit_trail || []}
        editPath={order.status === 'draft' ? `/sales/orders/${id}/edit` : undefined}
        backPath="/sales/orders"
        status={order.status}
        statusColor={statusColor}
      />
    </div>
  )
}
