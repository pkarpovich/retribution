<script lang="ts">
  import type { Hero } from '../types/hero'
  import HeroAvatar from './HeroAvatar.svelte'

  interface Props {
    bans: Hero[]
    onRemove: (hero: Hero) => void
  }

  const { bans, onRemove }: Props = $props()
</script>

{#if bans.length > 0}
  <div class="ban-strip">
    <span class="kicker">BANNED THIS MATCH</span>
    <div class="picks">
      {#each bans as hero (hero.id)}
        <button class="slot" onclick={() => onRemove(hero)} aria-label="Unban {hero.hero_name}">
          <HeroAvatar {hero} size="var(--slot)" dimmed struck />
        </button>
      {/each}
    </div>
    <span class="tally">{bans.length}</span>
  </div>
{/if}

<style>
  .ban-strip {
    --slot: clamp(1.125rem, 5.6cqi, 1.375rem);
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    min-inline-size: 0;
    padding: var(--space-xs) var(--space-lg);
    background: var(--color-panel);
    border-block-end: 1px solid var(--color-border);
  }

  .kicker {
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    letter-spacing: 0.16em;
    color: var(--color-ink-faint);
    white-space: nowrap;
  }

  .picks {
    display: flex;
    flex: 1;
    min-inline-size: 0;
    gap: var(--space-3xs);
    overflow-x: auto;
  }

  .slot {
    inline-size: var(--slot);
    block-size: var(--slot);
    flex-shrink: 0;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
  }

  .tally {
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    font-weight: 700;
    color: var(--color-neg);
  }
</style>
