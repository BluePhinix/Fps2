import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  // Relative asset paths so the built game works from a GitHub Pages
  // subdirectory (https://<user>.github.io/<repo>/) as well as from a root domain.
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/engine': path.resolve(__dirname, './src/engine'),
      '@/audio': path.resolve(__dirname, './src/audio'),
      '@/game': path.resolve(__dirname, './src/game'),
      '@/entities': path.resolve(__dirname, './src/entities'),
      '@/systems': path.resolve(__dirname, './src/systems'),
      '@/ui': path.resolve(__dirname, './src/ui'),
      '@/utils': path.resolve(__dirname, './src/utils'),
    },
  },
  build: {
    // Modern-but-safe: anything that can run this scene supports ES2020, and
    // it avoids shipping transpilation bloat to phones on slow connections.
    target: 'es2020',
    chunkSizeWarningLimit: 1800,
    rollupOptions: {
      output: {
        // Three + Rapier are the bulk of the bundle. Splitting them means the
        // browser can cache them across deploys and start rendering sooner.
        manualChunks: {
          three: ['three'],
          react: ['react', 'react-dom'],
          rapier: ['@dimforge/rapier3d-compat', '@react-three/rapier'],
        },
      },
    },
  },
  server: {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
    host: '::',
    port: 5173,
    allowedHosts: true,
    cors: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        ws: true
      },
    },
  },
})
