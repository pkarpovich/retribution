import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'engine',
          environment: 'node',
          include: ['src/utils/__tests__/**/*.test.ts'],
        },
      },
      {
        plugins: [svelte()],
        // Without this Svelte resolves to its server build and mount() throws.
        resolve: { conditions: ['browser'] },
        test: {
          name: 'ui',
          environment: 'jsdom',
          include: [
            'src/__tests__/**/*.test.ts',
            'src/components/__tests__/**/*.test.ts',
            'src/lib/__tests__/**/*.test.ts',
          ],
          setupFiles: ['vitest.setup.ts'],
        },
      },
    ],
  },
})
