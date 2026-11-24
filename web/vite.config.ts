import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// the python server (python -m automate serve ...) answers /api; point AUTOMATE_API at it when it isnt on 8765
const api = process.env['AUTOMATE_API'] ?? 'http://127.0.0.1:8765'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { chunkSizeWarningLimit: 1600 },
  server: { proxy: { '/api': { target: api, changeOrigin: true } } },
})
