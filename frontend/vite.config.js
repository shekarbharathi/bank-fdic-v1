import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true
  },
  preview: {
    port: 4173,
    host: true,
    strictPort: false,
    cors: true,
    // Disable host checking - allow all hosts for Railway
    // Railway generates dynamic subdomains, so we need to allow all
    // This is set via command line flag in package.json scripts
  }
})
