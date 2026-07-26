<script lang="ts">
  import type { Hero } from '../types/hero'
  import type { Suggestion } from '../utils/presentation'
  import { getLatestStats } from '../utils/heroUtils'
  import HeroAvatar from './HeroAvatar.svelte'
  import TierBadge from './TierBadge.svelte'

  interface Props {
    suggestions: Suggestion[]
    myPick: Hero | null
    hasDraft: boolean
    onLock: (hero: Hero) => void
    onUnlock: () => void
  }

  const { suggestions, myPick, hasDraft, onLock, onUnlock }: Props = $props()

  let focusIndex = $state(0)
  const focus = $derived(suggestions[Math.min(focusIndex, suggestions.length - 1)] ?? null)

  $effect(() => {
    if (focusIndex >= suggestions.length) focusIndex = 0
  })

  const relations = $derived(focus
    ? [
        { label: 'STRONG VS', tone: 'pos', heroes: focus.matchups.strong },
        { label: 'WEAK VS', tone: 'neg', heroes: focus.matchups.weak },
        { label: 'SYNERGY', tone: 'accent', heroes: focus.matchups.synergy },
      ]
    : [])
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
    <div class="head">
      <span class="kicker">SUGGESTED · JUNGLE</span>
      <span class="head-count">{suggestions.length} picks</span>
    </div>

    <article class="card">
      <div class="card-head">
        <HeroAvatar hero={focus.hero} size={50} />
        <div class="identity">
          <span class="identity-line">
            <span class="serif name">{focus.hero.hero_name}</span>
            <TierBadge tier={focus.hero.tier} />
          </span>
          {#if getLatestStats(focus.hero)}
            {@const stats = getLatestStats(focus.hero)!}
            <span class="stats">
              WR {stats.win_rate.toFixed(1)}% · PR {stats.pick_rate.toFixed(1)}% · BR {stats.ban_rate.toFixed(1)}%
            </span>
          {/if}
        </div>
        <p class="match">
          <span class="match-value">{focus.match}</span>
          <span class="kicker">MATCH</span>
        </p>
      </div>

      <div class="relations">
        {#each relations as column (column.label)}
          <div class="relation" data-tone={column.tone}>
            <span class="kicker relation-label">{column.label}</span>
            {#if column.heroes.length === 0}
              <span class="none">—</span>
            {:else}
              <span class="faces">
                {#each column.heroes.slice(0, 3) as hero (hero.id)}
                  <HeroAvatar {hero} size={19} />
                {/each}
              </span>
            {/if}
          </div>
        {/each}
      </div>

      <ul class="reasons">
        {#each focus.reasons.slice(0, 2) as reason (reason)}
          <li>{reason}</li>
        {/each}
      </ul>

      <button class="lock" onclick={() => onLock(focus.hero)}>LOCK THIS PICK</button>
    </article>

    <div class="rail" role="tablist" aria-label="Other suggestions">
      {#each suggestions as suggestion, index (suggestion.hero.id)}
        <button
          class="pip"
          class:on={index === focusIndex}
          role="tab"
          aria-selected={index === focusIndex}
          onclick={() => (focusIndex = index)}
        >
          <HeroAvatar hero={suggestion.hero} size={22} />
          <span class="pip-copy">
            <span class="pip-rank">#{index + 1}</span>
            <span class="pip-score">{suggestion.match}</span>
          </span>
        </button>
      {/each}
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

  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }

  .head-count {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: var(--font-size-sm);
    color: var(--color-ink-mute);
  }

  .card {
    display: grid;
    gap: var(--space-sm);
    padding: var(--space-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background:
      radial-gradient(12rem 6rem at 92% -20%, var(--color-accent-soft), transparent),
      var(--color-panel);
  }

  .card-head {
    display: flex;
    gap: var(--space-md);
    align-items: flex-start;
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

  .stats {
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    color: var(--color-ink-mute);
  }

  .match {
    margin: 0;
    display: grid;
    justify-items: end;
    gap: var(--space-3xs);
  }

  .match-value {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: calc(var(--font-size-xl) * 1.4);
    line-height: 1;
    color: var(--color-accent);
  }

  .relations {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }

  .relation {
    display: grid;
    gap: var(--space-2xs);
    min-inline-size: 0;
    --tone: var(--color-ink-mute);

    &[data-tone='pos'] {
      --tone: var(--color-pos);
    }

    &[data-tone='neg'] {
      --tone: var(--color-neg);
    }

    &[data-tone='accent'] {
      --tone: var(--color-accent);
    }
  }

  .relation-label {
    color: var(--tone);
    font-weight: 700;
  }

  .none {
    font-family: var(--font-serif);
    font-style: italic;
    color: var(--color-ink-faint);
  }

  .faces {
    display: flex;
    gap: var(--space-3xs);
  }

  .reasons {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: var(--space-3xs);
  }

  .reasons li {
    font-size: var(--font-size-sm);
    color: var(--color-ink-mute);
    padding-inline-start: var(--space-md);
    position: relative;
  }

  .reasons li::before {
    content: '—';
    position: absolute;
    inset-inline-start: 0;
    color: var(--color-accent);
    font-family: var(--font-mono);
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

  .rail {
    display: flex;
    gap: var(--space-xs);
    overflow-x: auto;
    padding-block-end: var(--space-3xs);
    scrollbar-width: thin;
  }

  .pip {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-2xs) var(--space-sm) var(--space-2xs) var(--space-2xs);
    background: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    cursor: pointer;

    &.on {
      background: var(--color-accent-soft);
      border-color: var(--color-accent);
    }
  }

  .pip-copy {
    display: grid;
    text-align: start;
    line-height: 1.05;
  }

  .pip-rank {
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    color: var(--color-ink-faint);
  }

  .pip-score {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: var(--font-size-md);
  }

  .pip.on .pip-score {
    color: var(--color-accent);
  }
</style>
