import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Relative base keeps the build path-agnostic so it works on GitHub Pages
// whether served from an org root or a project subpath.
// Routing uses HashRouter, so deep links survive static hosting.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    // Single internal app; ~140KB gzip is fine. Quiet the size advisory.
    chunkSizeWarningLimit: 900,
  },
})
