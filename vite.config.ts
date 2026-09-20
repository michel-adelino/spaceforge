import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build:single` bundles everything (JS + CSS) into one self-contained HTML file.
export default defineConfig({
  plugins: [react(), ...(process.env.SINGLE ? [viteSingleFile()] : [])],
  // GitHub Pages serves the site from /<repo>/, so the workflow sets BASE_PATH=/<repo>/.
  base: process.env.BASE_PATH ?? '/',
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  server: { host: true },
});
