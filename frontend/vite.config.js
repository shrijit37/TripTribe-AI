import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,    
    proxy: {
      // No rewrite: the backend mounts routes at /api/*, same as prod
      // nginx. Stripping /api here made every dev API call 404.
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      }
    }
  }
});
