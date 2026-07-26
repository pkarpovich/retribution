<script lang="ts">
  import type { Hero } from '../types/hero'
  import type { PoolStance } from '../lib/pool.svelte'
  import { bans, setStance, signatures, stanceOf } from '../lib/pool.svelte'
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

  // Tapping the state a hero is already in clears it, so neutral needs no
  // button of its own.
  const choose = (hero: Hero, stance: PoolStance) => () =>
    setStance(hero.id, stanceOf(hero.id) === stance ? 'neutral' : stance)
</script>

<section class="screen">
  <header class="bar">
    <button class="back" onclick={onClose}>
      <span aria-hidden="true">‹</span> DRAFT
    </button>
    <h2 class="title">Your pool</h2>
    <div class="bar-end">
      {#if bans.size + signatures.size > 0}
        <button
          class="clear"
          onclick={() => { bans.clear(); signatures.clear() }}
        >CLEAR</button>
      {/if}
    </div>
  </header>

  <div class="explainer">
    <p class="lede">
      A <strong>main</strong> is a hero you play well: it is scored a little higher,
      enough to move it a few places but never to the front on its own.
      A <strong>ban</strong> is never suggested and stays out of the draft roster.
      A hero can be one or the other, not both.
    </p>
    <p class="tally">
      <span class="tally-count main" class:active={signatures.size > 0}>{signatures.size}</span>
      <span class="tally-label">MAINS</span>
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
      {@const stance = stanceOf(hero.id)}
      {@const banned = stance === 'banned'}
      <div class="row" hidden={!visible.has(hero.id)} data-stance={stance}>
        <HeroAvatar {hero} size={34} dimmed={banned} struck={banned} />
        <span class="meta">
          <span class="name" class:banned>{hero.hero_name}</span>
          <span class="facts">{hero.role.join('/')} · {hero.tier}-tier · WR {winRate(hero)}%</span>
        </span>
        <span class="stances">
          <button
            class="pill main"
            class:on={stance === 'signature'}
            aria-pressed={stance === 'signature'}
            aria-label="{hero.hero_name} is a hero you main"
            onclick={choose(hero, 'signature')}
          >MAIN</button>
          <button
            class="pill ban"
            class:on={banned}
            aria-pressed={banned}
            aria-label="Never suggest {hero.hero_name}"
            onclick={choose(hero, 'banned')}
          >BAN</button>
        </span>
      </div>
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

  .tally-count.main.active {
    color: var(--color-accent);
  }

  .tally-count.main {
    margin-inline-end: 0;
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
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-sm) var(--space-3xs);
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

  .stances {
    display: flex;
    flex-shrink: 0;
    gap: var(--space-2xs);
  }

  .pill {
    inline-size: 2.75rem;
    padding-block: var(--space-2xs);
    background: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xs);
    cursor: pointer;
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

  .pill.ban.on {
    background: color-mix(in oklch, var(--color-neg) 8%, transparent);
    border-color: color-mix(in oklch, var(--color-neg) 27%, transparent);
    color: var(--color-neg);
  }

  .pill.main.on {
    background: color-mix(in oklch, var(--color-accent) 9%, transparent);
    border-color: color-mix(in oklch, var(--color-accent) 32%, transparent);
    color: var(--color-accent);
  }
</style>
