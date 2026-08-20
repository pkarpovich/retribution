<script lang="ts">
  import type { Hero } from '../types/hero'
  import HeroAvatar from './HeroAvatar.svelte'

  interface Props {
    allies: Hero[]
    enemies: Hero[]
    myPick: Hero | null
    onRemoveAlly: (hero: Hero) => void
    onRemoveEnemy: (hero: Hero) => void
    onClearPick: () => void
  }

  const { allies, enemies, myPick, onRemoveAlly, onRemoveEnemy, onClearPick }: Props = $props()

  const allySlots = $derived(Array.from({ length: 4 }, (_, i) => allies[i] ?? null))
  const enemySlots = $derived(Array.from({ length: 5 }, (_, i) => enemies[i] ?? null))
</script>

<div class="strip">
  <span class="rail ally" aria-hidden="true"></span>

  <div class="side">
    {#each allySlots as hero, i (i)}
      {#if hero}
        <button class="slot filled" onclick={() => onRemoveAlly(hero)} aria-label="Remove {hero.hero_name} from your team">
          <HeroAvatar {hero} size="var(--slot)" />
        </button>
      {:else}
        <span class="slot empty"></span>
      {/if}
    {/each}

    {#if myPick}
      <button class="slot filled jungle" onclick={onClearPick} aria-label="Clear your jungle pick">
        <HeroAvatar hero={myPick} size="var(--slot)" selected />
      </button>
    {:else}
      <span class="slot jungle-empty">JG</span>
    {/if}
  </div>

  <span class="versus">vs</span>

  <div class="side">
    {#each enemySlots as hero, i (i)}
      {#if hero}
        <button class="slot filled" onclick={() => onRemoveEnemy(hero)} aria-label="Remove {hero.hero_name} from the enemy team">
          <HeroAvatar {hero} size="var(--slot)" />
        </button>
      {:else}
        <span class="slot empty"></span>
      {/if}
    {/each}
  </div>

  <span class="rail enemy" aria-hidden="true"></span>
</div>

<style>
  .strip {
    --slot: clamp(1.25rem, 6.4cqi, 1.625rem);
    display: flex;
    min-inline-size: 0;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-sm) var(--space-lg);
    background: var(--color-panel);
    border-block-end: 1px solid var(--color-border);
  }

  .rail {
    inline-size: 3px;
    block-size: calc(var(--slot) + 0.125rem);
    border-radius: 2px;
    flex-shrink: 0;
  }

  .rail.ally {
    background: var(--color-pos);
  }

  .rail.enemy {
    background: var(--color-neg);
  }

  .side {
    display: flex;
    gap: var(--space-3xs);
  }

  .slot {
    inline-size: var(--slot);
    block-size: var(--slot);
    flex-shrink: 0;
    padding: 0;
    border: none;
    background: none;
  }

  .slot.filled {
    cursor: pointer;
  }

  .slot.empty {
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-sm);
  }

  .slot.jungle,
  .slot.jungle-empty {
    margin-inline-start: var(--space-3xs);
  }

  .jungle-empty {
    display: grid;
    place-items: center;
    border: 1.5px solid var(--color-accent);
    border-radius: var(--radius-sm);
    background: var(--color-accent-soft);
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    font-weight: 700;
    color: var(--color-accent);
  }

  .versus {
    flex: 1;
    text-align: center;
    font-family: var(--font-serif);
    font-style: italic;
    font-size: var(--font-size-md);
    color: var(--color-ink-faint);
  }
</style>
