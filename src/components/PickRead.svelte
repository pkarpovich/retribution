<script lang="ts">
  import type { Hero } from '../types/hero'
  import type { PickReadout } from '../utils/presentation'
  import HeroAvatar from './HeroAvatar.svelte'
  import TierBadge from './TierBadge.svelte'

  interface Props {
    pick: Hero
    readout: PickReadout | null
    onUnlock: () => void
  }

  const { pick, readout, onUnlock }: Props = $props()

  const signed = (value: number) => {
    const rounded = Math.round(value)
    return `${rounded < 0 ? '-' : '+'}${Math.abs(rounded)}`
  }

  function tone(value: number) {
    const rounded = Math.round(value)
    if (rounded > 0) return 'pos'
    if (rounded < 0) return 'neg'
    return 'flat'
  }

  const moved = $derived(
    readout !== null
      && readout.sinceLock !== null
      && Math.round(readout.sinceLock) !== Math.round(readout.index)
  )

  const note = $derived(
    moved && readout?.sinceLock != null
      ? `${signed(readout.sinceLock)} since lock`
      : 'vs their board'
  )

  const quiet = $derived(
    readout !== null && readout.taken.length === 0 && readout.beaten.length === 0
  )
</script>

{#snippet chip(hero: Hero, severity: string | null, dim: boolean)}
  <span class="chip" class:dim>
    <HeroAvatar {hero} size={16} />
    <span class="chip-name">{hero.hero_name}</span>
    {#if severity}
      <span class="flag" data-severity={severity}>{severity}</span>
    {/if}
  </span>
{/snippet}

<section class="live">
  <div class="identity">
    <HeroAvatar hero={pick} size={38} selected />
    <div class="who">
      <span class="kicker accent">YOUR JUNGLE PICK</span>
      <span class="name-line">
        <span class="serif">{pick.hero_name}</span>
        <TierBadge tier={pick.tier} />
      </span>
    </div>
    {#if readout}
      <div class="figure">
        <span class="index" data-tone={tone(readout.index)}>{signed(readout.index)}</span>
        <span class="note">{note}</span>
      </div>
    {/if}
    <button class="change" onclick={onUnlock}>CHANGE</button>
  </div>

  {#if readout}
    <span class="rule" aria-hidden="true"></span>

    {#if readout.taken.length > 0}
      <div class="line" data-kind="taken">
        {#each readout.taken as threat (threat.hero.id)}
          {@render chip(threat.hero, threat.severity, false)}
        {/each}
        <span class="said">took your edge</span>
      </div>
    {/if}

    {#if readout.beaten.length > 0}
      <div class="line" data-kind="beaten">
        {#each readout.beaten as hero (hero.id)}
          {@render chip(hero, null, false)}
        {/each}
        <span class="said">you beat</span>
      </div>
    {/if}

    {#if quiet}
      <p class="flat">Nothing on their board cuts either way.</p>
    {/if}

    {#if readout.live.length > 0}
      <div class="line" data-kind="live">
        {#each readout.live as hero (hero.id)}
          {@render chip(hero, null, true)}
        {/each}
        <span class="count">
          {readout.openSlots} enemy slot{readout.openSlots === 1 ? '' : 's'} open
        </span>
      </div>
    {/if}
  {/if}
</section>

<style>
  .live {
    display: grid;
    gap: var(--space-sm);
    padding: var(--space-md);
    border: 1px solid var(--color-accent);
    border-radius: var(--radius-lg);
    background: var(--color-accent-soft);
  }

  .identity {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .who {
    flex: 1;
    min-inline-size: 0;
    display: grid;
    gap: var(--space-3xs);
  }

  .kicker {
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    letter-spacing: 0.16em;
    color: var(--color-ink-faint);
  }

  .kicker.accent {
    color: var(--color-accent);
    font-weight: 700;
  }

  .name-line {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
  }

  .serif {
    font-family: var(--font-serif);
    font-size: var(--font-size-lg);
    letter-spacing: var(--tracking-tight);
  }

  .figure {
    display: grid;
    justify-items: end;
    gap: var(--space-3xs);
    flex-shrink: 0;
  }

  .index {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: var(--font-size-xl);
    line-height: 1;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    color: var(--color-ink-faint);

    &[data-tone='pos'] {
      color: var(--color-pos);
    }

    &[data-tone='neg'] {
      color: var(--color-neg);
    }
  }

  .note {
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    color: var(--color-ink-faint);
  }

  .change {
    flex-shrink: 0;
    padding: var(--space-xs) var(--space-sm);
    background: var(--color-panel);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    font-weight: 700;
    letter-spacing: var(--tracking-mono);
  }

  .rule {
    block-size: 1px;
    background: var(--color-border-strong);
  }

  .line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2xs);
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2xs);
    padding: var(--space-3xs) var(--space-2xs);
    background: var(--color-panel);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-xs);
    white-space: nowrap;

    &.dim {
      background: none;
      border-style: dashed;
      border-color: var(--color-border);
    }
  }

  .chip-name {
    font-size: var(--font-size-sm);
    font-weight: 500;
  }

  .chip.dim .chip-name {
    color: var(--color-ink-mute);
  }

  .flag {
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--color-ink-faint);

    &[data-severity='HIGH'] {
      color: var(--color-neg);
    }

    &[data-severity='MEDIUM'] {
      color: color-mix(in oklch, var(--color-neg) 70%, var(--color-ink-faint));
    }
  }

  .said {
    font-size: var(--font-size-sm);
    color: var(--color-ink-mute);
  }

  .count {
    margin-inline-start: auto;
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    white-space: nowrap;
    color: var(--color-ink-faint);
  }

  .flat {
    max-inline-size: var(--measure);
    margin: 0;
    font-family: var(--font-serif);
    font-style: italic;
    font-size: var(--font-size-md);
    color: var(--color-ink-mute);
    text-wrap: pretty;
  }
</style>
