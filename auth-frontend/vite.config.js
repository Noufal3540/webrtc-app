// auth-frontend/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/auth/', // Base path for the auth frontend
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    port: 3001, // Different port from your main server
    proxy: {
      '/register': 'http://localhost:3000',
      '/login': 'http://localhost:3000',
      '/': 'http://localhost:3000'
    }
  }
})