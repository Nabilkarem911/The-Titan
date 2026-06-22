import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  main: {
    build: {
      outDir: 'dist/main',
      lib: { entry: 'src/main/index.ts' },
      rollupOptions: {
        external: ['electron', 'screenshot-desktop', 'electron-store', 'ws'],
      },
    },
  },
  preload: {
    build: {
      outDir: 'dist/preload',
      lib: { entry: 'src/preload/index.ts' },
      rollupOptions: {
        external: ['electron'],
      },
    },
  },
  renderer: {
    root: 'src/renderer',
    build: {
      outDir: 'dist/renderer',
      rollupOptions: {
        input: resolve(__dirname, 'src/renderer/index.html'),
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer'),
      },
    },
  },
});
