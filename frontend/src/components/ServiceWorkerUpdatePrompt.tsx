import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export function ServiceWorkerUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
    },
    onRegisterError(error) {
    },
  })

  const close = () => {
    setNeedRefresh(false)
  }

  return (
    <>
      {needRefresh && (
        <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-sm z-50 border border-gray-100">
          <div className="flex items-start">
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-900">
                Update Available
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                A new version of the app is available. Reload to update.
              </p>
            </div>
          </div>
          <div className="mt-4 flex space-x-3">
            <button
              onClick={() => updateServiceWorker(true)}
              className="flex-1 bg-primary-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-primary-700"
            >
              Reload
            </button>
            <button
              onClick={close}
              className="flex-1 bg-gray-100 text-gray-700 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-200"
            >
              Later
            </button>
          </div>
        </div>
      )}
    </>
  )
}
