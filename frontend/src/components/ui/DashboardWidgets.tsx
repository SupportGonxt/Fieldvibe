import React, { useState } from 'react'
import { GripVertical, Maximize2, Minimize2, X, Settings } from 'lucide-react'

export interface DashboardWidget {
  id: string
  title: string
  component: React.ReactNode
  size: 'sm' | 'md' | 'lg' | 'full'
  visible: boolean
  order: number
  roles?: string[]
}

interface DashboardWidgetsProps {
  widgets: DashboardWidget[]
  onReorder?: (widgets: DashboardWidget[]) => void
  onToggleVisibility?: (widgetId: string) => void
  onResize?: (widgetId: string, size: DashboardWidget['size']) => void
  editable?: boolean
  userRole?: string
}

const sizeClasses = {
  sm: 'col-span-1',
  md: 'col-span-1 md:col-span-2',
  lg: 'col-span-1 md:col-span-2 lg:col-span-3',
  full: 'col-span-1 md:col-span-2 lg:col-span-4',
}

export const DashboardWidgetGrid: React.FC<DashboardWidgetsProps> = ({
  widgets,
  onReorder,
  onToggleVisibility,
  onResize,
  editable = false,
  userRole,
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [draggedId, setDraggedId] = useState<string | null>(null)

  const visibleWidgets = widgets
    .filter(w => w.visible && (!w.roles || !userRole || w.roles.includes(userRole)))
    .sort((a, b) => a.order - b.order)

  const handleDragStart = (widgetId: string) => {
    setDraggedId(widgetId)
  }

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!draggedId || draggedId === targetId) return
  }

  const handleDrop = (targetId: string) => {
    if (!draggedId || draggedId === targetId || !onReorder) return
    const newWidgets = [...widgets]
    const draggedIdx = newWidgets.findIndex(w => w.id === draggedId)
    const targetIdx = newWidgets.findIndex(w => w.id === targetId)
    if (draggedIdx === -1 || targetIdx === -1) return
    const [moved] = newWidgets.splice(draggedIdx, 1)
    newWidgets.splice(targetIdx, 0, moved)
    newWidgets.forEach((w, i) => { w.order = i })
    onReorder(newWidgets)
    setDraggedId(null)
  }

  const cycleSizes: DashboardWidget['size'][] = ['sm', 'md', 'lg', 'full']

  return (
    <div>
      {editable && (
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              isEditing
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-night-100 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-night-200'
            }`}
          >
            <Settings className="w-4 h-4" />
            {isEditing ? 'Done Editing' : 'Customize Dashboard'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {visibleWidgets.map(widget => (
          <div
            key={widget.id}
            className={`${sizeClasses[widget.size]} ${isEditing ? 'ring-2 ring-dashed ring-blue-300 dark:ring-blue-700' : ''}`}
            draggable={isEditing}
            onDragStart={() => handleDragStart(widget.id)}
            onDragOver={e => handleDragOver(e, widget.id)}
            onDrop={() => handleDrop(widget.id)}
          >
            <div className={`bg-white dark:bg-night-50 rounded-xl border border-gray-200 dark:border-night-100 overflow-hidden transition-shadow ${
              draggedId === widget.id ? 'opacity-50 shadow-lg' : 'shadow-sm hover:shadow-md'
            }`}>
              {/* Widget header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-night-100">
                <div className="flex items-center gap-2">
                  {isEditing && (
                    <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                  )}
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{widget.title}</h3>
                </div>
                {isEditing && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        if (onResize) {
                          const currentIdx = cycleSizes.indexOf(widget.size)
                          const nextIdx = (currentIdx + 1) % cycleSizes.length
                          onResize(widget.id, cycleSizes[nextIdx])
                        }
                      }}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-night-100 rounded text-gray-400"
                      title="Resize"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onToggleVisibility?.(widget.id)}
                      className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-gray-400 hover:text-red-500"
                      title="Hide widget"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Widget content */}
              <div className="p-4">
                {widget.component}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Hidden widgets panel */}
      {isEditing && widgets.filter(w => !w.visible).length > 0 && (
        <div className="mt-6 p-4 bg-gray-50 dark:bg-night-200 rounded-xl">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Hidden Widgets</h4>
          <div className="flex flex-wrap gap-2">
            {widgets.filter(w => !w.visible).map(widget => (
              <button
                key={widget.id}
                onClick={() => onToggleVisibility?.(widget.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white dark:bg-night-50 border border-gray-200 dark:border-night-100 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                <Minimize2 className="w-3.5 h-3.5 text-gray-400" />
                {widget.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
