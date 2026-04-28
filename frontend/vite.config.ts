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
    // Full PWA. The previous attempt (earlier today) had three failure modes
    // each addressed below:
    //   1. Stale precached index.html served by NavigationRoute meant users saw
    //      old chunk hashes after deploys. -> Index.html is NOT precached;
    //      navigation uses NetworkFirst so an online user always gets fresh HTML.
    //   2. The inline cleanup script in index.html unregistered every SW on
    //      every load. -> Removed in this same commit.
    //   3. injectRegister:'auto' fought against the cleanup script via a
    //      register/unregister loop. -> injectRegister:false; main.tsx
    //      registers the SW once after first paint.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'favicon.svg', 'fieldvibe-icon.svg'],
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Precache ONLY static, non-versioned assets. Hashed JS/CSS are
        // CacheFirst at runtime — hash in filename guarantees safety. HTML
        // is never precached so a deploy is always visible immediately on
        // refresh.
        globPatterns: [
          'manifest.webmanifest',
          'icon-*.png',
          'favicon.{ico,svg}',
          'fieldvibe-*.svg',
        ],
        maximumFileSizeToCacheInBytes: 1024 * 1024,
        runtimeCaching: [
          {
            // Navigations: try the network for ~3s, then fall back to a cached
            // copy of the last index.html we saw. Ensures users see fresh code
            // when online; offline still loads the app shell.
            urlPattern: ({ request, sameOrigin }) => sameOrigin && request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'navigation-cache',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Production API origin — NetworkFirst, GET only (Workbox default).
            // POST /auth/login etc. pass through to network unmodified.
            urlPattern: ({ url }) => url.origin === 'https://fieldvibe-api.vantax.co.za' && url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 5 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 5 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Hashed JS/CSS in /assets/ — immutable; safe to CacheFirst with a
            // long TTL. Cleared on activate via cleanupOutdatedCaches.
            urlPattern: ({ url, sameOrigin }) => sameOrigin && /^\/assets\/.+\.(?:js|css|woff2?)$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Photos / icons — long TTL, capped entries so the cache doesn't
            // grow unbounded for agents who upload many photos.
            urlPattern: ({ url }) => /\.(?:png|jpe?g|gif|webp|svg|ico)$/i.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
        // Critical: never let the SW intercept /api/ navigation fallback or
        // /auth/* navigation fallback. Auth pages must always come from the
        // network.
        navigateFallback: undefined,
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
    // emptyOutDir prevents leftover chunks from prior builds polluting the
    // workbox precache (this was the cause of three different index-*.js
    // hashes appearing in the deployed sw.js earlier today).
    emptyOutDir: true,
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
