import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor_firebase: ['firebase/app', 'firebase/firestore'],
          vendor_charts: ['chart.js'],
          vendor_export: ['xlsx', 'pptxgenjs', 'jszip', 'html2canvas']
        }
      }
    }
  }
});
