/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { printsPlugin } from './vite-plugin-prints';

// Standalone AiKit prints app. The root page (index.html → src/print/main.tsx)
// is the print generator GUI; `printsPlugin` adds the dev-only /api/* endpoints
// it calls (list docs, export a doc, stream output). Unit tests run in node —
// pure geometry/scale/tiling logic, no browser or GL.
export default defineConfig({
  plugins: [react(), printsPlugin()],
  // `vite preview` is the deployed serving mode (Railway): listen on all
  // interfaces and accept the platform's domain in the Host header.
  preview: {
    host: true,
    allowedHosts: true
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  test: {
    name: 'unit',
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
});
