import { defineConfig } from 'vite';

export default defineConfig({
  // IMPORTANT for Capacitor: assets must use relative paths inside the WebView
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Chunk size warning threshold (Phaser is large)
    chunkSizeWarningLimit: 3000,
  },
  server: {
    port: 5173,
    host: true,
  },
});
