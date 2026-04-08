import { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [dismissed, setDismissed] = useState(() => {
    try {
      const val = localStorage.getItem('pwa-install-dismissed')
      if (!val) return false
      // Allow re-prompting after 7 days
      const ts = parseInt(val, 10)
      return Date.now() - ts < 7 * 24 * 60 * 60 * 1000
    } catch {
      return false
    }
  })

  useEffect(() => {
    // Check if already installed as standalone PWA
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    if (isStandalone) {
      setIsInstalled(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    const installedHandler = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', installedHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  const promptInstall = async () => {
    if (!deferredPrompt) return false
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    if (outcome === 'accepted') {
      setIsInstalled(true)
      return true
    }
    return false
  }

  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem('pwa-install-dismissed', String(Date.now()))
    } catch { /* ignore */ }
  }

  const showPrompt = !!deferredPrompt && !isInstalled && !dismissed

  return { showPrompt, isInstalled, promptInstall, dismiss }
}
