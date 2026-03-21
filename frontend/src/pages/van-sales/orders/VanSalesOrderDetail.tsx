import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import TransactionDetail from '../../../components/transactions/TransactionDetail'
import DocumentActions from '../../../components/export/DocumentActions'
import { vanSalesService } from '../../../services/van-sales.service'
import { formatCurrency, formatDate } from '../../../utils/format'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { useToast } from '../../../components/ui/Toast'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import type { DocumentData } from '../../../utils/pdf/document-generator'

export default function VanSalesOrderDetail() {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<{ title: string; message: string; action: () => void }>({ title: '', message: '', action: () => {} })
  const { toast } = useToast()
  const { id } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadOrder()
  }, [id])

  const loadOrder = async () => {
    setLoading(true)
    try {
      const response = await vanSalesService.getOrder(Number(id))
      setOrder(response.data)
    } catch (error) {
      console.error('Failed to load order:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleReverse = async () => {
    setPendingAction({
      title: 'Confirm',
      message: 'Are you sure you want to reverse this order? This action cannot be undone.',
      action: async () => {
        try {
      await vanSalesService.reverseOrder(Number(id))
      navigate('/van-sales/orders')
    } catch (error) {
      console.error('Failed to reverse order:', error)
      toast.error('Failed to reverse order')
    }
      }
    })
    setConfirmOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!order) {
    return <ErrorState title="Order not found" message="The order you are looking for does not exist or has been deleted." />
  }

  const fields = [
    { label: 'Order Number', value: order.order_number },
    { label: 'Order Date', value: formatDate(order.order_date) },
    { label: 'Customer', value: order.customer_name },
    { label: 'Route', value: order.route_name },
    { label: 'Delivery Date', value: formatDate(order.delivery_date) },
    { label: 'Payment Method', value: order.payment_method },
    { label: 'Total Amount', value: formatCurrency(order.total_amount) },
    { label: 'Status', value: order.status },
    { label: 'Notes', value: order.notes },
    { label: 'Created By', value: order.created_by },
    { label: 'Created At', value: formatDate(order.created_at) }
  ]

  const auditTrail = order.audit_trail || []

  const statusColor = {
    pending: 'yellow',
    confirmed: 'blue',
    delivered: 'green',
    cancelled: 'red',
    reversed: 'gray'
  }[order.status] as 'green' | 'yellow' | 'red' | 'gray'

  const documentData: DocumentData = {
    type: 'van_sales_order',
    number: order.order_number || `VSO-${id}`,
    date: order.order_date || new Date().toISOString(),
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
    subtotal: order.subtotal || order.total_amount || 0,
    tax_total: order.tax_total || 0,
    total: order.total_amount || 0,
    route_name: order.route_name,
    payment_terms: order.payment_method,
    notes: order.notes,
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <DocumentActions documentData={documentData} />
      </div>
      <TransactionDetail
      title={`Order ${order.order_number}`}
      fields={fields}
      auditTrail={auditTrail}
      editPath={order.status === 'pending' ? `/van-sales/orders/${id}/edit` : undefined}
      onReverse={order.status === 'delivered' ? handleReverse : undefined}
      backPath="/van-sales/orders"
      status={order.status}
      statusColor={statusColor}
    />
      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => { pendingAction.action(); setConfirmOpen(false); }}
        title={pendingAction.title}
        message={pendingAction.message}
        confirmLabel="Confirm"
        variant="danger"
      />
    </>
  )
}
