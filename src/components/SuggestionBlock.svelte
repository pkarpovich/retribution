<script lang="ts">
  import type { Hero } from '../types/hero'
  import type { Suggestion } from '../utils/presentation'
  import { HEAVY_CC_AT, recommendBoots, situationalBudget } from '../utils/heroUtils'
  import { capabilitiesFor, teamNeeds, tieGroups } from '../utils/presentation'
  import HeroAvatar from './HeroAvatar.svelte'
  import TierBadge from './TierBadge.svelte'

  interface Props {
    suggestions: Suggestion[]
    enemies: Hero[]
    myTeam: Hero[]
    picksLeft: number
    myPick: Hero | null
    hasDraft: boolean
    onLock: (hero: Hero) => void
    onUnlock: () => void
    onBan: (hero: Hero) => void
  }

  const {
    suggestions,
    enemies,
    myTeam,
    picksLeft,
    myPick,
    hasDraft,
    onLock,
    onUnlock,
    onBan,
  }: Props = $props()

  const needs = $derived(myPick ? teamNeeds(myTeam, enemies) : [])
  const NEEDS_SHOWN = 3

  let focusIndex = $state(0)
  let listView = $state<'auto' | 'axis' | 'rows'>('auto')
  let sortBy = $state<'total' | 'fit'>('total')

  $effect(() => {
    if (focusIndex >= suggestions.length) focusIndex = 0
  })

  const focus = $derived(suggestions[Math.min(focusIndex, suggestions.length - 1)] ?? null)
  const scale = $derived(suggestions[0]?.result.total_score ?? 1)
  const ties = $derived(tieGroups(suggestions))
  const bestFit = $derived([...suggestions].sort((a, b) => b.fit - a.fit)[0]?.hero.hero_name)
  // Scaled against the engine's own ceiling, not the spread of this candidate
  // set — auto-ranging made a ten-point gap look like opposite ends of the
  // world. Fit is the squashed situational half, so it is bounded to plus or
  // minus the budget by construction, and zero sits in the middle: left of it
  // the draft costs you, right of it it pays.
  const budget = situationalBudget()
  const axisAt = (value: number) => Math.max(0, Math.min(100, ((value + budget) / (2 * budget)) * 100))

  // The bar is always as long as the better of the two readings, with the tail
  // showing what the draft added or took away. Comfort rides on the end: it is
  // not part of the draft response and does not belong inside either.
  const barOf = (suggestion: Suggestion) => {
    const drafted = suggestion.strength + suggestion.fit
    return {
      solid: (Math.max(0, Math.min(suggestion.strength, drafted)) / scale) * 100,
      delta: (Math.abs(suggestion.fit) / scale) * 100,
      comfort: (suggestion.comfort / scale) * 100,
      lost: suggestion.fit < 0,
    }
  }

  const signed = (value: number) => `${value < 0 ? '-' : '+'}${Math.abs(Math.round(value))}`

  // Left and right step through the dots as drawn, which is fit order, not
  // list order.
  const byFit = $derived(suggestions
    .map((suggestion, index) => ({ suggestion, index }))
    .sort((a, b) => a.suggestion.fit - b.suggestion.fit))
  const axisPosition = $derived(byFit.findIndex(entry => entry.index === focusIndex))

  function step(direction: -1 | 1) {
    const next = axisPosition + direction
    if (next < 0 || next >= byFit.length) return
    focusIndex = byFit[next].index
  }

  const facts = $derived(focus ? capabilitiesFor(focus.hero, enemies) : [])
  const paying = $derived(facts.filter(fact => fact.stance === 'wanted' || fact.stance === 'off'))
  // Only worth saying when the hero actually brought enough control for the
  // rule to have mattered — otherwise it reads as a complaint about a hero
  // that never had any.
  const switchedOff = $derived(facts.find(fact =>
    fact.stance === 'off'
    && fact.points !== null
    && (focus?.hero.capabilities?.ccScore ?? 0) >= HEAVY_CC_AT))

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

  interface Row {
    tie: string[] | null
    items: { suggestion: Suggestion; index: number }[]
  }

  // Rank labels always come from the engine's own ordering, so re-sorting the
  // list never hides where a hero actually stands. Tie brackets are a property
  // of that ordering too, so they are only drawn when it is the one on screen.
  const ordered = $derived(sortBy === 'fit'
    ? suggestions.map((suggestion, index) => ({ suggestion, index })).sort((a, b) => b.suggestion.fit - a.suggestion.fit)
    : suggestions.map((suggestion, index) => ({ suggestion, index })))

  const rows = $derived(ordered.reduce<Row[]>((groups, entry) => {
    const tie = sortBy === 'total' ? tieOf(entry.suggestion.hero.hero_name) : null
    const last = groups.at(-1)
    if (tie && last && last.tie === tie) last.items.push(entry)
    else groups.push({ tie, items: [entry] })
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
    {@const build = recommendBoots(myPick, enemies)}
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

    <div class="panel">
      <span class="kicker">WHAT TO BUY</span>
      <div class="lines">
        <p class="line">
          <span class="line-name">{build.boots}</span>
          <span class="line-why">{build.bootsReason}</span>
        </p>
        <p class="line">
          <span class="line-name">{build.blessing} Retribution</span>
          <span class="line-why">{build.blessingReason}</span>
        </p>
      </div>
    </div>

    {#if needs.length > 0}
      <div class="panel">
        <div class="panel-head">
          <span class="kicker">TELL YOUR TEAM</span>
          <span class="kicker">
            {picksLeft > 0 ? `${picksLeft} pick${picksLeft === 1 ? '' : 's'} left` : 'items only now'}
          </span>
        </div>
        <div class="lines">
          {#each needs.slice(0, NEEDS_SHOWN) as need (need.key)}
            <p class="line need">
              <span class="line-name">{need.name}</span>
              <span class="line-why">{need.evidence} — {need.gap}</span>
            </p>
          {/each}
        </div>
      </div>
    {/if}
  {:else if focus}
    {@const rank = rankLabel(focus.hero.hero_name)}
    {@const bar = barOf(focus)}
    <div class="head">
      <span class="kicker">SUGGESTED · JUNGLE</span>
      <span class="legend">
        <span class="swatch strength" aria-hidden="true"></span> strength
        <span class="swatch fit" aria-hidden="true"></span> fit
        <span class="swatch comfort" aria-hidden="true"></span> yours
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
          {Math.round(focus.strength)}<span
            class="fit-figure"
            class:lost={focus.fit < 0}>{signed(focus.fit)}</span>{#if focus.comfort > 0}<span
            class="comfort-figure">{signed(focus.comfort)}</span>{/if}
        </span>
      </div>

      <span class="stack" aria-hidden="true">
        <span class="seg strength" style="inline-size: {bar.solid}%"></span>
        <span class="seg" class:fit={!bar.lost} class:lost={bar.lost} style="inline-size: {bar.delta}%"></span>
        {#if bar.comfort > 0}
          <span class="seg comfort" style="inline-size: {bar.comfort}%"></span>
        {/if}
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

      <div class="actions">
        <button class="lock" onclick={() => onLock(focus.hero)}>LOCK THIS PICK</button>
        <button
          class="ban"
          onclick={() => onBan(focus.hero)}
          aria-label="Ban {focus.hero.hero_name} for this match"
        >BANNED</button>
      </div>
    </article>

    <div class="compare" class:force-rows={listView === 'rows'} class:force-axis={listView === 'axis'}>
      <div class="axis">
        <div class="axis-head">
          <span class="kicker">FIT · ALL {suggestions.length}</span>
          <button class="toggle" onclick={() => (listView = 'rows')}>{suggestions.length} BARS ›</button>
        </div>
        <div class="axis-body">
          <button
            class="step"
            onclick={() => step(-1)}
            disabled={axisPosition <= 0}
            aria-label="Previous by fit"
          >‹</button>

          <div class="axis-line">
            <span class="zero" aria-hidden="true"></span>
            {#each suggestions as suggestion, index (suggestion.hero.id)}
              <button
                class="dot"
                class:on={index === focusIndex}
                class:best={suggestion.hero.hero_name === bestFit}
                style="inset-inline-start: {axisAt(suggestion.fit)}%"
                onclick={() => (focusIndex = index)}
                aria-label="{suggestion.hero.hero_name}, fit {Math.round(suggestion.fit)}"
                aria-pressed={index === focusIndex}
              ></button>
            {/each}
          </div>

          <button
            class="step"
            onclick={() => step(1)}
            disabled={axisPosition >= suggestions.length - 1}
            aria-label="Next by fit"
          >›</button>
        </div>
        <div class="axis-foot">
          <span>-{budget}</span>
          <span class="axis-focus">{focus.hero.hero_name} {signed(focus.fit)} · best {bestFit}</span>
          <span>+{budget}</span>
        </div>
      </div>

      <div class="rows">
        <div class="rows-head">
          <span class="kicker">ALL {suggestions.length}</span>
          <div class="sort" role="group" aria-label="Sort suggestions">
            <button
              class="sort-option"
              class:on={sortBy === 'total'}
              aria-pressed={sortBy === 'total'}
              onclick={() => (sortBy = 'total')}
            >TOTAL</button>
            <button
              class="sort-option"
              class:on={sortBy === 'fit'}
              aria-pressed={sortBy === 'fit'}
              onclick={() => (sortBy = 'fit')}
            >FIT</button>
          </div>
          <button class="toggle" onclick={() => (listView = 'axis')}>COLLAPSE ˄</button>
        </div>
        {#each rows as group, groupIndex (groupIndex)}
          <div class="row-group" class:tied={Boolean(group.tie)}>
            {#each group.items as item (item.suggestion.hero.id)}
              {@const itemRank = rankLabel(item.suggestion.hero.hero_name)}
              {@const itemBar = barOf(item.suggestion)}
              <button class="row" class:on={item.index === focusIndex} onclick={() => (focusIndex = item.index)}>
                <HeroAvatar hero={item.suggestion.hero} size={16} />
                <span class="row-rank">{itemRank.label}</span>
                <span class="row-name">{item.suggestion.hero.hero_name}</span>
                <span class="stack small" aria-hidden="true">
                  <span class="seg strength" style="inline-size: {itemBar.solid}%"></span>
                  <span class="seg" class:fit={!itemBar.lost} class:lost={itemBar.lost} style="inline-size: {itemBar.delta}%"></span>
                  {#if itemBar.comfort > 0}
                    <span class="seg comfort" style="inline-size: {itemBar.comfort}%"></span>
                  {/if}
                </span>
                <span
                  class="row-fit"
                  class:best={item.suggestion.hero.hero_name === bestFit}
                  class:lost={item.suggestion.fit < 0}
                >{signed(item.suggestion.fit)}</span>
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

  .panel {
    display: grid;
    gap: var(--space-xs);
    padding: var(--space-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
  }

  .panel-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-sm);
  }

  .lines {
    display: grid;
    gap: var(--space-xs);
  }

  .line {
    display: grid;
    gap: 1px;
    margin: 0;
  }

  .line.need {
    padding-inline-start: var(--space-sm);
    border-inline-start: 2px solid var(--color-neg);
  }

  .line-name {
    font-size: var(--font-size-md);
    font-weight: 600;
  }

  .line-why {
    font-size: var(--font-size-sm);
    color: var(--color-ink-mute);
    text-wrap: pretty;
  }

  .head,
  .caps-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-sm);
  }

  /* Centred, not trailing: on the right it sat directly above the forward
     arrow and the two were being hit for each other. */
  .axis-head {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: baseline;
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

  .fit-figure {
    color: var(--color-accent);
    margin-inline-start: 1px;
  }

  .fit-figure.lost {
    color: var(--color-neg);
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

  /* The bars carry the score from one draft to the next: watching a hero's
     fit shrink when an enemy is added is the point, not decoration. */
  .seg {
    transition: inline-size var(--duration-base) var(--ease-out);
  }

  .seg.strength {
    background: var(--color-ink);
  }

  .seg.fit {
    background: var(--color-accent);
  }

  .seg.lost {
    background: var(--color-neg);
  }

  .seg.comfort,
  .swatch.comfort {
    background: var(--color-pos);
  }

  .comfort-figure {
    color: var(--color-pos);
    margin-inline-start: 1px;
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

  .actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--space-xs);
  }

  .lock,
  .ban {
    padding-block: var(--space-sm);
    border-radius: var(--radius-md);
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    font-weight: 700;
    letter-spacing: var(--tracking-mono);
  }

  .lock {
    background: var(--color-accent);
    border: none;
    color: var(--color-on-accent);

    &:hover {
      background: var(--color-accent-hover);
    }
  }

  .ban {
    padding-inline: var(--space-md);
    background: none;
    border: 1px solid var(--color-border-strong);
    color: var(--color-ink-mute);

    &:hover {
      border-color: var(--color-neg);
      color: var(--color-neg);
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

  @container app (inline-size > 46rem) {
    .axis {
      display: none;
    }

    .rows {
      display: grid;
    }
  }

  /* An explicit choice wins over the container default at any width. */
  .compare.force-rows .axis,
  .compare.force-axis .rows {
    display: none;
  }

  .compare.force-rows .rows,
  .compare.force-axis .axis {
    display: grid;
  }

  .rows-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
    padding-block-end: var(--space-3xs);
  }

  .sort {
    display: flex;
    margin-inline-end: auto;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xs);
    overflow: hidden;
  }

  .sort-option {
    padding: 1px var(--space-xs);
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    letter-spacing: 0.08em;
    color: var(--color-ink-faint);
    transition: background-color var(--duration-fast) var(--ease-out);

    &.on {
      background: var(--color-accent-soft);
      color: var(--color-accent);
      font-weight: 700;
    }
  }

  .toggle {
    padding: 0;
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    letter-spacing: 0.08em;
    color: var(--color-accent);
  }

  .axis-body {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-2xs);
  }

  .step {
    inline-size: 1.5rem;
    block-size: 1.5rem;
    display: grid;
    place-items: center;
    padding: 0;
    background: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xs);
    cursor: pointer;
    font-family: var(--font-mono);
    color: var(--color-ink-mute);

    &:disabled {
      opacity: 0.35;
      cursor: default;
    }
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
    padding: 0;
    border-radius: var(--radius-full);
    background: var(--color-panel);
    border: 1.5px solid var(--color-border-strong);
    cursor: pointer;
    transition:
      inset-inline-start var(--duration-base) var(--ease-out),
      inset-block-start var(--duration-fast) var(--ease-out),
      inline-size var(--duration-fast) var(--ease-out),
      block-size var(--duration-fast) var(--ease-out),
      margin-inline-start var(--duration-fast) var(--ease-out);
  }

  /* The hit target is the tap area, not the drawn dot. */
  .dot::after {
    content: '';
    position: absolute;
    inset: -8px;
  }

  .zero {
    position: absolute;
    inset-block: 4px;
    inset-inline-start: 50%;
    inline-size: 1px;
    background: var(--color-border-strong);
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

  /* Every group carries the same gutter so the tie bracket cannot shift its
     rows out of line with the rest of the list. */
  .row-group {
    display: grid;
    gap: var(--space-3xs);
    padding-inline-start: var(--space-xs);
    border-inline-start: 2px solid transparent;
  }

  .row-group.tied {
    border-inline-start-color: var(--color-border-strong);
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
    transition:
      background-color var(--duration-fast) var(--ease-out),
      border-color var(--duration-fast) var(--ease-out);

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
