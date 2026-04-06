import { describe, it, expect } from 'vitest'
import { getJunglers, recommendBoots, calculateJunglerRecommendation } from '../heroUtils'
import type { Hero, BootType, RetributionBlessing, BootRecommendation, RecommendationResult } from '../../types/hero'

function makeHero(overrides: Partial<Hero> = {}): Hero {
  return {
    id: 1,
    hero_name: 'TestHero',
    channel_id: 1,
    img_src: '',
    role: ['Fighter'],
    lane: ['Jungle'],
    speciality: [],
    tier: 'A',
    previous_tier: 'A',
    score: 50,
    statistics: [{
      hero_id: 1,
      pick_rate: 2,
      win_rate: 50,
      ban_rate: 5,
      rank_name: 'Mythic',
      rank_id: 7,
      timeframe_name: 'Past 7 days',
      timeframe_id: 1,
      created_at: '2026-01-01',
    }],
    ...overrides,
  }
}

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

describe('recommendBoots - boot selection', () => {
  it('mage hero gets Arcane Boots', () => {
    const mage = makeHero({ role: ['Mage'], speciality: ['Burst'] })
    const result = recommendBoots(mage, [])
    expect(result.boots).toBe('Arcane Boots')
    expect(result.bootsReason).toBe('Magic penetration')
  })

  it('hero with Magic Damage speciality gets Arcane Boots', () => {
    const hero = makeHero({ role: ['Fighter'], speciality: ['Magic Damage'] })
    const result = recommendBoots(hero, [])
    expect(result.boots).toBe('Arcane Boots')
  })

  it('high enemy CC gives Tough Boots (sum >= 4)', () => {
    const hero = makeHero()
    const ccEnemy = makeHero({
      id: 10,
      role: ['Tank'],
      speciality: ['Crowd Control', 'Initiator'],
      capabilities: { mobilityScore: 1, ccScore: 2, hasSustain: false, hasAOE: true, hasImmunity: false, maxBurstDamage: 100, avgCooldown: 8, skillsSummary: [] },
    })
    const ccEnemy2 = makeHero({
      id: 11,
      role: ['Support'],
      speciality: ['Control'],
      capabilities: { mobilityScore: 0, ccScore: 2, hasSustain: false, hasAOE: false, hasImmunity: false, maxBurstDamage: 50, avgCooldown: 10, skillsSummary: [] },
    })
    const result = recommendBoots(hero, [ccEnemy, ccEnemy2])
    expect(result.boots).toBe('Tough Boots')
    expect(result.bootsReason).toBe('High enemy CC')
  })

  it('high enemy CC gives Tough Boots (>= 3 CC heroes)', () => {
    const hero = makeHero()
    const makeCC = (id: number) => makeHero({
      id,
      speciality: ['Crowd Control'],
      capabilities: { mobilityScore: 1, ccScore: 1, hasSustain: false, hasAOE: false, hasImmunity: false, maxBurstDamage: 100, avgCooldown: 8, skillsSummary: [] },
    })
    const result = recommendBoots(hero, [makeCC(10), makeCC(11), makeCC(12)])
    expect(result.boots).toBe('Tough Boots')
  })

  it('enemy phys-heavy gives Warrior Boots', () => {
    const hero = makeHero()
    const physEnemy = (id: number) => makeHero({ id, role: ['Marksman'], speciality: ['Damage'] })
    const result = recommendBoots(hero, [physEnemy(10), physEnemy(11), physEnemy(12)])
    expect(result.boots).toBe('Warrior Boots')
    expect(result.bootsReason).toBe('Enemy phys. heavy')
  })

  it('marksman hero gets Swift Boots', () => {
    const mm = makeHero({ role: ['Marksman'], speciality: ['Damage'] })
    const result = recommendBoots(mm, [])
    expect(result.boots).toBe('Swift Boots')
    expect(result.bootsReason).toBe('Attack speed scaling')
  })

  it('fighter with Push speciality gets Swift Boots', () => {
    const fighter = makeHero({ role: ['Fighter'], speciality: ['Push'] })
    const result = recommendBoots(fighter, [])
    expect(result.boots).toBe('Swift Boots')
  })

  it('fighter with Damage speciality gets Swift Boots', () => {
    const fighter = makeHero({ role: ['Fighter'], speciality: ['Damage'] })
    const result = recommendBoots(fighter, [])
    expect(result.boots).toBe('Swift Boots')
  })

  it('default case gives Magic Shoes', () => {
    const hero = makeHero({ role: ['Assassin'], speciality: ['Chase'] })
    const result = recommendBoots(hero, [])
    expect(result.boots).toBe('Magic Shoes')
    expect(result.bootsReason).toBe('Cooldown reduction')
  })

  it('Tough Boots priority overrides mage hero Arcane Boots', () => {
    const mage = makeHero({ role: ['Mage'] })
    const ccEnemy = makeHero({
      id: 10,
      capabilities: { mobilityScore: 1, ccScore: 3, hasSustain: false, hasAOE: true, hasImmunity: false, maxBurstDamage: 100, avgCooldown: 8, skillsSummary: [] },
    })
    const ccEnemy2 = makeHero({
      id: 11,
      capabilities: { mobilityScore: 0, ccScore: 2, hasSustain: false, hasAOE: false, hasImmunity: false, maxBurstDamage: 50, avgCooldown: 10, skillsSummary: [] },
    })
    const result = recommendBoots(mage, [ccEnemy, ccEnemy2])
    expect(result.boots).toBe('Tough Boots')
  })

  it('Warrior Boots priority overrides marksman hero Swift Boots', () => {
    const mm = makeHero({ role: ['Marksman'] })
    const physEnemy = (id: number) => makeHero({ id, role: ['Fighter'], speciality: ['Damage'] })
    const result = recommendBoots(mm, [physEnemy(10), physEnemy(11), physEnemy(12)])
    expect(result.boots).toBe('Warrior Boots')
  })
})

describe('recommendBoots - blessing selection', () => {
  it('tank hero gets Bloody', () => {
    const tank = makeHero({ role: ['Tank', 'Fighter'], speciality: ['Initiator'] })
    const result = recommendBoots(tank, [])
    expect(result.blessing).toBe('Bloody')
    expect(result.blessingReason).toBe('HP sustain in fights')
  })

  it('utility hero with sustain gets Bloody', () => {
    const hero = makeHero({
      role: ['Fighter'],
      speciality: ['Guard', 'Regen'],
      capabilities: { mobilityScore: 1, ccScore: 1, hasSustain: true, hasAOE: false, hasImmunity: false, maxBurstDamage: 100, avgCooldown: 8, skillsSummary: [] },
    })
    const result = recommendBoots(hero, [])
    expect(result.blessing).toBe('Bloody')
  })

  it('burst hero gets Flame (high maxBurstDamage)', () => {
    const hero = makeHero({
      role: ['Assassin'],
      speciality: ['Chase'],
      capabilities: { mobilityScore: 3, ccScore: 0, hasSustain: false, hasAOE: false, hasImmunity: false, maxBurstDamage: 500, avgCooldown: 6, skillsSummary: [] },
    })
    const result = recommendBoots(hero, [])
    expect(result.blessing).toBe('Flame')
    expect(result.blessingReason).toBe('Burst stat steal')
  })

  it('burst hero gets Flame (Burst speciality)', () => {
    const hero = makeHero({ role: ['Assassin'], speciality: ['Burst'] })
    const result = recommendBoots(hero, [])
    expect(result.blessing).toBe('Flame')
  })

  it('burst hero gets Flame (Finisher speciality)', () => {
    const hero = makeHero({ role: ['Marksman'], speciality: ['Finisher'] })
    const result = recommendBoots(hero, [])
    expect(result.blessing).toBe('Flame')
  })

  it('default gives Ice', () => {
    const hero = makeHero({ role: ['Fighter'], speciality: ['Chase'] })
    const result = recommendBoots(hero, [])
    expect(result.blessing).toBe('Ice')
    expect(result.blessingReason).toBe('Chase & escape')
  })
})

describe('recommendBoots - edge cases', () => {
  it('empty enemy team returns valid recommendation', () => {
    const hero = makeHero()
    const result = recommendBoots(hero, [])
    expect(result.boots).toBeDefined()
    expect(result.bootsReason).toBeDefined()
    expect(result.blessing).toBeDefined()
    expect(result.blessingReason).toBeDefined()
  })

  it('empty enemy team defaults to hero-based boot (not CC/phys)', () => {
    const assassin = makeHero({ role: ['Assassin'], speciality: ['Chase'] })
    const result = recommendBoots(assassin, [])
    expect(result.boots).toBe('Magic Shoes')
  })
})

describe('calculateJunglerRecommendation - boot integration', () => {
  it('attaches bootRecommendation to result', () => {
    const hero = makeHero({ role: ['Mage'], lane: ['Jungle'], speciality: ['Burst'] })
    const enemy = makeHero({ id: 10 })
    const result = calculateJunglerRecommendation(hero, [], [enemy])
    expect(result.bootRecommendation).toBeDefined()
    expect(result.bootRecommendation!.boots).toBe('Arcane Boots')
    expect(result.bootRecommendation!.blessing).toBe('Flame')
  })
})
