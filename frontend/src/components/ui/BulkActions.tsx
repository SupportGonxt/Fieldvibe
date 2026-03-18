import React from 'react'
import { X, Trash2, CheckCircle, XCircle, Download, Tag } from 'lucide-react'

interface BulkAction {
  id: string
  label: string
  icon?: React.ReactNode
  variant?: 'default' | 'danger' | 'success' | 'warning'
  handler: (selectedIds: string[]) => void
}

interface BulkActionsProps {
  selectedIds: string[]
  onClearSelection: () => void
  actions: BulkAction[]
  totalCount?: number
}

const variantStyles = {
  default: 'bg-gray-100 dark:bg-night-100 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-night-200',
  danger: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30',
  success: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30',
  warning: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/30',
}

export const BulkActions: React.FC<BulkActionsProps> = ({
  selectedIds,
  onClearSelection,
  actions,
  totalCount,
}) => {
  if (selectedIds.length === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-white dark:bg-night-50 border border-gray-200 dark:border-night-100 rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3 animate-in slide-in-from-bottom-4">
      <div className="flex items-center gap-2 pr-3 border-r border-gray-200 dark:border-night-100">
        <span className="bg-blue-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
          {selectedIds.length}
        </span>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {totalCount ? `of ${totalCount} ` : ''}selected
        </span>
      </div>

      <div className="flex items-center gap-2">
        {actions.map(action => (
          <button
            key={action.id}
            onClick={() => action.handler(selectedIds)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${variantStyles[action.variant || 'default']}`}
          >
            {action.icon}
            {action.label}
          </button>
        ))}
      </div>

      <button
        onClick={onClearSelection}
        className="ml-2 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-night-100 transition-colors"
        title="Clear selection"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export const defaultBulkActions = {
  delete: (handler: (ids: string[]) => void): BulkAction => ({
    id: 'delete',
    label: 'Delete',
    icon: <Trash2 className="w-4 h-4" />,
    variant: 'danger',
    handler,
  }),
  approve: (handler: (ids: string[]) => void): BulkAction => ({
    id: 'approve',
    label: 'Approve',
    icon: <CheckCircle className="w-4 h-4" />,
    variant: 'success',
    handler,
  }),
  reject: (handler: (ids: string[]) => void): BulkAction => ({
    id: 'reject',
    label: 'Reject',
    icon: <XCircle className="w-4 h-4" />,
    variant: 'danger',
    handler,
  }),
  export: (handler: (ids: string[]) => void): BulkAction => ({
    id: 'export',
    label: 'Export',
    icon: <Download className="w-4 h-4" />,
    variant: 'default',
    handler,
  }),
  tag: (handler: (ids: string[]) => void): BulkAction => ({
    id: 'tag',
    label: 'Tag',
    icon: <Tag className="w-4 h-4" />,
    variant: 'default',
    handler,
  }),
}
