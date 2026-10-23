import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import regionArranger from './scripts/regionDevServer.js'

export default defineConfig({
  plugins: [react(), regionArranger()],
  server: {
    port: 5173,
    open: true,
    watch: { ignored: ['**/map-source/**'] }
  },
  build: {
    sourcemap: true
  }
})
