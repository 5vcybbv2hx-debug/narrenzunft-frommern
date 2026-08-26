import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import fs from 'fs'
import path from 'path'

// Prevents the "dispatcher.useState is null" (Invalid hook call) error.
//
// Root cause: Vite re-optimizes deps multiple times as it discovers new
// imports (react-router-dom, date-fns, lucide-react, …) that aren't in the
// plugin's optimizeDeps.include list. Each re-optimization creates a new
// browserHash, but the in-memory transform cache for already-transformed
// source files keeps the OLD hash. The browser then loads the same React
// chunk under two different ?v=hash URLs → two module instances →
// ReactCurrentDispatcher is null → useState crashes.
//
// Fix: (1) list every dep the app uses so Vite optimizes them all in ONE pass
// (stable browserHash, no re-optimization), (2) force a fresh optimization on
// every server start, (3) invalidate the module graph so source files are
// re-transformed with the current hash, (4) dedupe React resolution.
function fixStaleTransformCache() {
  return {
    name: 'fix-stale-transform-cache',
    configureServer(server) {
      // Delete the on-disk dep cache so Vite re-optimizes from scratch
      const viteCacheDir = path.join(process.cwd(), 'node_modules', '.vite');
      if (fs.existsSync(viteCacheDir)) {
        fs.rmSync(viteCacheDir, { recursive: true, force: true });
      }
      // Invalidate all cached module transforms so source files get
      // re-transformed with the fresh dep hashes on first request
      server.httpServer?.on('listening', () => {
        server.moduleGraph.invalidateAll();
      });
    },
  };
}

// Every package the app imports — listing them all here ensures Vite does a
// single optimization pass with one stable browserHash, instead of
// re-optimizing each time it discovers a new dep.
const ALL_DEPS = [
  'react', 'react-dom', 'react/jsx-dev-runtime', 'react/jsx-runtime',
  'react-router-dom', 'framer-motion', 'lodash', 'moment', 'react-quill',
  'date-fns', 'lucide-react', 'recharts', '@tanstack/react-query',
  'react-hook-form', 'zod', '@hookform/resolvers', 'class-variance-authority',
  'clsx', 'tailwind-merge', 'cmdk', 'react-leaflet', 'react-day-picker',
  'react-markdown', 'sonner', 'react-hot-toast', 'vaul', 'canvas-confetti',
  'html2canvas', 'jspdf', 'input-otp', 'embla-carousel-react',
  'react-resizable-panels', 'next-themes', 'xlsx',
  '@base44/sdk', '@base44/sdk/dist/utils/axios-client',
];

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
    fixStaleTransformCache(),
  ],
  resolve: {
    dedupe: ['react', 'react-dom', 'react-router-dom'],
  },
  optimizeDeps: {
    force: true,
    include: ALL_DEPS,
  },
});