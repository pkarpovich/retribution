<script lang="ts">
  import type { Hero } from '../types/hero'
  import HeroAvatar from './HeroAvatar.svelte'
  import TierBadge from './TierBadge.svelte'

  interface Props {
    hero: Hero
    pick: Hero | null
    allySlots: number
    enemySlots: number
    onJungle: () => void
    onEnemy: () => void
    onAlly: () => void
    onBan: () => void
    onClose: () => void
  }

  const {
    hero,
    pick,
    allySlots,
    enemySlots,
    onJungle,
    onEnemy,
    onAlly,
    onBan,
    onClose,
  }: Props = $props()

  const slots = (left: number) => (left === 0 ? 'no slots left' : `${left} slot${left === 1 ? '' : 's'} open`)

  const destinations = $derived([
    {
      key: 'jungle',
      lead: 'JG',
      label: 'Your jungle pick',
      sub: pick ? `takes over from ${pick.hero_name}` : 'fills the jungle slot',
      tone: 'accent',
      full: false,
      act: onJungle,
    },
    {
      key: 'enemy',
      lead: 'E',
      label: 'Add as enemy',
      sub: slots(enemySlots),
      tone: 'neg',
      full: enemySlots === 0,
      act: onEnemy,
    },
    {
      key: 'ally',
      lead: 'A',
      label: 'Add as ally',
      sub: slots(allySlots),
      tone: 'pos',
      full: allySlots === 0,
      act: onAlly,
    },
    {
      key: 'ban',
      lead: '×',
      label: 'Ban this match',
      sub: 'nobody can pick it',
      tone: 'muted',
      full: false,
      act: onBan,
    },
  ])

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') onClose()
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="sheet" role="dialog" aria-modal="true" aria-label="Where does {hero.hero_name} go?">
  <button class="scrim" onclick={onClose} aria-label="Choose no destination"></button>

  <div class="panel">
    <span class="handle" aria-hidden="true"></span>

    <div class="who">
      <HeroAvatar {hero} size={34} />
      <span class="copy">
        <span class="name-line">
          <span class="serif">{hero.hero_name}</span>
          <TierBadge tier={hero.tier} />
        </span>
        <span class="kicker">{hero.role.join('/')}</span>
      </span>
      <button class="done" onclick={onClose}>CANCEL</button>
    </div>

    <div class="routes">
      {#each destinations as destination (destination.key)}
        <button
          class="route"
          data-tone={destination.tone}
          disabled={destination.full}
          onclick={destination.act}
        >
          <span class="lead" aria-hidden="true">{destination.lead}</span>
          <span class="route-copy">
            <span class="route-label">{destination.label}</span>
            <span class="route-sub">{destination.sub}</span>
          </span>
          <span class="chevron" aria-hidden="true">›</span>
        </button>
      {/each}
    </div>
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

  .who {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .copy {
    flex: 1;
    min-inline-size: 0;
    display: grid;
    gap: var(--space-3xs);
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

  .kicker {
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--color-ink-faint);
  }

  .done {
    flex-shrink: 0;
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

  .routes {
    display: grid;
    gap: var(--space-2xs);
  }

  .route {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    background: var(--color-panel);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    cursor: pointer;
    text-align: start;
    --tone: var(--color-ink-mute);

    &[data-tone='accent'] {
      --tone: var(--color-accent);
      border-color: var(--color-accent);
      background: var(--color-accent-soft);
    }

    &[data-tone='neg'] {
      --tone: var(--color-neg);
    }

    &[data-tone='pos'] {
      --tone: var(--color-pos);
    }

    &:disabled {
      cursor: default;
      opacity: 0.45;
    }
  }

  .lead {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    inline-size: 1.375rem;
    block-size: 1.375rem;
    border: 1px solid color-mix(in oklch, var(--tone) 40%, transparent);
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    font-weight: 700;
    color: var(--tone);
  }

  .route-copy {
    flex: 1;
    min-inline-size: 0;
    display: grid;
    gap: 1px;
  }

  .route-label {
    font-size: var(--font-size-md);
    font-weight: 600;
  }

  .route-sub {
    font-size: var(--font-size-sm);
    color: var(--color-ink-mute);
  }

  .chevron {
    flex-shrink: 0;
    font-family: var(--font-mono);
    color: var(--color-ink-faint);
  }
</style>
