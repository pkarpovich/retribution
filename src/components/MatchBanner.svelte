<script lang="ts">
  import type { MatchRecord } from '../types/match'
  import { matches } from '../lib/matches.svelte'
  import { rankLabel } from '../utils/matchStats'

  interface Props {
    record: MatchRecord
    onOpenStats: () => void
  }

  const { record, onOpenStats }: Props = $props()

  const when = $derived(new Date(record.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
</script>

<div class="banner">
  <span class="copy">
    <span class="kicker">HOW DID IT GO</span>
    <span class="what">
      <strong>{record.pick.name}</strong>
      <span class="when">{rankLabel(record)} · {when}</span>
    </span>
  </span>

  <div class="calls">
    <button class="call won" onclick={() => matches.settle(record.id, 'won')}>WON</button>
    <button class="call lost" onclick={() => matches.settle(record.id, 'lost')}>LOST</button>
    <button
      class="drop"
      onclick={() => matches.remove(record.id)}
      aria-label="Discard this game without a result"
    >×</button>
  </div>

  <button class="more" onclick={onOpenStats}>LOG ›</button>
</div>

<style>
  .banner {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-lg);
    background: var(--color-accent-soft);
    border-block-end: 1px solid var(--color-border);
    animation: fade-in var(--duration-base) var(--ease-out);
  }

  .kicker {
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    letter-spacing: 0.16em;
    color: var(--color-accent);
  }

  .copy {
    flex: 1;
    min-inline-size: 0;
    display: grid;
    gap: var(--space-3xs);
  }

  .what {
    display: flex;
    align-items: baseline;
    gap: var(--space-xs);
    min-inline-size: 0;
  }

  .what strong {
    font-size: var(--font-size-md);
    font-weight: 600;
  }

  .when {
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    color: var(--color-ink-mute);
    white-space: nowrap;
  }

  .calls {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
  }

  .call {
    padding: var(--space-2xs) var(--space-md);
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border-strong);
    background: var(--color-panel);
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    font-weight: 700;
    letter-spacing: var(--tracking-mono);
    transition:
      background-color var(--duration-fast) var(--ease-out),
      border-color var(--duration-fast) var(--ease-out),
      color var(--duration-fast) var(--ease-out);
  }

  .call.won:hover {
    border-color: var(--color-pos);
    color: var(--color-pos);
  }

  .call.lost:hover {
    border-color: var(--color-neg);
    color: var(--color-neg);
  }

  .drop {
    inline-size: 1.375rem;
    block-size: 1.375rem;
    display: grid;
    place-items: center;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    line-height: 1;
    color: var(--color-ink-faint);
  }

  .more {
    padding: 0;
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    letter-spacing: 0.08em;
    color: var(--color-accent);
  }
</style>
