import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

const base = process.env.GITHUB_ACTIONS ? '/wealth-pages/' : '/';

export default defineConfig({
  base,
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icon.svg', 'icon-512.png'],
      manifest: {
        name: 'Worth — личный портфель',
        short_name: 'Worth',
        description: 'Локальный трекер личных активов и счетов',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#f4f5f7',
        theme_color: '#f4f5f7',
        lang: 'ru',
        icons: [
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
  },
});
