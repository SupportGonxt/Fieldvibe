import React, { useEffect, useRef, useState, useCallback } from 'react'
import { X, Search } from 'lucide-react'

interface MobileBottomSheetProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  showSearch?: boolean
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  snapPoints?: number[]
}

export const MobileBottomSheet: React.FC<MobileBottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
  showSearch = false,
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  snapPoints = [0.5, 0.9],
}) => {
  const [currentSnap, setCurrentSnap] = useState(0)
  const [translateY, setTranslateY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const startYRef = useRef(0)
  const currentYRef = useRef(0)

  const getSheetHeight = useCallback(() => {
    return window.innerHeight * snapPoints[currentSnap]
  }, [currentSnap, snapPoints])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      setCurrentSnap(0)
      setTranslateY(0)
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => { document.body.style.overflow = 'unset' }
  }, [isOpen])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY
    currentYRef.current = 0
    setIsDragging(true)
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return
    const deltaY = e.touches[0].clientY - startYRef.current
    currentYRef.current = deltaY
    if (deltaY > 0) {
      setTranslateY(deltaY)
    } else if (currentSnap < snapPoints.length - 1) {
      setTranslateY(deltaY * 0.3)
    }
  }, [isDragging, currentSnap, snapPoints.length])

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false)
    const deltaY = currentYRef.current

    if (deltaY > 100) {
      if (currentSnap === 0) {
        onClose()
      } else {
        setCurrentSnap(prev => Math.max(0, prev - 1))
      }
    } else if (deltaY < -50 && currentSnap < snapPoints.length - 1) {
      setCurrentSnap(prev => Math.min(snapPoints.length - 1, prev + 1))
    }
    setTranslateY(0)
  }, [currentSnap, snapPoints.length, onClose])

  if (!isOpen) return null

  const sheetHeight = getSheetHeight()

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 bg-white dark:bg-night-50 rounded-t-2xl shadow-2xl transition-transform duration-200 ease-out"
        style={{
          height: `${sheetHeight}px`,
          transform: `translateY(${Math.max(0, translateY)}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out, height 0.3s ease-out',
        }}
      >
        {/* Drag handle */}
        <div
          className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-10 h-1 bg-gray-300 dark:bg-night-100 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3">
          {title && <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>}
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-night-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Search */}
        {showSearch && (
          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchValue}
                onChange={e => onSearchChange?.(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-10 pr-4 py-3 text-base border border-gray-200 dark:border-night-100 rounded-xl bg-gray-50 dark:bg-night-200 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-safe" style={{ maxHeight: `calc(${sheetHeight}px - 120px)` }}>
          {children}
        </div>
      </div>
    </div>
  )
}
