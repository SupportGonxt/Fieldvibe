import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster, toast } from 'react-hot-toast'
import App from './App'
import { startOfflineSync } from './services/offline-sync'
import './index.css'

// Changes the entry chunk hash so devices with a poisoned immutable
// HTTP-cache entry for the old asset URL fetch a fresh one. Bump the
// date if a stale-asset incident recurs with an unchanged bundle.
// (window assignment, not console.info — esbuild drops console in prod)
;(window as any).__FV_BUILD = '2026-07-08'

// Apply persisted theme from localStorage (instead of forcing dark)
try {
  const stored = localStorage.getItem('fieldvibe-theme')
  if (stored) {
    const parsed = JSON.parse(stored)
    const theme = parsed?.state?.theme
    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }
} catch {
  // Default: no dark class (light mode)
}

// BUG-013: Global error handlers for queries and mutations
const queryCache = new QueryCache({
  onError: (error: unknown) => {
    const msg = error instanceof Error ? error.message : 'An unexpected error occurred'
    if ((error as any)?.status === 401) return // handled by interceptor
    toast.error(msg)
  },
})

const mutationCache = new MutationCache({
  onError: (error: unknown) => {
    const msg = error instanceof Error ? error.message : 'An unexpected error occurred'
    if ((error as any)?.status === 401) return
    toast.error(msg)
  },
})

// Create a client
const queryClient = new QueryClient({
  queryCache,
  mutationCache,
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false
        }
        return failureCount < 3
      },
    },
    mutations: {
      retry: 1,
    },
  },
})

// Durable offline: persist reads to IndexedDB and replay queued writes on reconnect.
startOfflineSync(queryClient)

// Register the service worker after first paint. injectRegister:false in
// vite.config.ts means VitePWA does not auto-inject; we control timing here.
// Wrapped in load+idle so it never delays first interactive frame.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  // Snapshot whether the page is ALREADY controlled by an SW before we
  // register. If it isn't (first-ever install), the controllerchange that
  // clientsClaim fires is benign — we must NOT reload, or we'd wipe whatever
  // the user is typing (especially on the login form).
  const hadControllerOnLoad = !!navigator.serviceWorker.controller

  const register = () => {
    // updateViaCache:'none' — browser bypasses the HTTP cache for BOTH sw.js
    // and its importScripts (push-sw.js) on every update check. Default 'imports'
    // reads push-sw.js from HTTP cache, and the vantax.co.za zone Browser Cache
    // TTL clamps sw.js/push-sw.js to 4h, so a new SW isn't discovered for hours.
    // This makes update discovery independent of the edge cache config.
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then((reg) => {
      let refreshing = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Only reload on a genuine update (post-deploy), not on first install.
        if (!hadControllerOnLoad) return
        if (refreshing) return
        // Loop guard: `refreshing` only lives for one page load, so if the SW keeps
        // taking control (e.g. two builds served alternately by the edge after a
        // deploy), reloading on every controllerchange bricks the app into a
        // permanent full-screen reload flash. Cap auto-reload at once per tab
        // session — the user still picks up the new build once; a thrashing SW is
        // then ignored instead of looping. sessionStorage clears on tab close, so
        // the next real deploy reloads again after they reopen.
        if (sessionStorage.getItem('fv-sw-reloaded')) return
        try { sessionStorage.setItem('fv-sw-reloaded', '1') } catch { /* private mode — best effort */ }
        refreshing = true
        window.location.reload()
      })
      // Poll for SW updates every hour for users who keep the tab open all day.
      if (reg && reg.update) {
        setInterval(() => { try { reg.update() } catch (_) { /* ignore */ } }, 60 * 60 * 1000)
      }
    }).catch(() => {
      // SW registration is best-effort; never block the app on failure.
    })
  }
  if (document.readyState === 'complete') {
    if ('requestIdleCallback' in window) (window as any).requestIdleCallback(register, { timeout: 2000 })
    else setTimeout(register, 1500)
  } else {
    window.addEventListener('load', () => {
      if ('requestIdleCallback' in window) (window as any).requestIdleCallback(register, { timeout: 2000 })
      else setTimeout(register, 1500)
    })
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              duration: 5000,
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </BrowserRouter>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </React.StrictMode>,
)
