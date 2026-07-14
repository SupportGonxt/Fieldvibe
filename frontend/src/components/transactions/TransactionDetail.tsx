import { Link } from 'react-router-dom'
import { ArrowLeft, Edit, Trash2, RotateCcw, Clock, User } from 'lucide-react'
import { Button } from '../ui/Button'

interface DetailField {
  label: string
  value: any
  render?: (value: any) => React.ReactNode
}

interface AuditEntry {
  timestamp: string
  user: string
  action: string
  details?: string
}

interface TransactionDetailProps {
  title: string
  fields: DetailField[]
  auditTrail?: AuditEntry[]
  onEdit?: () => void
  onReverse?: () => void
  onDelete?: () => void
  editPath?: string
  backPath: string
  status?: string
  statusColor?: 'green' | 'yellow' | 'red' | 'gray'
}

export default function TransactionDetail({
  title,
  fields,
  auditTrail = [],
  onEdit,
  onReverse,
  onDelete,
  editPath,
  backPath,
  status,
  statusColor = 'gray'
}: TransactionDetailProps) {
  const statusColors = {
    green: 'bg-green-100 text-green-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    red: 'bg-red-100 text-red-800',
    gray: 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={backPath}>
            <Button variant="secondary" size="sm">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            {status && (
              <span className={`inline-block mt-2 px-3 py-1 text-sm font-medium rounded-full ${statusColors[statusColor]}`}>
                {status}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onReverse && (
            <Button variant="secondary" size="sm" onClick={onReverse}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Reverse
            </Button>
          )}
          {onDelete && (
            <Button variant="danger" size="sm" onClick={onDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          )}
          {(onEdit || editPath) && (
            editPath ? (
              <Link to={editPath}>
                <Button variant="primary" size="sm">
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              </Link>
            ) : (
              <Button variant="primary" size="sm" onClick={onEdit}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            )
          )}
        </div>
      </div>

      {/* Details */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {fields.map((field, index) => (
            <div key={index}>
              <dt className="text-sm font-medium text-gray-500 mb-1">
                {field.label}
              </dt>
              <dd className="text-sm text-gray-900">
                {field.render ? field.render(field.value) : field.value || '-'}
              </dd>
            </div>
          ))}
        </div>
      </div>

      {/* Audit Trail */}
      {auditTrail.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Audit Trail
          </h2>
          <div className="space-y-4">
            {auditTrail.map((entry, index) => (
              <div key={index} className="flex gap-4 pb-4 border-b border-gray-100 last:border-0">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-info-100 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-info-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">{entry.action}</p>
                    <p className="text-xs text-gray-500">{entry.timestamp}</p>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{entry.user}</p>
                  {entry.details && (
                    <p className="text-sm text-gray-500 mt-1">{entry.details}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
