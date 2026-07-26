<script lang="ts">
  import heroData from './data/heroes.json'
  import type { Hero } from './types/hero'
  import { bans } from './lib/bans.svelte'
  import BansScreen from './components/BansScreen.svelte'

  const heroes = heroData.heroes as unknown as Hero[]

  let bansOpen = $state(false)
</script>

<div class="app">
  <header class="bar">
    <h1 class="logo">Retribution</h1>
    <button
      class="bans"
      onclick={() => (bansOpen = true)}
      aria-label="Banned heroes{bans.size > 0 ? `, ${bans.size} banned` : ''}"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" /><path d="m6 6 12 12" />
      </svg>
      {#if bans.size > 0}
        <span class="badge">{bans.size}</span>
      {/if}
    </button>
  </header>

  <main class="body">
    <p class="placeholder">Draft screens land next.</p>
  </main>

  {#if bansOpen}
    <BansScreen {heroes} onClose={() => (bansOpen = false)} />
  {/if}
</div>

<style>
  .app {
    position: relative;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    block-size: 100dvb;
    inline-size: min(100%, var(--app-inline-size));
    margin-inline: auto;
    overflow: hidden;
    background: var(--color-bg);

    @media (width > 30rem) {
      border-inline: 1px solid var(--color-border);
    }
  }

  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-md) var(--space-xl);
    background: var(--color-panel);
    border-block-end: 1px solid var(--color-border);
  }

  .logo {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: var(--font-size-xl);
    font-weight: 400;
    letter-spacing: var(--tracking-tight);
  }

  .bans {
    display: flex;
    align-items: center;
    gap: var(--space-2xs);
    padding: 0;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-ink-mute);
  }

  .bans:has(.badge) {
    color: var(--color-neg);
  }

  .badge {
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    font-weight: 700;
  }

  .body {
    display: grid;
    place-items: center;
    padding: var(--space-2xl);
  }

  .placeholder {
    margin: 0;
    font-family: var(--font-serif);
    font-style: italic;
    font-size: var(--font-size-md);
    color: var(--color-ink-faint);
  }
</style>
