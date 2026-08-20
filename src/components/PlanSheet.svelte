<script lang="ts">
  import type { BootRecommendation, Hero } from '../types/hero'
  import type { TeamNeed } from '../utils/presentation'
  import HeroAvatar from './HeroAvatar.svelte'

  interface Props {
    build: BootRecommendation
    needs: TeamNeed[]
    picksLeft: number
    worksWith: Hero[]
    onClose: () => void
  }

  const { build, needs, picksLeft, worksWith, onClose }: Props = $props()

  const NEEDS_SHOWN = 3

  const items = $derived([
    { name: build.boots, why: build.bootsReason },
    { name: `${build.blessing} Retribution`, why: build.blessingReason },
  ])

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') onClose()
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="sheet" role="dialog" aria-modal="true" aria-label="Your plan">
  <button class="scrim" onclick={onClose} aria-label="Close your plan"></button>

  <div class="panel">
    <span class="handle" aria-hidden="true"></span>

    <div class="head">
      <span class="kicker">WHAT TO BUY</span>
      <button class="done" onclick={onClose}>DONE</button>
    </div>

    <div class="card">
      {#each items as item (item.name)}
        <p class="item">
          <span class="dot" aria-hidden="true"></span>
          <span class="item-copy">
            <span class="item-name">{item.name}</span>
            <span class="item-why">{item.why}</span>
          </span>
        </p>
      {/each}
    </div>

    {#if needs.length > 0}
      <div class="head">
        <span class="kicker">TELL YOUR TEAM</span>
        <span class="kicker">
          {picksLeft > 0 ? `${picksLeft} ally pick${picksLeft === 1 ? '' : 's'} left` : 'items only now'}
        </span>
      </div>

      <div class="card">
        {#each needs.slice(0, NEEDS_SHOWN) as need (need.key)}
          <p class="need">
            <span class="need-name">{need.name}</span>
            <span class="need-why">{need.evidence} - {need.gap}</span>
          </p>
        {/each}
      </div>
    {/if}

    {#if worksWith.length > 0}
      <div class="head">
        <span class="kicker">WORKS WITH YOU</span>
        <span class="kicker">not on the board figure</span>
      </div>

      <div class="card partners">
        {#each worksWith as hero (hero.id)}
          <span class="chip">
            <HeroAvatar {hero} size={16} />
            <span class="chip-name">{hero.hero_name}</span>
          </span>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .sheet {
    position: absolute;
    inset: 0;
    z-index: 45;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }

  .scrim {
    position: absolute;
    inset: 0;
    padding: 0;
    border: none;
    cursor: pointer;
    background: oklch(0% 0 0 / 0.38);
    animation: fade-in var(--duration-base) var(--ease-out);
  }

  .panel {
    position: relative;
    display: grid;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-xl) var(--space-2xl);
    max-block-size: 100%;
    overflow-y: auto;
    background: var(--color-bg);
    border-start-start-radius: var(--radius-lg);
    border-start-end-radius: var(--radius-lg);
    box-shadow: var(--shadow-toast);
    animation: sheet-up var(--duration-base) var(--ease-out);
  }

  .handle {
    justify-self: center;
    inline-size: 2.125rem;
    block-size: 4px;
    border-radius: var(--radius-full);
    background: var(--color-border-strong);
  }

  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-sm);
  }

  .kicker {
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    letter-spacing: 0.16em;
    color: var(--color-ink-faint);
  }

  .done {
    padding: 0;
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    font-weight: 700;
    letter-spacing: var(--tracking-mono);
    color: var(--color-accent);
  }

  .card {
    display: grid;
    gap: var(--space-xs);
    padding: var(--space-md);
    background: var(--color-panel);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
  }

  .item {
    display: flex;
    align-items: baseline;
    gap: var(--space-sm);
    margin: 0;
  }

  .dot {
    inline-size: 5px;
    block-size: 5px;
    flex-shrink: 0;
    border-radius: var(--radius-full);
    background: var(--color-accent);
  }

  .item-copy,
  .need {
    display: grid;
    gap: 1px;
    min-inline-size: 0;
    margin: 0;
  }

  .need {
    padding-inline-start: var(--space-sm);
    border-inline-start: 2px solid var(--color-neg);
  }

  .item-name,
  .need-name {
    font-size: var(--font-size-md);
    font-weight: 600;
  }

  .item-why,
  .need-why {
    max-inline-size: var(--measure);
    font-size: var(--font-size-sm);
    color: var(--color-ink-mute);
    text-wrap: pretty;
  }

  .partners {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2xs);
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2xs);
    padding: var(--space-3xs) var(--space-2xs);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-xs);
    white-space: nowrap;
  }

  .chip-name {
    font-size: var(--font-size-sm);
    font-weight: 500;
  }
</style>
