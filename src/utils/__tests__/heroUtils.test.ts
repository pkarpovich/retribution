import { describe, it, expect } from 'vitest'
import { getJunglers } from '../heroUtils'
import type { BootType, RetributionBlessing, BootRecommendation, RecommendationResult } from '../../types/hero'

describe('heroUtils', () => {
  it('returns empty array when no heroes have Jungle lane', () => {
    expect(getJunglers([])).toEqual([])
  })
})

describe('BootRecommendation types', () => {
  it('allows constructing a valid BootRecommendation', () => {
    const rec: BootRecommendation = {
      boots: 'Tough Boots',
      bootsReason: 'High enemy CC',
      blessing: 'Ice',
      blessingReason: 'Chase & escape',
    }
    expect(rec.boots).toBe('Tough Boots')
    expect(rec.blessing).toBe('Ice')
  })

  it('allows all BootType values', () => {
    const boots: BootType[] = ['Tough Boots', 'Warrior Boots', 'Arcane Boots', 'Swift Boots', 'Magic Shoes', 'Rapid Boots']
    expect(boots).toHaveLength(6)
  })

  it('allows all RetributionBlessing values', () => {
    const blessings: RetributionBlessing[] = ['Ice', 'Flame', 'Bloody']
    expect(blessings).toHaveLength(3)
  })

  it('bootRecommendation is optional on RecommendationResult', () => {
    const partial = {} as Partial<RecommendationResult>
    expect(partial.bootRecommendation).toBeUndefined()
  })
})
