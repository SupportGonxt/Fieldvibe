import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster, toast } from 'react-hot-toast'
import App from './App'
import './index.css'

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
