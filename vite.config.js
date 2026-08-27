import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import fs from 'fs'
import path from 'path'

// Vite plugin: serve /sw.js from public/ with correct MIME type.
// Without this, the Vite dev server SPA-fallback serves index.html for /sw.js,
// causing SW registration to fail ("unsupported MIME type 'text/html'").
// The SW bypasses CDN cache for Vite dep chunks to prevent duplicate React.
function serveServiceWorker() {
  return {
    name: 'serve-service-worker',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url || '').split('?')[0]
        if (pathname === '/sw.js') {
          const swPath = path.resolve('public/sw.js')
          if (fs.existsSync(swPath)) {
            res.setHeader('Content-Type', 'application/javascript')
            res.end(fs.readFileSync(swPath, 'utf8'))
            return
          }
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error',
  plugins: [
    serveServiceWorker(),
    base44({
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
  ],
  resolve: {
    dedupe: ['react', 'react-dom', 'react-router-dom'],
  },
  optimizeDeps: {
    // List all deps EXCEPT react/jsx-dev-runtime and react/jsx-runtime.
    // Those two must NOT be pre-bundled separately — doing so creates a
    // second copy of React's internals (ReactCurrentDispatcher), causing
    // "dispatcher.useState is null" (Invalid hook call).
    // Vite handles jsx-dev-runtime automatically via @vitejs/plugin-react.
    include: [
      'react', 'react-dom',
      'react-router-dom', 'framer-motion', 'lodash', 'moment',
      'date-fns', 'lucide-react', 'recharts', '@tanstack/react-query',
      'react-hook-form', 'zod', '@hookform/resolvers', 'class-variance-authority',
      'clsx', 'tailwind-merge', 'cmdk', 'react-leaflet', 'react-day-picker',
      'react-markdown', 'sonner', 'react-hot-toast', 'vaul', 'canvas-confetti',
      'html2canvas', 'jspdf', 'input-otp', 'embla-carousel-react',
      'react-resizable-panels', 'next-themes', 'xlsx',
      '@base44/sdk', '@base44/sdk/dist/utils/axios-client',
    ],
  },
});