import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Cổng máy chủ API khi chạy trên máy; đặt API_PORT nếu 8787 đang bận.
const api = 'http://localhost:' + (process.env.API_PORT || 8787);

export default defineConfig({
  plugins: [react()],
  // Khi chạy trên máy, chuyển /api sang máy chủ API (cd api && npm run dev)
  server: { proxy: { '/api': api } },
  preview: { proxy: { '/api': api } },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        troLy: resolve(__dirname, 'tro-ly/index.html'),
        matBang: resolve(__dirname, 'mat-bang/index.html'),
        quanTri: resolve(__dirname, 'quan-tri/index.html')
      }
    }
  }
});
