import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'apple-touch-icon.png',
        'apple-touch-icon-120x120.png',
        'apple-touch-icon-152x152.png',
        'apple-touch-icon-167x167.png',
      ],
      manifest: {
        name: 'Retribution',
        short_name: 'Retribution',
        description: 'MLBB jungler recommendation app',
        theme_color: '#faf8f4',
        background_color: '#faf8f4',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'favicon-16x16.png', sizes: '16x16', type: 'image/png' },
          { src: 'favicon-32x32.png', sizes: '32x32', type: 'image/png' },
          { src: 'apple-touch-icon-120x120.png', sizes: '120x120', type: 'image/png' },
          { src: 'apple-touch-icon-152x152.png', sizes: '152x152', type: 'image/png' },
          { src: 'apple-touch-icon-167x167.png', sizes: '167x167', type: 'image/png' },
          { src: 'apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
          { src: 'android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff2}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        // Hero portraits live on the game's CDN, so nothing in the precache
        // covers them and every fresh <img> was a round trip.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/akmweb\.youngjoygame\.com\/.*\.png$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'hero-portraits',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ],
})
