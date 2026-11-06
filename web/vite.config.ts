import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // During development (npm run dev), pass /api requests on to the Python server.
  server: { proxy: { '/api': 'http://127.0.0.1:8000' } },
})
