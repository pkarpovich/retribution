<script lang="ts">
  import type { Hero } from '../types/hero'
  import { axisContributors, axisDeltas } from '../utils/presentation'
  import HeroAvatar from './HeroAvatar.svelte'

  interface Props {
    allies: Hero[]
    enemies: Hero[]
  }

  const { allies, enemies }: Props = $props()

  let open = $state(false)

  const deltas = $derived(axisDeltas(allies, enemies))
  const top = $derived(deltas[0])
  const even = $derived(Math.abs(top.delta) < 0.3)
  const leading = $derived(top.delta > 0)
  const tone = $derived(even ? 'even' : leading ? 'pos' : 'neg')

  const mine = $derived(axisContributors(allies, top.key))
  const theirs = $derived(axisContributors(enemies, top.key))

  const rest = $derived(deltas.slice(1))
  const yourLeads = $derived(rest.filter(axis => axis.delta > 0.3))
  const theirLeads = $derived(rest.filter(axis => axis.delta < -0.3))
  const levels = $derived(rest.filter(axis => Math.abs(axis.delta) <= 0.3))

  const signed = (value: number) => `${value > 0 ? '+' : '−'}${Math.abs(value).toFixed(1)}`
</script>

{#if !open}
  <button class="peek" data-tone={tone} onclick={() => (open = true)}>
    <span class="rail" aria-hidden="true"></span>
    <span class="copy">
      <span class="kicker">MATCH-UP</span>
      <span class="line">
        <em>{even ? 'even across the board' : leading ? 'you lead' : 'enemy leads'}</em>
        {#if !even}<strong>{top.full}</strong>{/if}
      </span>
    </span>
    <span class="gap">{signed(top.delta)}</span>
    <span class="chevron" aria-hidden="true">›</span>
  </button>
{:else}
  <section class="full" data-tone={tone}>
    <div class="head">
      <span class="kicker">MATCH-UP · BIGGEST GAP</span>
      <button class="close" onclick={() => (open = false)} aria-label="Collapse match-up">×</button>
    </div>

    <div class="headline">
      <h2 class="title">
        <em>{leading ? 'You lead' : 'Enemy leads'}</em>
        <span class="axis">{top.full}</span>
      </h2>
      <p class="score">
        <span class="value">{signed(top.delta)}</span>
        <span class="kicker">GAP</span>
      </p>
    </div>

    {#if mine.length > 0 || theirs.length > 0}
      <div class="contributors">
        {#each [{ label: 'YOURS', tone: 'pos', list: mine }, { label: 'THEIRS', tone: 'neg', list: theirs }] as column (column.label)}
          <div class="column" data-tone={column.tone}>
            <span class="kicker column-label">{column.label}</span>
            {#if column.list.length === 0}
              <span class="nobody">nobody</span>
            {:else}
              {#each column.list as entry (entry.hero.id)}
                <span class="contributor">
                  <HeroAvatar hero={entry.hero} size={17} />
                  <span class="name">{entry.hero.hero_name}</span>
                  <span class="amount">{entry.value.toFixed(1)}</span>
                </span>
              {/each}
            {/if}
          </div>
        {/each}
      </div>
    {/if}

    <div class="others">
      <span class="kicker">OTHER AXES</span>
      {#each [{ label: 'YOU', tone: 'pos', items: yourLeads }, { label: 'ENEMY', tone: 'neg', items: theirLeads }, { label: 'EVEN', tone: 'even', items: levels }] as row (row.label)}
        {#if row.items.length > 0}
          <div class="row" data-tone={row.tone}>
            <span class="kicker row-label">{row.label}</span>
            <span class="chips">
              {#each row.items as axis (axis.key)}
                <span class="chip">{axis.short}<span class="chip-value">{row.tone === 'even' ? '=' : signed(axis.delta)}</span></span>
              {/each}
            </span>
          </div>
        {/if}
      {/each}
    </div>
  </section>
{/if}

<style>
  .peek,
  .full {
    inline-size: 100%;
    background: var(--color-panel);
    border: none;
    border-block-end: 1px solid var(--color-border);
    --tone: var(--color-ink-mute);
  }

  [data-tone='pos'] {
    --tone: var(--color-pos);
  }

  [data-tone='neg'] {
    --tone: var(--color-neg);
  }

  .peek {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-lg);
    cursor: pointer;
    text-align: start;
  }

  .rail {
    inline-size: 3px;
    block-size: 1.375rem;
    border-radius: 2px;
    background: var(--tone);
    flex-shrink: 0;
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
    color: var(--color-ink-faint);
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
    color: var(--tone);
  }

  .gap {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--tone);
  }

  .chevron {
    font-family: var(--font-mono);
    color: var(--color-ink-faint);
  }

  .full {
    display: grid;
    gap: var(--space-md);
    padding-block-end: var(--space-md);
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-md) var(--space-lg) 0;
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

  .headline {
    display: flex;
    align-items: baseline;
    gap: var(--space-lg);
    padding-inline: var(--space-lg);
  }

  .title {
    flex: 1;
    font-family: var(--font-serif);
    font-size: var(--font-size-display);
    font-weight: 400;
    letter-spacing: -0.025em;
  }

  .title em {
    display: block;
    color: var(--color-ink-mute);
  }

  .axis {
    color: var(--tone);
  }

  .score {
    margin: 0;
    display: grid;
    justify-items: end;
    gap: var(--space-3xs);
  }

  .value {
    font-family: var(--font-serif);
    font-size: var(--font-size-display);
    line-height: 0.9;
    letter-spacing: -0.04em;
    color: var(--tone);
  }

  .contributors {
    display: grid;
    grid-template-columns: 1fr 1px 1fr;
    gap: var(--space-lg);
    margin-inline: var(--space-lg);
    padding: var(--space-sm) var(--space-md);
    background: var(--color-accent-soft);
    border-radius: var(--radius-md);
  }

  .contributors::before {
    content: '';
    grid-column: 2;
    grid-row: 1;
    background: var(--color-border);
  }

  .column {
    display: grid;
    gap: var(--space-2xs);
    align-content: start;
    min-inline-size: 0;
  }

  .column:first-child {
    grid-column: 1;
  }

  .column:last-child {
    grid-column: 3;
  }

  .column-label {
    color: var(--tone);
    font-weight: 700;
  }

  .nobody {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: var(--font-size-sm);
    color: var(--color-ink-faint);
  }

  .contributor {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    min-inline-size: 0;
  }

  .contributor .name {
    flex: 1;
    min-inline-size: 0;
    font-size: var(--font-size-sm);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .amount {
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    color: var(--color-ink-faint);
  }

  .others {
    display: grid;
    gap: var(--space-xs);
    padding: var(--space-md) var(--space-lg) 0;
    border-block-start: 1px solid var(--color-border);
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .row-label {
    inline-size: 3rem;
    flex-shrink: 0;
    color: var(--tone);
    font-weight: 700;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2xs);
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2xs);
    padding: 1px var(--space-xs);
    border: 1px solid color-mix(in oklch, var(--tone) 20%, transparent);
    background: color-mix(in oklch, var(--tone) 7%, transparent);
    border-radius: var(--radius-xs);
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--tone);
  }

  .row[data-tone='even'] .chip {
    border-style: dashed;
    background: none;
  }

  .chip-value {
    opacity: 0.7;
  }
</style>
