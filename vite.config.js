import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Custom Vite plugin to resolve HTML partials at dev & build time
 * Syntax: <!-- #include "partials/path/to/file.html" -->
 */
function htmlIncludePlugin() {
  function processIncludes(content) {
    const includeRegex = /<!--\s*#include\s+["']([^"']+)["']\s*-->/g;
    return content.replace(includeRegex, (match, relPath) => {
      const fullPath = path.resolve(process.cwd(), relPath);
      if (fs.existsSync(fullPath)) {
        const fileContent = fs.readFileSync(fullPath, 'utf8');
        return processIncludes(fileContent);
      }
      console.warn(`[html-include] Warning: File not found: ${fullPath}`);
      return match;
    });
  }

  return {
    name: 'html-include',
    configureServer(server) {
      server.watcher.add(path.resolve(process.cwd(), 'partials/**/*.html'));
    },
    handleHotUpdate({ file, server }) {
      if (file.includes('partials') && file.endsWith('.html')) {
        server.ws.send({ type: 'full-reload' });
        return [];
      }
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return processIncludes(html);
      }
    }
  };
}

export default defineConfig({
  plugins: [htmlIncludePlugin()],
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
