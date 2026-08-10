import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { fileURLToPath } from 'node:url'

// src/data/heroes.json is rewritten twice a week by the update workflow. Any
// test that reaches it - directly, or through a component that imports it - is
// a test whose result changes when nobody has touched the code. That is how a
// meta shift came to fail the build: recall against the frozen pro corpus fell
// from 52% to 33% because the ladder moved, and three green tests turned red
// with no commit behind them.
//
// So the whole test run reads frozen snapshots instead. The alias covers
// components too, which explicit imports in test files could not: StatsScreen
// and App import the live file themselves.
//
// Snapshots live in src/__fixtures__ and are refreshed by hand. See the README
// there before touching one.
const frozen = (name: string) => fileURLToPath(new URL(`./src/__fixtures__/${name}`, import.meta.url))

// Matched as a regex rather than a path: Vite tests a string `find` against the
// raw import specifier, and every caller writes a relative one such as
// '../../data/heroes.json', so an absolute path never matches.
const alias = [
  { find: /^(?:.*\/)?data\/heroes\.json$/, replacement: frozen('heroes.snapshot.json') },
  { find: /^(?:.*\/)?data\/pro-drafts\.json$/, replacement: frozen('pro-drafts.snapshot.json') },
  {
    find: /^(?:.*\/)?data\/liquipedia-heroes\.json$/,
    replacement: frozen('liquipedia-heroes.snapshot.json'),
  },
]

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'engine',
          environment: 'node',
          include: ['src/utils/__tests__/**/*.test.ts'],
        },
      },
      {
        plugins: [svelte()],
        // Without this Svelte resolves to its server build and mount() throws.
        resolve: { alias, conditions: ['browser'] },
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
