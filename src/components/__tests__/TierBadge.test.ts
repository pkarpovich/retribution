import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/svelte'
import TierBadge from '../TierBadge.svelte'
import type { HeroTier } from '../../types/hero'

const TIERS: HeroTier[] = ['SS', 'S', 'A', 'B', 'C', 'D']

describe('TierBadge', () => {
  it('reads out the tier and hands it to the stylesheet', () => {
    for (const tier of TIERS) {
      const { unmount } = render(TierBadge, { tier })
      expect(screen.getByText(tier).getAttribute('data-tier')).toBe(tier)
      unmount()
    }
  })
})
