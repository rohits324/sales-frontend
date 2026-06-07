import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    cors: true,
    proxy: {
      '/api/products': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
      '/api/orders': {
        target: 'http://localhost:8082',
        changeOrigin: true,
      }
    }
  }
})
