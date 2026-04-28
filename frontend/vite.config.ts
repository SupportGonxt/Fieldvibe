import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
// vite-plugin-pwa intentionally not imported. The autoUpdate workbox SW we
// deployed earlier today appears to be breaking field-ops login. Until that's
// diagnosed properly, we ship a no-op SW from /public/sw.js that unregisters
// itself, so any browser still holding the previous SW gets cleaned up.

// https://vitejs.dev/config/
export default defineConfig({
  // Note: Vite automatically loads .env.production during production builds
  // Do NOT override VITE_* env vars in the define block - let Vite handle them
  plugins: [
    react(),
    // PWA disabled (kill switch). See public/sw.js for the no-op SW that replaces
    // the previous workbox SW and unregisters itself.
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 12000,
    cors: true,
    strictPort: false,
    allowedHosts: [
      'work-1-otdktmkeksbigpch.prod-runtime.all-hands.dev',
      'work-1-vmhjvymxmtxtzzmm.prod-runtime.all-hands.dev',
      'localhost',
      '127.0.0.1'
    ],
    hmr: {
      clientPort: 12000
    },
    proxy: {
      '/api': {
        target: 'https://fieldvibe-api.reshigan-085.workers.dev',
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // Log for debugging
            console.log('Proxying request to:', req.url)
            console.log('Original headers:', req.headers)
            
            // Forward X-Tenant-Code header from client, or set default
            const tenantCode = req.headers['x-tenant-code'] || 'DEMO'
            proxyReq.setHeader('X-Tenant-Code', tenantCode)
            
            console.log('Forwarding with X-Tenant-Code:', tenantCode)
          })
        }
      }
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 12000,
    cors: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // T-20: Strip console.log/warn from production builds
    minify: 'esbuild',
    // No manualChunks: every Route in App.tsx already uses lazyWithRetry, which
    // creates a per-route chunk via dynamic import. Hand-rolled manualChunks
    // collapsed all of @mui, lucide, recharts, framer-motion, leaflet, google-maps,
    // dnd-kit etc. into a single 'ui' chunk that loaded on every route — meaning
    // a field-ops agent paid the bundle cost of admin-only deps. Letting Rollup
    // split naturally pushes those deps into the dynamic chunks of the routes
    // that actually import them.
    rollupOptions: {},
    chunkSizeWarningLimit: 1500,
  },
  esbuild: {
    // T-20: Drop console.log and console.warn in production
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom']
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    alias: {
      '../../services/api.service': path.resolve(__dirname, './src/tests/__mocks__/api.service.ts'),
    },
  },
})
