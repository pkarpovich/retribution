<script lang="ts">
  import type { Hero } from '../types/hero'
  import { bans } from '../lib/bans.svelte'
  import { getJunglers, getLatestStats } from '../utils/heroUtils'
  import HeroAvatar from './HeroAvatar.svelte'

  interface Props {
    heroes: Hero[]
    onClose: () => void
  }

  const { heroes, onClose }: Props = $props()

  let query = $state('')
  let junglePoolOnly = $state(true)

  const junglerIds = $derived(new Set(getJunglers(heroes).map(hero => hero.id)))

  // Hidden rather than removed: rebuilding the list on each keystroke threw
  // away the portraits, which are remote and had to be fetched again.
  const visible = $derived(new Set(
    heroes
      .filter(hero =>
        (!junglePoolOnly || junglerIds.has(hero.id))
        && hero.hero_name.toLowerCase().includes(query.trim().toLowerCase())
      )
      .map(hero => hero.id)
  ))

  const winRate = (hero: Hero) => getLatestStats(hero)?.win_rate.toFixed(1) ?? '—'
</script>

<section class="screen">
  <header class="bar">
    <button class="back" onclick={onClose}>
      <span aria-hidden="true">‹</span> DRAFT
    </button>
    <h2 class="title">Banned heroes</h2>
    <div class="bar-end">
      {#if bans.size > 0}
        <button class="clear" onclick={() => bans.clear()}>CLEAR</button>
      {/if}
    </div>
  </header>

  <div class="explainer">
    <p class="lede">
      Banned heroes are never suggested and stay out of the draft roster.
      Use it for heroes you don't own or don't play.
    </p>
    <p class="tally">
      <span class="tally-count" class:active={bans.size > 0}>{bans.size}</span>
      <span class="tally-label">BANNED</span>
    </p>
  </div>

  <div class="controls">
    <label class="search">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
        <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
      </svg>
      <input bind:value={query} placeholder="Search heroes" aria-label="Search heroes" />
      {#if query}
        <button class="clear-query" onclick={() => (query = '')} aria-label="Clear search">×</button>
      {/if}
      <span class="count">{visible.size}</span>
    </label>

    <div class="segmented" role="group" aria-label="Hero pool">
      <button class:on={junglePoolOnly} onclick={() => (junglePoolOnly = true)}>JUNGLE POOL</button>
      <button class:on={!junglePoolOnly} onclick={() => (junglePoolOnly = false)}>ALL HEROES</button>
    </div>
  </div>

  <div class="list">
    {#if visible.size === 0}
      <p class="empty">No heroes match</p>
    {/if}

    {#each heroes as hero (hero.id)}
      {@const banned = bans.has(hero.id)}
      <button
        class="row"
        hidden={!visible.has(hero.id)}
        onclick={() => bans.toggle(hero.id)}
        aria-pressed={banned}
      >
        <HeroAvatar {hero} size={34} dimmed={banned} struck={banned} />
        <span class="meta">
          <span class="name" class:banned>{hero.hero_name}</span>
          <span class="facts">{hero.role.join('/')} · {hero.tier}-tier · WR {winRate(hero)}%</span>
        </span>
        <span class="pill" class:banned>{banned ? 'BANNED' : 'BAN'}</span>
      </button>
    {/each}
  </div>
</section>

<style>
  .screen {
    position: absolute;
    inset: 0;
    z-index: 50;
    display: grid;
    grid-template-rows: auto auto auto minmax(0, 1fr);
    background: var(--color-bg);
    animation: sheet-in var(--duration-base) var(--ease-out);
  }

  .bar,
  .explainer {
    background: var(--color-panel);
    border-block-end: 1px solid var(--color-border);
  }

  .bar {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-md) var(--space-xl);
  }

  .back,
  .clear {
    display: flex;
    align-items: center;
    gap: var(--space-2xs);
    padding: 0;
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    font-weight: 700;
    letter-spacing: var(--tracking-mono);
  }

  .back {
    justify-self: start;
    color: var(--color-accent);
  }

  .clear {
    justify-self: end;
    color: var(--color-ink-faint);
  }

  .bar-end {
    display: flex;
    justify-content: flex-end;
  }

  .title {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: var(--font-size-lg);
    font-weight: 400;
    letter-spacing: var(--tracking-tight);
  }

  .explainer {
    display: grid;
    gap: var(--space-sm);
    padding: var(--space-md) var(--space-xl) var(--space-lg);
  }

  .lede {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-ink-mute);
  }

  .tally {
    display: flex;
    align-items: baseline;
    gap: var(--space-sm);
    margin: 0;
  }

  .tally-count {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: var(--font-size-xl);
    color: var(--color-ink-faint);
  }

  .tally-count.active {
    color: var(--color-neg);
  }

  .tally-label {
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    letter-spacing: var(--tracking-mono);
    color: var(--color-ink-faint);
  }

  .controls {
    display: grid;
    gap: var(--space-sm);
    padding: var(--space-md) var(--space-xl) 0;
  }

  .search {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    background: var(--color-panel);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-ink-faint);
  }

  .search input {
    flex: 1;
    min-inline-size: 0;
    border: none;
    outline: none;
    background: none;
    font-size: var(--font-size-md);
    color: var(--color-ink);
  }

  .clear-query {
    display: grid;
    place-items: center;
    inline-size: 1.375rem;
    block-size: 1.375rem;
    padding: 0;
    background: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    cursor: pointer;
    line-height: 1;
    color: var(--color-ink-mute);
  }

  .count {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    letter-spacing: 0.08em;
  }

  .segmented {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-xs);
  }

  .segmented button {
    padding: var(--space-xs) 0;
    background: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    font-weight: 700;
    letter-spacing: var(--tracking-mono);
    color: var(--color-ink-mute);
    transition:
      background-color var(--duration-fast) var(--ease-out),
      border-color var(--duration-fast) var(--ease-out);
  }

  .segmented button.on {
    background: var(--color-accent-soft);
    border-color: var(--color-accent);
    color: var(--color-accent);
  }

  .list {
    overflow-y: auto;
    padding: var(--space-lg) var(--space-xl) var(--space-2xl);
  }

  .empty {
    padding-block: var(--space-2xl);
    text-align: center;
    font-family: var(--font-serif);
    font-style: italic;
    font-size: var(--font-size-md);
    color: var(--color-ink-faint);
  }

  .row {
    inline-size: 100%;
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-sm) var(--space-3xs);
    background: none;
    border: none;
    text-align: start;
    cursor: pointer;
  }

  /* Author styles beat the UA rule for [hidden], and the divider has to skip
     the hidden rows or the first match keeps a rule above it. */
  .row[hidden] {
    display: none;
  }

  .row:not([hidden]) + .row:not([hidden]) {
    border-block-start: 1px solid var(--color-border);
  }

  .meta {
    flex: 1;
    min-inline-size: 0;
    display: grid;
    gap: var(--space-3xs);
  }

  .name {
    font-size: var(--font-size-md);
    font-weight: 500;
    letter-spacing: -0.01em;
  }

  .name.banned {
    color: var(--color-ink-faint);
    text-decoration: line-through;
    text-decoration-color: color-mix(in oklch, var(--color-neg) 55%, transparent);
  }

  .facts {
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    letter-spacing: 0.06em;
    color: var(--color-ink-faint);
  }

  .pill {
    flex-shrink: 0;
    inline-size: 3rem;
    padding-block: var(--space-2xs);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xs);
    text-align: center;
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--color-ink-faint);
    transition:
      background-color var(--duration-fast) var(--ease-out),
      border-color var(--duration-fast) var(--ease-out),
      color var(--duration-fast) var(--ease-out);
  }

  .pill.banned {
    background: color-mix(in oklch, var(--color-neg) 8%, transparent);
    border-color: color-mix(in oklch, var(--color-neg) 27%, transparent);
    color: var(--color-neg);
  }
</style>
