import { useEffect, useCallback } from 'react'

interface Shortcut {
  key: string
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
  handler: () => void
  description: string
}

interface UseKeyboardShortcutsOptions {
  shortcuts: Shortcut[]
  enabled?: boolean
}

export function useKeyboardShortcuts({ shortcuts, enabled = true }: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) return

    for (const shortcut of shortcuts) {
      const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase()
      const ctrlMatch = !!shortcut.ctrl === (e.ctrlKey || e.metaKey)
      const altMatch = !!shortcut.alt === e.altKey
      const shiftMatch = !!shortcut.shift === e.shiftKey

      if (keyMatch && ctrlMatch && altMatch && shiftMatch) {
        e.preventDefault()
        shortcut.handler()
        return
      }
    }
  }, [shortcuts, enabled])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

export function formatShortcut(shortcut: Partial<Shortcut>): string {
  const parts: string[] = []
  if (shortcut.ctrl) parts.push(navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl')
  if (shortcut.alt) parts.push('Alt')
  if (shortcut.shift) parts.push('Shift')
  if (shortcut.key) parts.push(shortcut.key.toUpperCase())
  return parts.join('+')
}

export type { Shortcut }
