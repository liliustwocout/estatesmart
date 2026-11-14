import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        troLy: resolve(__dirname, 'tro-ly/index.html'),
        matBang: resolve(__dirname, 'mat-bang/index.html')
      }
    }
  }
});
