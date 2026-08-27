import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error',
  plugins: [
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