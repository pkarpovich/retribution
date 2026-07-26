<script lang="ts">
  import type { Hero } from '../types/hero'
  import type { Suggestion } from '../utils/presentation'
  import { capabilitiesFor, tieGroups } from '../utils/presentation'
  import HeroAvatar from './HeroAvatar.svelte'
  import TierBadge from './TierBadge.svelte'

  interface Props {
    suggestions: Suggestion[]
    enemies: Hero[]
    myPick: Hero | null
    hasDraft: boolean
    onLock: (hero: Hero) => void
    onUnlock: () => void
  }

  const { suggestions, enemies, myPick, hasDraft, onLock, onUnlock }: Props = $props()

  let focusIndex = $state(0)
  let expanded = $state(false)

  $effect(() => {
    if (focusIndex >= suggestions.length) focusIndex = 0
  })

  const focus = $derived(suggestions[Math.min(focusIndex, suggestions.length - 1)] ?? null)
  const scale = $derived(suggestions[0]?.result.total_score ?? 1)
  const ties = $derived(tieGroups(suggestions))
  const bestFit = $derived([...suggestions].sort((a, b) => b.fit - a.fit)[0]?.hero.hero_name)
  const fitRange = $derived<[number, number]>([
    Math.floor(Math.min(...suggestions.map(s => s.fit))),
    Math.ceil(Math.max(...suggestions.map(s => s.fit))),
  ])

  const facts = $derived(focus ? capabilitiesFor(focus.hero, enemies) : [])
  const paying = $derived(facts.filter(fact => fact.stance === 'wanted' || fact.stance === 'off'))
  // Only worth saying when the hero actually brought enough control for the
  // rule to have mattered — otherwise it reads as a complaint about a hero
  // that never had any.
  const CONTROL_WORTH_MENTIONING = 4
  const switchedOff = $derived(facts.find(fact =>
    fact.stance === 'off'
    && fact.points !== null
    && (focus?.hero.capabilities?.ccScore ?? 0) >= CONTROL_WORTH_MENTIONING))

  function tieOf(name: string) {
    return ties.find(group => group.includes(name)) ?? null
  }

  function rankLabel(name: string) {
    const group = tieOf(name)
    const index = suggestions.findIndex(s => s.hero.hero_name === name)
    if (!group) return { label: `#${index + 1}`, tied: false }
    const positions = group.map(member => suggestions.findIndex(s => s.hero.hero_name === member)).sort((a, b) => a - b)
    return { label: `#${positions[0] + 1}–${positions[positions.length - 1] + 1}`, tied: true }
  }

  const axisAt = (value: number) => {
    const [lo, hi] = fitRange
    return hi === lo ? 50 : ((value - lo) / (hi - lo)) * 100
  }

  interface Row {
    tie: string[] | null
    items: { suggestion: Suggestion; index: number }[]
  }

  const rows = $derived(suggestions.reduce<Row[]>((groups, suggestion, index) => {
    const tie = tieOf(suggestion.hero.hero_name)
    const last = groups.at(-1)
    if (tie && last && last.tie === tie) last.items.push({ suggestion, index })
    else groups.push({ tie, items: [{ suggestion, index }] })
    return groups
  }, []))
</script>

<section class="block">
  {#if !hasDraft}
    <div class="prompt">
      <p class="prompt-title">Start with the enemy team</p>
      <p class="prompt-copy">Tap heroes below to fill the draft. Suggestions sharpen with every pick.</p>
    </div>
  {:else if myPick}
    <div class="locked">
      <HeroAvatar hero={myPick} size={42} selected />
      <div class="locked-copy">
        <span class="kicker accent">YOUR JUNGLE PICK</span>
        <span class="locked-name">
          <span class="serif">{myPick.hero_name}</span>
          <TierBadge tier={myPick.tier} />
        </span>
      </div>
      <button class="change" onclick={onUnlock}>CHANGE</button>
    </div>
  {:else if focus}
    {@const rank = rankLabel(focus.hero.hero_name)}
    <div class="head">
      <span class="kicker">SUGGESTED · JUNGLE</span>
      <span class="legend">
        <span class="swatch strength" aria-hidden="true"></span> strength
        <span class="swatch fit" aria-hidden="true"></span> fit
      </span>
    </div>

    <article class="card">
      <div class="card-head">
        <HeroAvatar hero={focus.hero} size={40} />
        <div class="identity">
          <span class="identity-line">
            <span class="serif name">{focus.hero.hero_name}</span>
            <TierBadge tier={focus.hero.tier} />
          </span>
          <span class="kicker">{rank.label} of {suggestions.length}{rank.tied ? ' · TIED' : ''}</span>
        </div>
        <span class="figures">
          {Math.round(focus.strength)}<span class="plus">+</span><span class="fit-figure">{Math.round(focus.fit)}</span>
        </span>
      </div>

      <span class="stack" aria-hidden="true">
        <span class="seg strength" style="inline-size: {(focus.strength / scale) * 100}%"></span>
        <span class="seg fit" style="inline-size: {(focus.fit / scale) * 100}%"></span>
      </span>

      <div class="caps">
        <div class="caps-head">
          <span class="kicker">WHAT THIS DRAFT PAYS FOR</span>
          <span class="legend">
            <span class="swatch pays" aria-hidden="true"></span> pays
            <span class="swatch idle" aria-hidden="true"></span> doesn't
          </span>
        </div>
        <div class="cap-grid">
          {#each paying as fact (fact.key)}
            <span class="cap" data-stance={fact.stance} class:has={fact.present}>
              <span class="cap-value">{fact.display}</span>
              <span class="cap-label">{fact.short}</span>
            </span>
          {/each}
        </div>
        {#if switchedOff}
          <p class="note">
            <span class="note-key">{switchedOff.short} {switchedOff.display}</span>
            worth +{switchedOff.points!.toFixed(2)} here — {switchedOff.why}
          </p>
        {/if}
      </div>

      <button class="lock" onclick={() => onLock(focus.hero)}>LOCK THIS PICK</button>
    </article>

    <div class="compare" class:expanded>
      <div class="axis">
        <div class="axis-head">
          <span class="kicker">FIT · ALL {suggestions.length}</span>
          <button class="expand" onclick={() => (expanded = true)}>{suggestions.length} BARS ›</button>
        </div>
        <div class="axis-line">
          {#each suggestions as suggestion, index (suggestion.hero.id)}
            <span
              class="dot"
              class:on={index === focusIndex}
              class:best={suggestion.hero.hero_name === bestFit}
              style="inset-inline-start: {axisAt(suggestion.fit)}%"
              title="{suggestion.hero.hero_name} {suggestion.fit.toFixed(1)}"
            ></span>
          {/each}
        </div>
        <div class="axis-foot">
          <span>{fitRange[0]}</span>
          <span class="axis-focus">{focus.hero.hero_name} {focus.fit.toFixed(1)} · best {bestFit}</span>
          <span>{fitRange[1]}</span>
        </div>
      </div>

      <div class="rows">
        {#each rows as group, groupIndex (groupIndex)}
          <div class="row-group" class:tied={Boolean(group.tie)}>
            {#each group.items as item (item.suggestion.hero.id)}
              {@const itemRank = rankLabel(item.suggestion.hero.hero_name)}
              <button class="row" class:on={item.index === focusIndex} onclick={() => (focusIndex = item.index)}>
                <HeroAvatar hero={item.suggestion.hero} size={16} />
                <span class="row-rank">{itemRank.label}</span>
                <span class="row-name">{item.suggestion.hero.hero_name}</span>
                <span class="stack small" aria-hidden="true">
                  <span class="seg strength" style="inline-size: {(item.suggestion.strength / scale) * 100}%"></span>
                  <span class="seg fit" style="inline-size: {(item.suggestion.fit / scale) * 100}%"></span>
                </span>
                <span class="row-fit" class:best={item.suggestion.hero.hero_name === bestFit}>
                  {Math.round(item.suggestion.fit)}
                </span>
              </button>
            {/each}
            {#if group.tie}
              <span class="tie-note">tied — the engine knows no order between these</span>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}
</section>

<style>
  .block {
    background: var(--color-panel);
    border-block-end: 1px solid var(--color-border);
    padding: var(--space-md) var(--space-lg) var(--space-lg);
    display: grid;
    gap: var(--space-sm);
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

  .serif {
    font-family: var(--font-serif);
    letter-spacing: var(--tracking-tight);
  }

  .prompt {
    display: grid;
    gap: var(--space-2xs);
    padding-block: var(--space-lg);
    text-align: center;
  }

  .prompt-title {
    margin: 0;
    font-family: var(--font-serif);
    font-style: italic;
    font-size: var(--font-size-lg);
  }

  .prompt-copy {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-ink-mute);
  }

  .locked {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-md);
    border: 1px solid var(--color-accent);
    border-radius: var(--radius-lg);
    background: var(--color-accent-soft);
  }

  .locked-copy {
    flex: 1;
    min-inline-size: 0;
    display: grid;
    gap: var(--space-3xs);
  }

  .locked-name {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    font-size: var(--font-size-lg);
  }

  .change {
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

  .head,
  .caps-head,
  .axis-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-sm);
  }

  .legend {
    display: flex;
    align-items: center;
    gap: var(--space-2xs);
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    color: var(--color-ink-faint);
    white-space: nowrap;
  }

  .swatch {
    inline-size: 6px;
    block-size: 6px;
    border-radius: 1px;
  }

  .swatch.strength,
  .swatch.pays {
    background: var(--color-ink);
  }

  .swatch.fit {
    background: var(--color-accent);
  }

  .swatch.pays {
    background: var(--color-pos);
  }

  .swatch.idle {
    border: 1px dashed var(--color-border-strong);
  }

  .card {
    display: grid;
    gap: var(--space-sm);
    padding: var(--space-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-panel);
  }

  .card-head {
    display: flex;
    gap: var(--space-md);
    align-items: center;
  }

  .identity {
    flex: 1;
    min-inline-size: 0;
    display: grid;
    gap: var(--space-3xs);
  }

  .identity-line {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    flex-wrap: wrap;
  }

  .name {
    font-size: var(--font-size-lg);
  }

  .figures {
    font-family: var(--font-mono);
    font-size: var(--font-size-md);
    font-weight: 600;
    white-space: nowrap;
  }

  .plus {
    color: var(--color-border-strong);
  }

  .fit-figure {
    color: var(--color-accent);
  }

  .stack {
    display: flex;
    block-size: 12px;
    border-radius: var(--radius-xs);
    overflow: hidden;
    background: color-mix(in oklch, var(--color-ink) 6%, transparent);
  }

  .stack.small {
    block-size: 7px;
  }

  .seg.strength {
    background: var(--color-ink);
  }

  .seg.fit {
    background: var(--color-accent);
  }

  .caps {
    display: grid;
    gap: var(--space-xs);
  }

  .cap-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(2.75rem, 1fr));
    gap: var(--space-2xs);
  }

  .cap {
    display: grid;
    justify-items: center;
    padding: var(--space-2xs) 2px;
    border: 1px dashed var(--color-border-strong);
    border-radius: var(--radius-xs);
    white-space: nowrap;
    overflow: hidden;
  }

  .cap.has[data-stance='wanted'] {
    border-style: solid;
    border-color: color-mix(in oklch, var(--color-pos) 34%, transparent);
    background: color-mix(in oklch, var(--color-pos) 9%, transparent);
  }

  .cap-value {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    font-weight: 700;
    color: var(--color-ink-faint);
  }

  .cap.has[data-stance='wanted'] .cap-value {
    color: var(--color-pos);
  }

  .cap-label {
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    color: var(--color-ink-faint);
  }

  .note {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-ink-mute);
    text-wrap: pretty;
  }

  .note-key {
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    font-weight: 700;
    color: var(--color-ink-faint);
    margin-inline-end: var(--space-2xs);
  }

  .lock {
    padding-block: var(--space-sm);
    background: var(--color-accent);
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    color: var(--color-on-accent);
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    font-weight: 700;
    letter-spacing: var(--tracking-mono);

    &:hover {
      background: var(--color-accent-hover);
    }
  }

  /* The comparison has two forms. Which one is right is decided by whether the
     draft column owns its scroll, not by how wide it is — past the split the
     column is 24rem, barely wider than Slide Over, but it keeps its own
     overflow and can afford eight rows. */
  .rows {
    display: none;
    gap: var(--space-3xs);
  }

  .axis {
    display: grid;
    gap: var(--space-2xs);
  }

  .compare.expanded .axis {
    display: none;
  }

  .compare.expanded .rows {
    display: grid;
  }

  @container app (inline-size > 46rem) {
    .axis {
      display: none;
    }

    .rows {
      display: grid;
    }
  }

  .expand {
    padding: 0;
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    letter-spacing: 0.08em;
    color: var(--color-accent);
  }

  .axis-line {
    position: relative;
    block-size: 22px;
  }

  .axis-line::before {
    content: '';
    position: absolute;
    inset-block-start: 10px;
    inset-inline: 0;
    block-size: 1px;
    background: var(--color-border-strong);
  }

  .dot {
    position: absolute;
    inset-block-start: 6px;
    inline-size: 7px;
    block-size: 7px;
    margin-inline-start: -3.5px;
    border-radius: var(--radius-full);
    background: var(--color-panel);
    border: 1.5px solid var(--color-border-strong);
  }

  .dot.best {
    border-color: var(--color-accent);
  }

  .dot.on {
    inset-block-start: 4px;
    inline-size: 11px;
    block-size: 11px;
    margin-inline-start: -5.5px;
    background: var(--color-accent);
    border: none;
    box-shadow: 0 0 0 3px var(--color-accent-soft);
  }

  .axis-foot {
    display: flex;
    justify-content: space-between;
    gap: var(--space-sm);
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    color: var(--color-ink-faint);
  }

  .axis-focus {
    color: var(--color-ink-mute);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .row-group {
    display: grid;
    gap: var(--space-3xs);
  }

  .row-group.tied {
    padding-inline-start: var(--space-xs);
    margin-inline-start: -3px;
    border-inline-start: 2px solid var(--color-border-strong);
  }

  .row {
    display: grid;
    grid-template-columns: auto 2.75rem minmax(0, 1fr) minmax(0, 2fr) auto;
    gap: var(--space-xs);
    align-items: center;
    padding: var(--space-3xs) var(--space-2xs);
    background: none;
    border: 1px solid transparent;
    border-radius: var(--radius-xs);
    cursor: pointer;
    text-align: start;

    &.on {
      background: var(--color-accent-soft);
      border-color: var(--color-accent);
    }
  }

  .row-rank,
  .row-fit {
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    color: var(--color-ink-faint);
  }

  .row-fit.best {
    color: var(--color-accent);
    font-weight: 700;
  }

  .row-name {
    font-size: var(--font-size-sm);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tie-note {
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    color: var(--color-ink-mute);
    padding-inline-start: var(--space-xs);
  }
</style>
