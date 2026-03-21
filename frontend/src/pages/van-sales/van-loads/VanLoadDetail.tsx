import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import TransactionDetail from '../../../components/transactions/TransactionDetail'
import DocumentActions from '../../../components/export/DocumentActions'
import { vanSalesService } from '../../../services/van-sales.service'
import { formatDate } from '../../../utils/format'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { useToast } from '../../../components/ui/Toast'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import type { DocumentData } from '../../../utils/pdf/document-generator'

export default function VanLoadDetail() {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<{ title: string; message: string; action: () => void }>({ title: '', message: '', action: () => {} })
  const { toast } = useToast()
  const { id } = useParams()
  const navigate = useNavigate()
  const [vanLoad, setVanLoad] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadVanLoad()
  }, [id])

  const loadVanLoad = async () => {
    setLoading(true)
    try {
      const response = await vanSalesService.getVanLoad(Number(id))
      setVanLoad(response.data)
    } catch (error) {
      console.error('Failed to load van load:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    setPendingAction({
      title: 'Confirm',
      message: 'Are you sure you want to confirm this van load?',
      action: async () => {
        try {
      await vanSalesService.confirmVanLoad(Number(id))
      navigate('/van-sales/van-loads')
    } catch (error) {
      console.error('Failed to confirm van load:', error)
      toast.error('Failed to confirm van load')
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

  if (!vanLoad) {
    return <ErrorState title="Van load not found" message="The van load you are looking for does not exist or has been deleted." />
  }

  const fields = [
    { label: 'Load Number', value: vanLoad.load_number },
    { label: 'Load Date', value: formatDate(vanLoad.load_date) },
    { label: 'Van', value: vanLoad.van_number },
    { label: 'Driver', value: vanLoad.driver_name },
    { label: 'Route', value: vanLoad.route_name },
    { label: 'Total Items', value: vanLoad.total_items },
    { label: 'Status', value: vanLoad.status },
    { label: 'Notes', value: vanLoad.notes },
    { label: 'Created By', value: vanLoad.created_by },
    { label: 'Created At', value: formatDate(vanLoad.created_at) }
  ]

  const statusColor = {
    pending: 'yellow',
    confirmed: 'green',
    in_transit: 'blue',
    completed: 'gray'
  }[vanLoad.status] as 'green' | 'yellow' | 'red' | 'gray'

  const documentData: DocumentData = {
    type: 'van_load',
    number: vanLoad.load_number || `VL-${id}`,
    date: vanLoad.load_date || new Date().toISOString(),
    status: vanLoad.status,
    company: { name: 'Fieldvibe', email: 'operations@fieldvibe.com' },
    customer: { name: vanLoad.driver_name || 'Driver' },
    items: [],
    subtotal: 0,
    tax_total: 0,
    total: 0,
    van_number: vanLoad.van_number,
    driver_name: vanLoad.driver_name,
    route_name: vanLoad.route_name,
    notes: vanLoad.notes,
    inventory_items: (vanLoad.items || []).map((item: any) => ({
      description: item.product_name || item.description || 'Item',
      sku: item.sku || item.product_code,
      quantity: item.quantity || 0,
      uom: item.uom,
    })),
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <DocumentActions documentData={documentData} />
      </div>
      <TransactionDetail
      title={`Van Load ${vanLoad.load_number}`}
      fields={fields}
      auditTrail={vanLoad.audit_trail || []}
      backPath="/van-sales/van-loads"
      status={vanLoad.status}
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
