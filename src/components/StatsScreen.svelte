<script lang="ts">
  import type { MatchRecord, MatchOutcome } from '../types/match'
  import type { Tally } from '../utils/matchStats'
  import heroData from '../data/heroes.json'
  import { matches } from '../lib/matches.svelte'
  import { CONFIDENT_AT, exportMatches, summarise, winRate } from '../utils/matchStats'

  interface Props {
    onClose: () => void
    onReopen: (record: MatchRecord) => void
  }

  const { onClose, onReopen }: Props = $props()

  // heroes.json moves twice a week, so a game scored on an older roster will
  // not reproduce its logged numbers. Say so rather than let the difference
  // look like a bug.
  const stale = (record: MatchRecord) => record.dataVersion !== heroData.lastUpdated

  let copied = $state<string | null>(null)

  const summary = $derived(summarise(matches.all))
  const played = (tally: Tally) => tally.won + tally.lost

  function score(tally: Tally) {
    const rate = winRate(tally)
    return rate === null ? `${tally.won}-${tally.lost}` : `${tally.won}-${tally.lost} · ${rate}%`
  }

  function deliver(records: MatchRecord[], name: string) {
    const json = exportMatches(records, new Date().toISOString())

    navigator.clipboard?.writeText(json).then(
      () => (copied = name),
      () => (copied = null),
    )

    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = name
    link.click()
    URL.revokeObjectURL(url)
  }

  const OUTCOMES: { value: MatchOutcome; label: string }[] = [
    { value: 'won', label: 'WON' },
    { value: 'lost', label: 'LOST' },
    { value: 'pending', label: 'OPEN' },
  ]

  const settle = (record: MatchRecord, outcome: MatchOutcome) => () =>
    matches.settle(record.id, outcome)
</script>

<section class="screen">
  <header class="bar">
    <button class="back" onclick={onClose}>
      <span aria-hidden="true">‹</span> DRAFT
    </button>
    <h2 class="title">Your games</h2>
    <div class="bar-end">
      {#if matches.all.length > 0}
        <button class="clear" onclick={() => matches.clear()}>CLEAR</button>
      {/if}
    </div>
  </header>

  <div class="body">
    {#if matches.all.length === 0}
      <p class="empty">
        Nothing logged yet. Lock a jungle pick and the draft is written down;
        say how it went when the game ends.
      </p>
    {:else}
      <div class="summary">
        <div class="figure">
          <span class="figure-value">{score(summary.settled)}</span>
          <span class="kicker">SETTLED{summary.pending > 0 ? ` · ${summary.pending} OPEN` : ''}</span>
        </div>

        <div class="split">
          <div class="figure">
            <span class="figure-value">{score(summary.followed)}</span>
            <span class="kicker">TOOK THE TOP PICK</span>
          </div>
          <div class="figure">
            <span class="figure-value">{score(summary.overrode)}</span>
            <span class="kicker">PICKED SOMETHING ELSE</span>
          </div>
        </div>

        <p class="caveat">
          Read these as counts, not rates. A percentage only appears past
          {CONFIDENT_AT} games, and a draft is a minority of what decides one.
        </p>
      </div>

      {#if summary.heroes.length > 0}
        <div class="heroes">
          <span class="kicker">BY HERO</span>
          <div class="hero-rows">
            {#each summary.heroes as entry (entry.hero.id)}
              <div class="hero-row">
                <span class="hero-name">{entry.hero.name}</span>
                <span class="hero-score">{score(entry.tally)}</span>
                <span class="hero-games">{played(entry.tally)}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <div class="exports">
        <button class="export" onclick={() => deliver(matches.all, 'retribution-games.json')}>
          EXPORT ALL · {matches.all.length}
        </button>
        {#if copied}
          <span class="copied" role="status">copied to clipboard</span>
        {/if}
      </div>

      <div class="log">
        {#each matches.all as record (record.id)}
          <article class="game" data-outcome={record.outcome}>
            <div class="game-head">
              <span class="game-pick">{record.pick.name}</span>
              <span class="game-meta">
                {#if record.rank}#{record.rank} of {record.shown}{/if}
                · {new Date(record.at).toLocaleDateString()}
              </span>
            </div>

            <p class="game-draft">
              vs {record.enemies.map(hero => hero.name).join(', ') || 'nobody revealed'}
            </p>

            <!-- Every game stays editable. A result can be entered days later,
                 and a misremembered one can be corrected. -->
            <div class="outcome" role="group" aria-label="Result for {record.pick.name}">
              {#each OUTCOMES as option (option.value)}
                <button
                  class="call"
                  data-outcome={option.value}
                  class:on={record.outcome === option.value}
                  aria-pressed={record.outcome === option.value}
                  onclick={settle(record, option.value)}
                >{option.label}</button>
              {/each}
            </div>

            <textarea
              class="note"
              rows="1"
              placeholder="What happened? Anything the numbers cannot see."
              aria-label="Note for {record.pick.name}"
              value={record.note}
              oninput={event => matches.annotate(record.id, event.currentTarget.value)}
            ></textarea>

            <div class="game-actions">
              <button class="link strong" onclick={() => onReopen(record)}>
                OPEN DRAFT
                {#if stale(record)}<span class="stale">· older data</span>{/if}
              </button>
              <button class="link" onclick={() => deliver([record], `retribution-${record.id}.json`)}>
                EXPORT
              </button>
              <button class="link muted" onclick={() => matches.remove(record.id)}>DELETE</button>
            </div>
          </article>
        {/each}
      </div>
    {/if}
  </div>
</section>

<style>
  .screen {
    position: absolute;
    inset: 0;
    z-index: 50;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    background: var(--color-bg);
    animation: sheet-in var(--duration-base) var(--ease-out);
  }

  .bar {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-md) var(--space-xl);
    background: var(--color-panel);
    border-block-end: 1px solid var(--color-border);
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

  .kicker {
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    letter-spacing: 0.16em;
    color: var(--color-ink-faint);
  }

  .body {
    display: grid;
    align-content: start;
    gap: var(--space-lg);
    overflow-y: auto;
    padding: var(--space-lg) var(--space-xl) var(--space-2xl);
  }

  .empty {
    max-inline-size: var(--measure);
    margin-inline: auto;
    margin: 0;
    padding-block: var(--space-2xl);
    text-align: center;
    font-family: var(--font-serif);
    font-style: italic;
    font-size: var(--font-size-md);
    color: var(--color-ink-faint);
    text-wrap: pretty;
  }

  .summary {
    display: grid;
    gap: var(--space-md);
  }

  .split {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
    gap: var(--space-md);
  }

  .figure {
    display: grid;
    gap: var(--space-3xs);
  }

  .figure-value {
    font-variant-numeric: tabular-nums;
    font-family: var(--font-serif);
    font-size: var(--font-size-xl);
    line-height: 1;
  }

  .caveat {
    max-inline-size: var(--measure);
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-ink-mute);
    text-wrap: pretty;
  }

  .heroes {
    display: grid;
    gap: var(--space-xs);
  }

  .hero-rows {
    display: grid;
  }

  .hero-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto 2rem;
    gap: var(--space-sm);
    align-items: baseline;
    padding-block: var(--space-2xs);
    border-block-end: 1px solid var(--color-border);
  }

  .hero-name {
    font-size: var(--font-size-sm);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .hero-score,
  .hero-games {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
  }

  .hero-games {
    text-align: end;
    color: var(--color-ink-faint);
  }

  .exports {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    flex-wrap: wrap;
  }

  .export {
    padding: var(--space-xs) var(--space-lg);
    background: var(--color-accent);
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    color: var(--color-on-accent);
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    font-weight: 700;
    letter-spacing: var(--tracking-mono);
  }

  .copied {
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    color: var(--color-pos);
  }

  .log {
    display: grid;
    gap: var(--space-md);
  }

  .game {
    display: grid;
    gap: var(--space-xs);
    padding: var(--space-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-panel);
  }

  .game[data-outcome='pending'] {
    border-color: color-mix(in oklch, var(--color-accent) 40%, transparent);
  }

  .game-head {
    display: flex;
    align-items: baseline;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }

  .game-pick {
    font-size: var(--font-size-md);
    font-weight: 600;
  }

  .game-meta {
    margin-inline-start: auto;
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    color: var(--color-ink-faint);
    white-space: nowrap;
  }

  .game-draft {
    max-inline-size: var(--measure);
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-ink-mute);
    text-wrap: pretty;
  }

  .outcome {
    display: flex;
    gap: var(--space-xs);
  }

  .call {
    padding: var(--space-2xs) var(--space-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: none;
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    font-weight: 700;
    letter-spacing: var(--tracking-mono);
    color: var(--color-ink-faint);
    transition:
      background-color var(--duration-fast) var(--ease-out),
      border-color var(--duration-fast) var(--ease-out),
      color var(--duration-fast) var(--ease-out);
  }

  .call.on[data-outcome='won'] {
    border-color: color-mix(in oklch, var(--color-pos) 45%, transparent);
    background: color-mix(in oklch, var(--color-pos) 9%, transparent);
    color: var(--color-pos);
  }

  .call.on[data-outcome='lost'] {
    border-color: color-mix(in oklch, var(--color-neg) 45%, transparent);
    background: color-mix(in oklch, var(--color-neg) 9%, transparent);
    color: var(--color-neg);
  }

  .call.on[data-outcome='pending'] {
    border-color: var(--color-accent);
    background: var(--color-accent-soft);
    color: var(--color-accent);
  }

  .note {
    max-inline-size: var(--measure);
    inline-size: 100%;
    field-sizing: content;
    min-block-size: 2lh;
    padding: var(--space-xs) var(--space-sm);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-bg);
    font: inherit;
    font-size: var(--font-size-sm);
    color: var(--color-ink);
    resize: none;
  }

  .note::placeholder {
    color: var(--color-ink-faint);
  }

  .game-actions {
    display: flex;
    gap: var(--space-lg);
  }

  .link {
    padding: 0;
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    letter-spacing: 0.08em;
    color: var(--color-accent);
  }

  .link.muted {
    color: var(--color-ink-faint);
  }

  .link.strong {
    font-weight: 700;
  }

  .stale {
    margin-inline-start: var(--space-2xs);
    font-weight: 400;
    color: var(--color-ink-faint);
  }
</style>
