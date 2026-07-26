<script lang="ts">
  import heroData from './data/heroes.json'
  import type { Hero } from './types/hero'
  import { getJunglers } from './utils/heroUtils'

  const allHeroes = heroData.heroes as unknown as Hero[]
  const junglers = getJunglers(allHeroes)
</script>

<main class="shell">
  <h1 class="logo">Retribution</h1>
  <p class="status">
    <span class="count">{allHeroes.length}</span> heroes ·
    <span class="count">{junglers.length}</span> junglers
  </p>
</main>

<style>
  .shell {
    display: grid;
    gap: var(--space-sm);
    padding: var(--space-2xl);
    background: var(--color-panel);
    border-block-end: 1px solid var(--color-border);
  }

  .logo {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: var(--font-size-xl);
    letter-spacing: var(--tracking-tight);
  }

  .status {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-ink-mute);
  }

  .count {
    font-family: var(--font-mono);
    color: var(--color-accent);
  }
</style>
