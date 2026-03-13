import React, { useState, useEffect } from 'react'
import { WifiOff, Wifi, AlertCircle } from 'lucide-react'

interface OfflineIndicatorProps {
  className?: string
  showWhenOnline?: boolean
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ 
  className = '',
  showWhenOnline = false
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [showNotification, setShowNotification] = useState(false)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setShowNotification(true)
      setTimeout(() => setShowNotification(false), 3000)
    }

    const handleOffline = () => {
      setIsOnline(false)
      setShowNotification(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (isOnline && !showWhenOnline && !showNotification) {
    return null
  }

  return (
    <div className={`fixed top-4 right-4 z-50 ${className}`}>
      <div
        className={`
          flex items-center space-x-2 px-4 py-2 rounded-lg shadow-lg transition-all duration-300
          ${isOnline 
            ? 'bg-green-500 text-white' 
            : 'bg-red-500 text-white'
          }
          ${showNotification ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}
        `}
      >
        {isOnline ? (
          <>
            <Wifi className="w-4 h-4" />
            <span className="text-sm font-medium">Back online</span>
          </>
        ) : (
          <>
            <WifiOff className="w-4 h-4" />
            <span className="text-sm font-medium">You're offline</span>
          </>
        )}
      </div>
    </div>
  )
}

// Hook for online/offline status
export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}

// Offline banner component
export const OfflineBanner: React.FC<{ className?: string }> = ({ className = '' }) => {
  const isOnline = useOnlineStatus()

  if (isOnline) return null

  return (
    <div className={`bg-yellow-50 border-l-4 border-yellow-400 p-4 ${className}`}>
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <AlertCircle className="h-5 w-5 text-yellow-400" />
        </div>
        <div className="ml-3">
          <p className="text-sm text-yellow-700">
            <strong>You're currently offline.</strong> Some features may not be available until you reconnect.
          </p>
        </div>
      </div>
    </div>
  )
}

// Offline storage utilities
export class OfflineStorage {
  private static readonly PREFIX = 'fieldvibe_offline_'

  static save(key: string, data: any): void {
    try {
      const serialized = JSON.stringify({
        data,
        timestamp: Date.now(),
        version: '1.0'
      })
      localStorage.setItem(this.PREFIX + key, serialized)
    } catch (error) {
      console.warn('Failed to save offline data:', error)
    }
  }

  static load<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(this.PREFIX + key)
      if (!item) return null

      const parsed = JSON.parse(item)
      return parsed.data as T
    } catch (error) {
      console.warn('Failed to load offline data:', error)
      return null
    }
  }

  static remove(key: string): void {
    localStorage.removeItem(this.PREFIX + key)
  }

  static clear(): void {
    const keys = Object.keys(localStorage).filter(key => key.startsWith(this.PREFIX))
    keys.forEach(key => localStorage.removeItem(key))
  }

  static getAll(): Record<string, any> {
    const result: Record<string, any> = {}
    const keys = Object.keys(localStorage).filter(key => key.startsWith(this.PREFIX))
    
    keys.forEach(key => {
      const cleanKey = key.replace(this.PREFIX, '')
      result[cleanKey] = this.load(cleanKey)
    })

    return result
  }
}

// Simple hook for offline data management
export function useOfflineData(key: string, initialData?: any) {
  const [data, setData] = useState<any>(() => {
    const saved = OfflineStorage.load(key)
    return saved || initialData || null
  })

  const saveData = (newData: any) => {
    setData(newData)
    OfflineStorage.save(key, newData)
  }

  const clearData = () => {
    setData(null)
    OfflineStorage.remove(key)
  }

  return { data, saveData, clearData }
}

export default OfflineIndicator