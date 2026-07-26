<script lang="ts">
  import type { Hero } from '../types/hero'

  interface Props {
    hero: Hero
    size?: number
    dimmed?: boolean
    selected?: boolean
    struck?: boolean
  }

  const { hero, size = 34, dimmed = false, selected = false, struck = false }: Props = $props()
</script>

<span
  class="avatar"
  class:dimmed
  class:selected
  style="--size: {size}px"
>
  <img src={hero.img_src} alt={hero.hero_name} loading="lazy" decoding="async" />
  {#if struck}
    <span class="strike" aria-hidden="true"></span>
  {/if}
</span>

<style>
  .avatar {
    position: relative;
    display: block;
    inline-size: var(--size);
    block-size: var(--size);
    flex-shrink: 0;
    border-radius: calc(var(--size) * 0.22);
    overflow: hidden;
    background: var(--color-accent-soft);
    box-shadow: inset 0 0 0 1px var(--color-border);
  }

  img {
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
    display: block;
  }

  .dimmed img {
    opacity: 0.35;
    filter: grayscale(1);
  }

  .selected {
    box-shadow: inset 0 0 0 1.5px var(--color-accent);
  }

  .strike {
    position: absolute;
    inset-block-start: 50%;
    inset-inline: -14%;
    block-size: 1.5px;
    background: var(--color-neg);
    border-radius: 1px;
    rotate: -45deg;
    box-shadow: 0 0 0 1px var(--color-panel);
  }
</style>
