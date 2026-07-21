/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: '/',
        name: 'JE&DA',
        short_name: 'JE&DA',
        description: 'Aplikasi pencatatan penjualan, stok, dan rekap JE&DA',
        lang: 'id',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#E2517E',
        background_color: '#ffffff',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Cache app shell + aset build (termasuk chunk lazy) untuk buka cepat & offline shell.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Chunk renderer PDF (@react-pdf/renderer, ~1,4 MB) DIKECUALIKAN dari
        // precache agar payload instal/update tetap ringan; ia hanya dipakai saat
        // "Unduh PDF". Diambil on-demand lalu di-cache runtime (offline setelah
        // pemakaian pertama).
        globIgnores: ['**/investorReportPdf-*.js'],
        navigateFallback: 'index.html',
        // Deny sw.js & manifest dari navigateFallback.
        navigateFallbackDenylist: [/^\/sw\.js$/, /^\/manifest\.webmanifest$/],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            // Panggilan Supabase (cross-origin) tidak pernah di-cache: paksa NetworkOnly.
            urlPattern: ({ url }: { url: URL }) =>
              url.origin.endsWith('.supabase.co') || url.origin.endsWith('.supabase.in'),
            handler: 'NetworkOnly',
          },
          {
            // Chunk PDF yang dikecualikan dari precache: cache saat pertama dipakai.
            urlPattern: ({ url }: { url: URL }) => /\/assets\/investorReportPdf-.*\.js$/.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'pdf-renderer', expiration: { maxEntries: 2 } },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
