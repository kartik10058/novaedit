import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so the built index.html loads assets via file:// inside Electron.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  build: { outDir: 'dist', chunkSizeWarningLimit: 8000 },
});
