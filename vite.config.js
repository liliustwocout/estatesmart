import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  // Khi chạy trên máy, chuyển /api sang máy chủ API (cd api && npm run dev)
  server: { proxy: { '/api': 'http://localhost:8787' } },
  preview: { proxy: { '/api': 'http://localhost:8787' } },
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
