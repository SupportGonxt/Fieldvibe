import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Standalone customer-portal app. No PWA shell (staff-only concern lives in
// frontend/vite.config.ts) — this app is a plain SPA that only talks to
// /portal/* backend routes.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 12100,
    cors: true,
    strictPort: false,
    proxy: {
      // Mirrors the backend target frontend/vite.config.ts proxies to.
      '/portal': {
        target: 'https://fieldvibe-api.reshigan-085.workers.dev',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 12100,
    cors: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    minify: 'esbuild',
  },
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
})
