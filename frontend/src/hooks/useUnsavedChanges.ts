import { useEffect, useCallback } from 'react'

/**
 * Hook that warns users when they try to leave a page with unsaved changes.
 * Uses window.onbeforeunload for browser tab close/refresh.
 */
export function useUnsavedChanges(hasUnsavedChanges: boolean) {
  const handleBeforeUnload = useCallback(
    (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    },
    [hasUnsavedChanges]
  )

  useEffect(() => {
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [handleBeforeUnload])
}
