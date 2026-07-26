<script lang="ts">
  import type { Hero, HeroRole } from '../types/hero'
  import HeroAvatar from './HeroAvatar.svelte'

  type Mode = 'ally' | 'enemy' | 'ban'

  const TABS: { id: Mode; label: string }[] = [
    { id: 'ally', label: 'Add ally' },
    { id: 'enemy', label: 'Add enemy' },
    { id: 'ban', label: 'Ban' },
  ]

  interface Props {
    heroes: Hero[]
    mode: Mode
    hiddenByBans: number
    onModeChange: (mode: Mode) => void
    onPick: (hero: Hero) => void
    onOpenBans: () => void
  }

  const { heroes, mode, hiddenByBans, onModeChange, onPick, onOpenBans }: Props = $props()

  const ROLES: HeroRole[] = ['Tank', 'Fighter', 'Assassin', 'Mage', 'Marksman', 'Support']

  let query = $state('')
  let role = $state<HeroRole | null>(null)

  // Filtering by rebuilding the list would destroy and recreate every cell on
  // each keystroke, and the portraits are remote, so iPad refetched them all.
  // The roster is drawn once and non-matching cells are hidden instead.
  const visible = $derived(new Set(
    heroes
      .filter(hero =>
        (!role || hero.role.includes(role))
        && hero.hero_name.toLowerCase().includes(query.trim().toLowerCase())
      )
      .map(hero => hero.id)
  ))
</script>

<div class="panel">
  <div class="tabs" role="tablist" aria-label="Draft side">
    {#each TABS as tab (tab.id)}
      <button
        class="tab"
        class:on={mode === tab.id}
        data-side={tab.id}
        role="tab"
        aria-selected={mode === tab.id}
        onclick={() => onModeChange(tab.id)}
      >{tab.label}</button>
    {/each}
  </div>

  <label class="search">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
    </svg>
    <input bind:value={query} placeholder="Search heroes" aria-label="Search heroes" />
    {#if query}
      <button class="clear" onclick={() => (query = '')} aria-label="Clear search">×</button>
    {/if}
    <span class="count">{visible.size}</span>
  </label>

  <div class="filters">
    <button class="chip" class:on={role === null} onclick={() => (role = null)}>ALL</button>
    {#each ROLES as candidate (candidate)}
      <button
        class="chip"
        class:on={role === candidate}
        data-role={candidate}
        onclick={() => (role = role === candidate ? null : candidate)}
      >
        <span class="dot" aria-hidden="true"></span>{candidate.slice(0, 4).toUpperCase()}
      </button>
    {/each}
  </div>

  <div class="grid-wrap">
    {#if visible.size === 0}
      <p class="empty">No heroes match</p>
    {/if}

    <div class="grid">
      {#each heroes as hero (hero.id)}
        <button class="cell" hidden={!visible.has(hero.id)} onclick={() => onPick(hero)}>
          <HeroAvatar {hero} size={44} />
          <span class="cell-name">{hero.hero_name}</span>
        </button>
      {/each}
    </div>

    {#if hiddenByBans > 0}
      <button class="hidden-note" onclick={onOpenBans}>
        {hiddenByBans} hero{hiddenByBans === 1 ? '' : 'es'} hidden by bans
      </button>
    {/if}
  </div>
</div>

<style>
  .panel {
    display: grid;
    grid-template-rows: auto auto auto minmax(0, 1fr);
    gap: var(--space-sm);
    padding: var(--space-md) var(--space-xl) 0;
    min-block-size: 0;
  }

  .tabs {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    border-block-end: 1px solid var(--color-border);
  }

  .tab {
    padding-block: var(--space-sm);
    background: none;
    border: none;
    border-block-end: 2px solid transparent;
    margin-block-end: -1px;
    cursor: pointer;
    font-size: var(--font-size-md);
    color: var(--color-ink-faint);
    transition:
      border-color var(--duration-fast) var(--ease-out),
      color var(--duration-fast) var(--ease-out);

    &.on {
      color: var(--color-ink);
      font-weight: 600;
    }

    &.on[data-side='ally'] {
      border-color: var(--color-pos);
    }

    &.on[data-side='enemy'] {
      border-color: var(--color-neg);
    }

    &.on[data-side='ban'] {
      border-color: var(--color-ink-mute);
    }
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

  .clear {
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
  }

  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2xs);
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2xs);
    padding: 2px var(--space-sm);
    background: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xs);
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    font-weight: 600;
    letter-spacing: 0.1em;
    color: var(--color-ink-mute);
    --role-hue: 265;
    transition:
      background-color var(--duration-fast) var(--ease-out),
      border-color var(--duration-fast) var(--ease-out);

    &.on {
      color: var(--color-ink);
      border-color: oklch(60% 0.16 var(--role-hue));
      background: oklch(60% 0.16 var(--role-hue) / 0.12);
    }

    &[data-role='Tank'] { --role-hue: 230; }
    &[data-role='Fighter'] { --role-hue: 35; }
    &[data-role='Assassin'] { --role-hue: 15; }
    &[data-role='Mage'] { --role-hue: 300; }
    &[data-role='Marksman'] { --role-hue: 90; }
    &[data-role='Support'] { --role-hue: 160; }
  }

  .dot {
    inline-size: 5px;
    block-size: 5px;
    border-radius: var(--radius-full);
    background: oklch(60% 0.16 var(--role-hue));
  }

  .grid-wrap {
    overflow-y: auto;
    padding-block-end: var(--space-2xl);
    min-block-size: 0;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(3rem, 1fr));
    gap: var(--space-sm);
  }

  .cell {
    display: grid;
    justify-items: center;
    gap: var(--space-3xs);
    padding: 0;
    background: none;
    border: none;
    cursor: pointer;
    min-inline-size: 0;
  }

  /* Author styles beat the UA rule for [hidden], so it has to be said here. */
  .cell[hidden] {
    display: none;
  }

  .cell-name {
    max-inline-size: 100%;
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    letter-spacing: 0.02em;
    color: var(--color-ink-mute);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .empty {
    max-inline-size: var(--measure);
    margin-inline: auto;
    padding-block: var(--space-2xl);
    text-align: center;
    font-family: var(--font-serif);
    font-style: italic;
    color: var(--color-ink-faint);
  }

  .hidden-note {
    max-inline-size: var(--measure);
    inline-size: 100%;
    margin-block-start: var(--space-lg);
    padding-block: var(--space-xs);
    background: none;
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: var(--font-serif);
    font-style: italic;
    font-size: var(--font-size-sm);
    color: var(--color-ink-mute);
  }
</style>
