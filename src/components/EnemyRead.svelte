<script lang="ts">
  import type { Hero } from '../types/hero'
  import type { Responders } from '../utils/presentation'
  import { enemyReadout } from '../utils/presentation'

  interface Props {
    enemies: Hero[]
    pool: Hero[]
    responders: Responders
    inline?: boolean
  }

  const { enemies, pool, responders, inline = false }: Props = $props()

  let open = $state(false)
  let tallyOpen = $state(false)

  const readout = $derived(enemyReadout(enemies, pool, responders))
  const scale = $derived(Math.max(...(readout?.levers ?? []).map(lever => lever.points ?? 0), 1))
</script>

{#if readout}
  {#if !open}
    <button class="peek" class:inline onclick={() => (open = true)}>
      {#if !inline}
        <span class="rail" aria-hidden="true"></span>
      {/if}
      <span class="copy">
        {#if !inline}
          <span class="kicker">THEIR TEAM</span>
        {/if}
        <span class="line">
          <em>{readout.statement}</em>
          {#if readout.poolGap}<strong>buy anti-heal</strong>{/if}
        </span>
      </span>
      {#if readout.poolGap}
        <span class="peek-points">{readout.poolGap.value.replace(' unclaimed', '')}</span>
      {/if}
      <span class="chevron" aria-hidden="true">›</span>
    </button>
  {:else}
    <section class="full" class:inline>
      <div class="head">
        <span class="kicker">THEIR TEAM</span>
        <button class="close" onclick={() => (open = false)} aria-label="Collapse enemy read-out">×</button>
      </div>

      <h2 class="statement">
        {readout.statement}
        <em>{readout.aside}</em>
      </h2>

      <div class="levers">
        <div class="levers-head">
          <span class="kicker">WHAT IT IS WORTH</span>
          <span class="kicker">points of fit</span>
        </div>

        {#each readout.levers as lever (lever.key)}
          <div class="lever" data-tone={lever.tone} class:gap={lever.tone === 'neg'}>
            <div class="amount">
              <span class="points">{lever.points === null ? '+?' : `+${lever.points.toFixed(lever.points < 10 ? 2 : 0)}`}</span>
              <span class="bar" aria-hidden="true">
                <span class="fill" style="inline-size: {lever.points === null ? 0 : Math.max(2, (lever.points / scale) * 100)}%"></span>
              </span>
            </div>
            <div class="detail">
              <span class="lever-head">
                <span class="lever-name">{lever.name}</span>
                {#if lever.flag}<span class="flag">{lever.flag}</span>{/if}
              </span>
              <span class="evidence">{lever.evidence}</span>
              <span class="supply">{lever.supply}</span>
            </div>
          </div>
        {/each}
      </div>

      {#if readout.poolGap}
        <p class="gap-note">
          <strong>{readout.poolGap.answer}</strong>
          {readout.poolGap.detail}
        </p>
      {/if}

      <button class="tally-toggle" onclick={() => (tallyOpen = !tallyOpen)}>
        {tallyOpen ? 'HIDE THEIR NUMBERS' : `THEIR NUMBERS · ${readout.tally.length}`}
      </button>

      {#if tallyOpen}
        <dl class="tally">
          {#each readout.tally as entry (entry.label)}
            <div class="tally-row" class:idle={!entry.drives}>
              <dt>{entry.label}</dt>
              <dd>{entry.value}</dd>
            </div>
          {/each}
          <p class="tally-note">squishy and tanks feed no rule against this draft</p>
        </dl>
      {/if}
    </section>
  {/if}
{/if}

<style>
  .peek,
  .full {
    inline-size: 100%;
    background: var(--color-panel);
    border: none;
    border-block-end: 1px solid var(--color-border);

    &.inline {
      background: none;
      border-block-end: none;
      padding-inline: 0;
    }
  }

  .kicker {
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    letter-spacing: 0.16em;
    color: var(--color-ink-faint);
  }

  .peek {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-lg);
    cursor: pointer;
    text-align: start;

    &.inline {
      padding-block: 0;
    }
  }

  .rail {
    inline-size: 3px;
    block-size: 1.375rem;
    border-radius: 2px;
    background: var(--color-neg);
    flex-shrink: 0;
  }

  .copy {
    flex: 1;
    min-inline-size: 0;
    display: grid;
    gap: var(--space-3xs);
  }

  .line {
    display: flex;
    gap: var(--space-2xs);
    font-size: var(--font-size-sm);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .line em {
    font-family: var(--font-serif);
    color: var(--color-ink-mute);
  }

  .line strong {
    font-weight: 600;
  }

  .peek-points {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-neg);
    flex-shrink: 0;
  }

  .chevron {
    font-family: var(--font-mono);
    color: var(--color-ink-faint);
    flex-shrink: 0;
  }

  .full {
    display: grid;
    gap: var(--space-sm);
    padding: var(--space-md) var(--space-lg) var(--space-lg);
    animation: fade-in var(--duration-base) var(--ease-out);
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .close {
    inline-size: 1.375rem;
    block-size: 1.375rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    background: none;
    cursor: pointer;
    color: var(--color-ink-mute);
    line-height: 1;
  }

  .statement {
    max-inline-size: var(--measure);
    font-family: var(--font-serif);
    font-size: var(--font-size-display);
    font-weight: 400;
    line-height: 1.05;
  }

  .statement em {
    color: var(--color-ink-mute);
  }

  .levers {
    display: grid;
    gap: var(--space-xs);
  }

  .levers-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-sm);
  }

  .lever {
    display: grid;
    grid-template-columns: 3.4rem minmax(0, 1fr);
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg);
    --tone: var(--color-pos);

    &[data-tone='neg'] {
      --tone: var(--color-neg);
    }

    &[data-tone='faint'] {
      --tone: var(--color-ink-faint);
    }

    &.gap {
      border-color: color-mix(in oklch, var(--color-neg) 28%, transparent);
      background: color-mix(in oklch, var(--color-neg) 5%, transparent);
    }
  }

  .amount {
    display: grid;
    justify-items: end;
    gap: var(--space-3xs);
    align-content: start;
  }

  .points {
    font-variant-numeric: tabular-nums;
    font-family: var(--font-serif);
    font-style: italic;
    font-size: var(--font-size-xl);
    line-height: 1;
    color: var(--tone);
    white-space: nowrap;
  }

  .bar {
    inline-size: 100%;
    block-size: 3px;
    border-radius: 2px;
    background: color-mix(in oklch, var(--color-ink) 10%, transparent);
    overflow: hidden;
  }

  .fill {
    display: block;
    block-size: 100%;
    background: var(--tone);
    transition: inline-size var(--duration-base) var(--ease-out);
  }

  .detail {
    display: grid;
    gap: 2px;
    min-inline-size: 0;
  }

  .lever-head {
    display: flex;
    align-items: baseline;
    gap: var(--space-xs);
    flex-wrap: wrap;
  }

  .lever-name {
    font-size: var(--font-size-md);
    font-weight: 600;
  }

  .flag {
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--tone);
  }

  .evidence {
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    color: var(--color-ink-mute);
  }

  .supply {
    max-inline-size: var(--measure);
    font-size: var(--font-size-sm);
    color: var(--color-ink-mute);
    text-wrap: pretty;
  }

  .gap-note {
    max-inline-size: var(--measure);
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-ink-mute);
    text-wrap: pretty;
  }

  .gap-note strong {
    color: var(--color-ink);
    font-weight: 600;
  }

  .tally-toggle {
    justify-self: start;
    padding: var(--space-3xs) var(--space-sm);
    background: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xs);
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    letter-spacing: 0.08em;
    color: var(--color-ink-mute);
  }

  .tally {
    margin: 0;
    display: grid;
  }

  .tally-row {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding-block: var(--space-3xs);
    border-block-end: 1px solid var(--color-border);
  }

  .tally-row.idle {
    color: var(--color-ink-mute);
  }

  .tally dt {
    flex: 1;
    font-size: var(--font-size-sm);
  }

  .tally dd {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    font-weight: 600;
  }

  .tally-note {
    margin: 0;
    padding-block-start: var(--space-xs);
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    color: var(--color-ink-mute);
  }
</style>
