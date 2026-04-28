import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  // Note: Vite automatically loads .env.production during production builds
  // Do NOT override VITE_* env vars in the define block - let Vite handle them
  plugins: [
    react(),
    // PWA: silent auto-update.
    // - registerType 'autoUpdate' + skipWaiting + clientsClaim = new SW activates on
    //   the next page load with no user prompt (per user preference).
    // - cleanupOutdatedCaches sweeps stale precache entries each activation, which
    //   addresses the original "stale cache" concern that led to the SW being disabled.
    // - API requests use NetworkFirst with a 10s timeout so spotty mobile networks
    //   fall back to cache instead of spinning. Cache TTL on API is 5 min — short
    //   enough that data feels fresh, long enough to survive a brief drop.
    // - Static JS/CSS/fonts are CacheFirst (immutable hashed filenames).
    // - Images are CacheFirst with a 7-day TTL and a 200-entry cap so the cache
    //   doesn't grow unbounded for agents who upload lots of photos.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'favicon.svg', 'fieldvibe-icon.svg'],
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // Don't precache big chunks; let runtime caching handle JS lazily so first
        // install isn't a giant download.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            // Production API origin
            urlPattern: ({ url }) => url.origin === 'https://fieldvibe-api.vantax.co.za' && url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 5 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Same-origin /api/* (covers preview env and reverse-proxied dev)
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 5 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Image / photo R2 fetches (admin photo review etc.) — long cache, capped.
            urlPattern: /\.(?:png|jpe?g|gif|webp|svg)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\.(?:js|css|woff2?)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'FieldVibe',
        short_name: 'FieldVibe',
        description: 'Field Operations & Sales Intelligence Platform',
        theme_color: '#0A0F1C',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon-72x72.png',   sizes: '72x72',   type: 'image/png' },
          { src: '/icon-96x96.png',   sizes: '96x96',   type: 'image/png' },
          { src: '/icon-128x128.png', sizes: '128x128', type: 'image/png' },
          { src: '/icon-144x144.png', sizes: '144x144', type: 'image/png' },
          { src: '/icon-152x152.png', sizes: '152x152', type: 'image/png' },
          { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-384x384.png', sizes: '384x384', type: 'image/png' },
          { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
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
