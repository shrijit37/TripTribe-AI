import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    // proxy: { ... } // Remove proxy if using absolute URLs in frontend code
  },
  cors: {
    origin: [
      'http://localhost:5173',
      'http://<your-pc-lan-ip>:5173',
      'https://your-frontend-domain.com'
    ],
    credentials: true
  }
});