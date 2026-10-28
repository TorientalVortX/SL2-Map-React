import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import regionArranger from './scripts/regionDevServer.js'
import buildVersion from './scripts/buildVersion.js'
import locationEditor from './scripts/locationDevServer.js'

export default defineConfig({
  plugins: [react(), regionArranger(), locationEditor(), buildVersion()],
  server: {
    port: 5173,
    open: true,
    watch: { ignored: ['**/map-source/**'] }
  },
  build: {
    sourcemap: true
  }
})
