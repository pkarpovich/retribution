<script lang="ts">
  import type { Hero } from '../types/hero'
  import type { PickReadout } from '../utils/presentation'
  import HeroAvatar from './HeroAvatar.svelte'

  interface Props {
    readout: PickReadout
  }

  const { readout }: Props = $props()

  const signed = (value: number) => `${value < 0 ? '-' : '+'}${Math.abs(Math.round(value))}`

  function tone(value: number) {
    if (value > 0) return 'pos'
    if (value < 0) return 'neg'
    return 'flat'
  }

  const quiet = $derived(readout.taken.length === 0 && readout.beaten.length === 0)
</script>

{#snippet heroList(list: Hero[])}
  <div class="rows">
    {#each list as hero (hero.id)}
      <span class="row">
        <HeroAvatar {hero} size={20} />
        <span class="row-name">{hero.hero_name}</span>
      </span>
    {/each}
  </div>
{/snippet}

<section class="read">
  <div class="head">
    <div class="head-copy">
      <span class="kicker">AGAINST THIS BOARD</span>
      <span class="scope">Reads their side only - an ally never moves this number.</span>
    </div>
    <div class="figure">
      <span class="index" data-tone={tone(readout.index)}>{signed(readout.index)}</span>
      {#if readout.sinceLock !== null}
        <span class="delta">{signed(readout.sinceLock)} since lock</span>
      {/if}
    </div>
  </div>

  {#if readout.taken.length > 0}
    <div class="group taken">
      <div class="group-head">
        <span class="kicker">TAKEN AGAINST YOU</span>
      </div>
      <div class="rows">
        {#each readout.taken as threat (threat.hero.id)}
          <span class="row">
            <HeroAvatar hero={threat.hero} size={20} />
            <span class="row-name">{threat.hero.hero_name}</span>
            <span class="severity" data-severity={threat.severity}>{threat.severity}</span>
          </span>
        {/each}
      </div>
    </div>
  {/if}

  {#if readout.beaten.length > 0}
    <div class="group beaten">
      <div class="group-head">
        <span class="kicker">YOU BEAT</span>
      </div>
      {@render heroList(readout.beaten)}
    </div>
  {/if}

  {#if quiet}
    <p class="flat">Nothing on their board cuts either way.</p>
  {/if}

  {#if readout.worksWith.length > 0}
    <div class="group works">
      <div class="group-head">
        <span class="kicker">WORKS WITH YOU</span>
        <span class="kicker">not counted above</span>
      </div>
      {@render heroList(readout.worksWith)}
    </div>
  {/if}

  {#if readout.live.length > 0}
    <div class="group live">
      <div class="group-head">
        <span class="kicker">THEY CAN STILL TAKE</span>
        <span class="kicker">{readout.openSlots} slot{readout.openSlots === 1 ? '' : 's'} open</span>
      </div>
      {@render heroList(readout.live)}
    </div>
  {/if}
</section>

<style>
  .read {
    display: grid;
    gap: var(--space-sm);
    padding: var(--space-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
  }

  .kicker {
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    letter-spacing: 0.16em;
    color: var(--color-ink-faint);
  }

  .head {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    gap: var(--space-sm);
  }

  .head-copy {
    min-inline-size: 0;
    display: grid;
    gap: var(--space-3xs);
  }

  .scope {
    max-inline-size: var(--measure);
    font-size: var(--font-size-sm);
    color: var(--color-ink-mute);
    text-wrap: pretty;
  }

  .figure {
    display: grid;
    justify-items: end;
    gap: var(--space-3xs);
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

  .delta {
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    color: var(--color-ink-mute);
  }

  .group {
    display: grid;
    gap: var(--space-2xs);
    padding-inline-start: var(--space-sm);
    border-inline-start: 2px solid transparent;

    &.taken {
      border-inline-start-color: var(--color-neg);
    }

    &.beaten {
      border-inline-start-color: var(--color-pos);
    }

    &.works {
      border-inline-start-color: color-mix(in oklch, var(--color-pos) 45%, transparent);
    }

    &.live {
      border-inline-start-color: var(--color-border-strong);
    }
  }

  .group-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-sm);
  }

  .rows {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2xs);
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-2xs);
    padding: var(--space-3xs) var(--space-2xs);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xs);
    background: var(--color-bg);
  }

  .row-name {
    font-size: var(--font-size-sm);
    white-space: nowrap;
  }

  .live .row-name {
    color: var(--color-ink-mute);
  }

  .severity {
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
