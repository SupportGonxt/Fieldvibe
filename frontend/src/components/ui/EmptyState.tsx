import React from 'react'
import { LucideIcon, Package, FileText, Users, ShoppingCart, BarChart3, MapPin, Truck, DollarSign, ClipboardList, Megaphone, Star } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface EmptyStateAction {
  label: string
  onClick?: () => void
  href?: string
  variant?: 'primary' | 'secondary'
}

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: EmptyStateAction
  secondaryAction?: EmptyStateAction
  className?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'minimal' | 'card'
}

const sizeClasses = {
  sm: { wrapper: 'py-6 px-3', icon: 'w-10 h-10', iconWrapper: 'w-14 h-14 mb-3', title: 'text-base', desc: 'text-xs' },
  md: { wrapper: 'py-12 px-4', icon: 'w-12 h-12', iconWrapper: 'w-20 h-20 mb-4', title: 'text-lg', desc: 'text-sm' },
  lg: { wrapper: 'py-16 px-6', icon: 'w-16 h-16', iconWrapper: 'w-24 h-24 mb-6', title: 'text-xl', desc: 'text-base' },
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className = '',
  size = 'md',
  variant = 'default',
}) => {
  const navigate = useNavigate()
  const s = sizeClasses[size]

  const handleAction = (act: EmptyStateAction) => {
    if (act.onClick) {
      act.onClick()
    } else if (act.href) {
      navigate(act.href)
    }
  }

  const content = (
    <div className={`flex flex-col items-center justify-center ${s.wrapper} ${className}`}>
      {Icon && (
        <div className={`flex items-center justify-center ${s.iconWrapper} bg-gray-100 dark:bg-night-100 rounded-full`}>
          <Icon className={`${s.icon} text-gray-400 dark:text-gray-500`} />
        </div>
      )}

      <h3 className={`${s.title} font-semibold text-gray-900 dark:text-gray-100 mb-2 text-center`}>
        {title}
      </h3>

      {description && (
        <p className={`${s.desc} text-gray-600 dark:text-gray-400 text-center max-w-md mb-6`}>
          {description}
        </p>
      )}

      {(action || secondaryAction) && (
        <div className="flex items-center gap-3">
          {action && (
            <button
              onClick={() => handleAction(action)}
              className={
                action.variant === 'secondary'
                  ? 'px-4 py-2 border border-gray-300 dark:border-night-50 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-night-100 transition-colors text-sm font-medium'
                  : 'px-4 py-2 bg-pulse text-night rounded-lg hover:bg-pulse-600 transition-colors text-sm font-semibold'
              }
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={() => handleAction(secondaryAction)}
              className="px-4 py-2 border border-gray-300 dark:border-night-50 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-night-100 transition-colors text-sm font-medium"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  )

  if (variant === 'card') {
    return (
      <div className="rounded-2xl border border-gray-100 dark:border-night-100 bg-white dark:bg-night-50 shadow-card">
        {content}
      </div>
    )
  }

  return content
}

export const EmptyOrders: React.FC<{ onCreateOrder?: () => void }> = ({ onCreateOrder }) => (
  <EmptyState
    icon={ShoppingCart}
    title="No orders yet"
    description="Orders will appear here once customers start placing them. Create your first order to get started."
    action={onCreateOrder ? { label: 'Create Order', onClick: onCreateOrder } : { label: 'Create Order', href: '/sales/orders/create' }}
    variant="card"
  />
)

export const EmptyInvoices: React.FC<{ onCreateInvoice?: () => void }> = ({ onCreateInvoice }) => (
  <EmptyState
    icon={FileText}
    title="No invoices found"
    description="Invoices will be generated from confirmed orders. Create an invoice to bill your customers."
    action={onCreateInvoice ? { label: 'Create Invoice', onClick: onCreateInvoice } : { label: 'Create Invoice', href: '/sales/invoices/create' }}
    variant="card"
  />
)

export const EmptyCustomers: React.FC<{ onCreateCustomer?: () => void }> = ({ onCreateCustomer }) => (
  <EmptyState
    icon={Users}
    title="No customers yet"
    description="Start building your customer base. Add customers manually or import them from a CSV file."
    action={onCreateCustomer ? { label: 'Add Customer', onClick: onCreateCustomer } : { label: 'Add Customer', href: '/customers/create' }}
    secondaryAction={{ label: 'Import Customers', href: '/customers', variant: 'secondary' }}
    variant="card"
  />
)

export const EmptyProducts: React.FC<{ onCreateProduct?: () => void }> = ({ onCreateProduct }) => (
  <EmptyState
    icon={Package}
    title="No products found"
    description="Add products to your catalog to start selling. You can add them manually or import in bulk."
    action={onCreateProduct ? { label: 'Add Product', onClick: onCreateProduct } : { label: 'Add Product', href: '/products/create' }}
    variant="card"
  />
)

export const EmptyInventory: React.FC = () => (
  <EmptyState
    icon={Package}
    title="No inventory data"
    description="Inventory records will appear once stock movements are tracked. Start by receiving stock into your warehouse."
    action={{ label: 'Record Receipt', href: '/inventory/receipts/create' }}
    variant="card"
  />
)

export const EmptyVisits: React.FC = () => (
  <EmptyState
    icon={MapPin}
    title="No visits recorded"
    description="Field visits will appear here once agents start their routes. Schedule visits to get started."
    action={{ label: 'Schedule Visit', href: '/field-operations/visits/create' }}
    variant="card"
  />
)

export const EmptyVanSales: React.FC = () => (
  <EmptyState
    icon={Truck}
    title="No van sales data"
    description="Van sales records will appear once drivers start their routes and log transactions."
    action={{ label: 'Create Route', href: '/van-sales/routes/create' }}
    variant="card"
  />
)

export const EmptyPayments: React.FC = () => (
  <EmptyState
    icon={DollarSign}
    title="No payments found"
    description="Payments will appear here once they are recorded against invoices or orders."
    action={{ label: 'Record Payment', href: '/sales/payments/create' }}
    variant="card"
  />
)

export const EmptySurveys: React.FC = () => (
  <EmptyState
    icon={ClipboardList}
    title="No surveys yet"
    description="Create surveys to collect field data from your agents. Surveys help track shelf displays, customer feedback, and more."
    action={{ label: 'Create Survey', href: '/surveys/create' }}
    variant="card"
  />
)

export const EmptyCampaigns: React.FC = () => (
  <EmptyState
    icon={Megaphone}
    title="No campaigns found"
    description="Marketing campaigns will appear here. Create a campaign to coordinate your field marketing activities."
    action={{ label: 'Create Campaign', href: '/marketing/campaigns/create' }}
    variant="card"
  />
)

export const EmptyReports: React.FC = () => (
  <EmptyState
    icon={BarChart3}
    title="No reports available"
    description="Reports will be generated from your business data. Make sure you have transaction data to generate meaningful reports."
    action={{ label: 'View Report Templates', href: '/reports/templates' }}
    variant="card"
  />
)

export const EmptyAnalytics: React.FC<{ area?: string }> = ({ area = 'this area' }) => (
  <EmptyState
    icon={BarChart3}
    title="No analytics data yet"
    description={`Analytics for ${area} will populate as data is collected. Start recording transactions to see insights.`}
    size="sm"
  />
)

export const EmptyBrands: React.FC = () => (
  <EmptyState
    icon={Star}
    title="No brands found"
    description="Add brands to organize your products and track brand-level performance."
    action={{ label: 'Add Brand', href: '/brands/create' }}
    variant="card"
  />
)

export const EmptyCommissions: React.FC = () => (
  <EmptyState
    icon={DollarSign}
    title="No commissions found"
    description="Commission records will appear once rules are configured and sales are processed."
    action={{ label: 'Configure Rules', href: '/commissions' }}
    variant="card"
  />
)

export const EmptyReturns: React.FC = () => (
  <EmptyState
    icon={ShoppingCart}
    title="No returns recorded"
    description="Sales returns will appear here once they are processed."
    action={{ label: 'Process Return', href: '/sales/returns/create' }}
    variant="card"
  />
)

export const EmptyCreditNotes: React.FC = () => (
  <EmptyState
    icon={FileText}
    title="No credit notes found"
    description="Credit notes will appear here when issued against invoices or returns."
    action={{ label: 'Create Credit Note', href: '/sales/credit-notes/create' }}
    variant="card"
  />
)

export default EmptyState
