import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// Set ENABLE_PWA=true to bundle the service worker (requires Node 20+).
// In dev/Node 18 we keep the manifest for installability but skip the SW build.
const enablePWA = process.env.ENABLE_PWA === 'true';

export default defineConfig({
  plugins: [
    react(),
    ...(enablePWA
      ? [
          VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.svg'],
            manifest: {
              name: 'Renovation Expense Tracker',
              short_name: 'RenoTrack',
              description: 'Evidența cheltuielilor de renovare',
              theme_color: '#0f172a',
              background_color: '#0f172a',
              display: 'standalone',
              start_url: '/',
              icons: [
                { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
                { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
                { src: 'pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
              ],
            },
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': 'http://127.0.0.1:7071',
    },
  },
});
