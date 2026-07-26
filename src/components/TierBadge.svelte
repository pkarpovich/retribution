<script lang="ts">
  import type { HeroTier } from '../types/hero'

  const { tier }: { tier: HeroTier } = $props()
</script>

<span class="badge" data-tier={tier}>{tier}</span>

<style>
  .badge {
    display: inline-grid;
    place-items: center;
    min-inline-size: 1.25rem;
    padding: 1px var(--space-2xs);
    border-radius: var(--radius-xs);
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--color-on-accent);
    background: var(--tier-tone);
    --tier-tone: var(--color-ink-mute);

    &[data-tier='SS'] {
      --tier-tone: oklch(52% 0.19 25);
    }

    &[data-tier='S'] {
      --tier-tone: oklch(55% 0.16 45);
    }

    &[data-tier='A'] {
      --tier-tone: oklch(52% 0.14 90);
    }

    &[data-tier='B'] {
      --tier-tone: oklch(50% 0.11 160);
    }

    &[data-tier='C'] {
      --tier-tone: oklch(50% 0.09 230);
    }

    &[data-tier='D'] {
      --tier-tone: oklch(52% 0.02 280);
    }
  }
</style>
