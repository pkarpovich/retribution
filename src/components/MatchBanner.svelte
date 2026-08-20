<script lang="ts">
  import type { Hero } from '../types/hero'
  import type { MatchRecord } from '../types/match'
  import { matches } from '../lib/matches.svelte'
  import { rankLabel } from '../utils/matchStats'
  import HeroAvatar from './HeroAvatar.svelte'

  interface Props {
    record: MatchRecord
    hero: Hero | null
  }

  const { record, hero }: Props = $props()

  const when = $derived(new Date(record.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
  const rank = $derived(rankLabel(record))
</script>

<div class="unlogged">
  <div class="who">
    {#if hero}
      <HeroAvatar {hero} size={34} />
    {/if}
    <span class="copy">
      <span class="kicker">LAST GAME · UNLOGGED</span>
      <span class="what">
        <span class="serif">{record.pick.name}</span>
        <span class="when">{rank} · {when}</span>
      </span>
    </span>
  </div>

  <div class="calls">
    <button class="call won" onclick={() => matches.settle(record.id, 'won')}>WON</button>
    <button class="call lost" onclick={() => matches.settle(record.id, 'lost')}>LOST</button>
    <button
      class="call skip"
      onclick={() => matches.remove(record.id)}
      aria-label="Discard this game without a result"
    >SKIP</button>
  </div>
</div>

<style>
  .unlogged {
    display: grid;
    gap: var(--space-sm);
    padding: var(--space-md);
    text-align: start;
    background: var(--color-accent-soft);
    border: 1px solid var(--color-accent);
    border-radius: var(--radius-lg);
    animation: fade-in var(--duration-base) var(--ease-out);
  }

  .who {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .copy {
    flex: 1;
    min-inline-size: 0;
    display: grid;
    gap: var(--space-3xs);
  }

  .kicker {
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    letter-spacing: 0.16em;
    font-weight: 700;
    color: var(--color-accent);
  }

  .what {
    display: flex;
    align-items: baseline;
    gap: var(--space-xs);
    min-inline-size: 0;
  }

  .serif {
    font-family: var(--font-serif);
    font-size: var(--font-size-lg);
    letter-spacing: var(--tracking-tight);
  }

  .when {
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    color: var(--color-ink-mute);
    white-space: nowrap;
  }

  .calls {
    display: flex;
    gap: var(--space-xs);
  }

  .call {
    padding-block: var(--space-sm);
    background: var(--color-panel);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    font-weight: 700;
    letter-spacing: var(--tracking-mono);
    transition:
      border-color var(--duration-fast) var(--ease-out),
      color var(--duration-fast) var(--ease-out);
  }

  .call.won,
  .call.lost {
    flex: 1;
  }

  .call.won {
    border-color: color-mix(in oklch, var(--color-pos) 40%, transparent);
    color: var(--color-pos);
  }

  .call.lost {
    border-color: color-mix(in oklch, var(--color-neg) 40%, transparent);
    color: var(--color-neg);
  }

  .call.skip {
    padding-inline: var(--space-md);
    background: none;
    border-color: var(--color-border);
    color: var(--color-ink-faint);
  }
</style>
