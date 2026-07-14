import { X, Download } from 'lucide-react'
import { usePwaInstall } from '../hooks/usePwaInstall'

/** Dismissible install prompt for staff dashboard (agents have their own inline card). */
export default function PwaInstallBanner() {
  const { showPrompt, promptInstall, dismiss } = usePwaInstall()
  if (!showPrompt) return null

  return (
    <div className="fixed bottom-20 lg:bottom-6 left-4 right-4 lg:left-auto lg:right-24 lg:w-80 z-40">
      <div className="relative bg-white dark:bg-[#0A0F1C] border border-gray-200 dark:border-white/10 rounded-2xl p-4 shadow-xl">
        <button
          onClick={dismiss}
          className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
            <Download className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Install FieldVibe</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Add to your home screen for quick access</p>
          </div>
        </div>
        <button
          onClick={promptInstall}
          className="mt-3 w-full py-2.5 bg-gradient-to-r from-primary to-[#00D06E] text-[#0A1628] font-semibold rounded-xl text-sm active:scale-[0.98] transition-transform"
        >
          Install App
        </button>
      </div>
    </div>
  )
}
