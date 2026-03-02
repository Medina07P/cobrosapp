import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // El proxy ayuda a que React pueda hablar con el backend sin errores de CORS en desarrollo
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        // Eliminamos el prefijo /api antes de enviarlo al backend
        // Ejemplo: fetch('/api/clientes') se convierte en http://localhost:3000/clientes
        rewrite: (path) => path.replace(/^\/api/, ''),
      }
    }
  }
})