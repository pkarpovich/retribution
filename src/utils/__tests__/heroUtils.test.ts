import { describe, it, expect } from 'vitest'
import { getJunglers, recommendBoots, calculateJunglerRecommendation } from '../heroUtils'
import type { Hero } from '../../types/hero'

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

  it('AOE fighter with Damage speciality gets Magic Shoes (ability-based)', () => {
    const fighter = makeHero({
      role: ['Fighter'],
      speciality: ['Damage'],
      capabilities: { mobilityScore: 1, ccScore: 1, hasSustain: false, hasAOE: true, hasImmunity: false, maxBurstDamage: 300, avgCooldown: 8, skillsSummary: [] },
    })
    const result = recommendBoots(fighter, [])
    expect(result.boots).toBe('Magic Shoes')
  })

  it('single-target fighter with Damage speciality gets Swift Boots (auto-attack based)', () => {
    const fighter = makeHero({
      role: ['Fighter'],
      speciality: ['Damage'],
      capabilities: { mobilityScore: 3, ccScore: 0, hasSustain: false, hasAOE: false, hasImmunity: false, maxBurstDamage: 300, avgCooldown: 24, skillsSummary: [] },
    })
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
    expect(result.bootRecommendation.boots).toBe('Arcane Boots')
    expect(result.bootRecommendation.blessing).toBe('Flame')
  })
})

describe('generateWarnings - WEAK_AGAINST from hero.counters', () => {
  const makeRelation = (id: number, name: string, score: number) => ({
    id,
    hero_name: name,
    img_src: '',
    role: ['Fighter' as const],
    lane: ['Jungle' as const],
    speciality: [],
    weighted_score: score,
    tier: 'A' as const,
  })

  it('produces WEAK_AGAINST warning when enemy is in hero.counters', () => {
    const enemyA = makeHero({ id: 10, hero_name: 'CounterHero' })
    const hero = makeHero({
      counters: [makeRelation(10, 'CounterHero', 3.5)],
      weakAgainst: [],
    })

    const result = calculateJunglerRecommendation(hero, [], [enemyA])
    const weakWarnings = result.warnings.filter(w => w.type === 'WEAK_AGAINST')
    expect(weakWarnings.length).toBeGreaterThan(0)
    expect(weakWarnings[0].hero).toBe('CounterHero')
  })

  it('does not produce WEAK_AGAINST warning when no counters in enemy team', () => {
    const enemy = makeHero({ id: 99, hero_name: 'Unrelated' })
    const hero = makeHero({
      counters: [makeRelation(10, 'CounterHero', 3.5)],
      weakAgainst: [],
    })

    const result = calculateJunglerRecommendation(hero, [], [enemy])
    const weakWarnings = result.warnings.filter(w => w.type === 'WEAK_AGAINST')
    expect(weakWarnings.length).toBe(0)
  })
})

describe('generateStrengths - Counters from hero.weakAgainst', () => {
  const makeRelation = (id: number, name: string, score: number) => ({
    id,
    hero_name: name,
    img_src: '',
    role: ['Fighter' as const],
    lane: ['Jungle' as const],
    speciality: [],
    weighted_score: score,
    tier: 'A' as const,
  })

  it('produces Counters strength when victim (weakAgainst) is on enemy team', () => {
    const enemyA = makeHero({ id: 10, hero_name: 'VictimHero' })
    const hero = makeHero({
      weakAgainst: [makeRelation(10, 'VictimHero', 4.0)],
      counters: [],
    })

    const result = calculateJunglerRecommendation(hero, [], [enemyA])
    const counterStrengths = result.strengths.filter(s => s.startsWith('Counters '))
    expect(counterStrengths.length).toBeGreaterThan(0)
    expect(counterStrengths[0]).toContain('VictimHero')
  })

  it('does not produce Counters strength when no victims in enemy team', () => {
    const enemy = makeHero({ id: 99, hero_name: 'Unrelated' })
    const hero = makeHero({
      weakAgainst: [makeRelation(10, 'VictimHero', 4.0)],
      counters: [],
    })

    const result = calculateJunglerRecommendation(hero, [], [enemy])
    const counterStrengths = result.strengths.filter(s => s.startsWith('Counters '))
    expect(counterStrengths.length).toBe(0)
  })
})

describe('calculateJunglerRecommendation - matchup scoring semantics', () => {
  const makeRelation = (id: number, name: string, score: number) => ({
    id,
    hero_name: name,
    img_src: '',
    role: ['Fighter' as const],
    lane: ['Jungle' as const],
    speciality: [],
    weighted_score: score,
    tier: 'A' as const,
  })

  it('gives strong_against bonus when victim (weakAgainst) is on enemy team', () => {
    const enemyA = makeHero({ id: 10, hero_name: 'VictimA' })
    const enemyB = makeHero({ id: 11, hero_name: 'CounterB' })
    const hero = makeHero({
      weakAgainst: [makeRelation(10, 'VictimA', 3.0)],
      counters: [makeRelation(11, 'CounterB', 3.0)],
    })

    const result = calculateJunglerRecommendation(hero, [], [enemyA, enemyB])
    expect(result.breakdown.strong_against).toBeGreaterThan(0)
    expect(result.breakdown.counter_penalty).toBeLessThan(0)
  })

  it('gives zero for both components when no matchup overlap with enemies', () => {
    const enemy = makeHero({ id: 99, hero_name: 'Unrelated' })
    const hero = makeHero({
      weakAgainst: [makeRelation(10, 'VictimA', 3.0)],
      counters: [makeRelation(11, 'CounterB', 3.0)],
    })

    const result = calculateJunglerRecommendation(hero, [], [enemy])
    expect(result.breakdown.strong_against).toBe(0)
    expect(result.breakdown.counter_penalty).toEqual(-0)
  })
})

describe('regression: Aamon-vs-counters scenario', () => {
  const makeRelation = (id: number, name: string, score: number) => ({
    id,
    hero_name: name,
    img_src: '',
    role: ['Fighter' as const],
    lane: ['Jungle' as const],
    speciality: [],
    weighted_score: score,
    tier: 'A' as const,
  })

  it('hero facing 3 real counters gets heavy penalty, not a strong pick', () => {
    const gloo = makeHero({ id: 20, hero_name: 'Gloo' })
    const atlas = makeHero({ id: 21, hero_name: 'Atlas' })
    const hayabusa = makeHero({ id: 22, hero_name: 'Hayabusa' })

    const aamon = makeHero({
      id: 50,
      hero_name: 'Aamon',
      role: ['Assassin'],
      lane: ['Jungle'],
      tier: 'B',
      counters: [
        makeRelation(20, 'Gloo', 3.0),
        makeRelation(21, 'Atlas', 2.8),
        makeRelation(22, 'Hayabusa', 3.2),
      ],
      weakAgainst: [],
    })

    const result = calculateJunglerRecommendation(aamon, [], [gloo, atlas, hayabusa])

    expect(result.breakdown.counter_penalty).toBeLessThan(0)
    expect(Math.abs(result.breakdown.counter_penalty)).toBeGreaterThan(30)
    expect(result.breakdown.strong_against).toBe(0)
    expect(result.recommendation_level).not.toBe('BEST_PICK')
    expect(result.recommendation_level).not.toBe('STRONG_PICK')

    const weakWarnings = result.warnings.filter(w => w.type === 'WEAK_AGAINST')
    expect(weakWarnings.length).toBeGreaterThanOrEqual(1)
    const warnedNames = weakWarnings.map(w => w.hero)
    expect(
      warnedNames.includes('Gloo') ||
      warnedNames.includes('Atlas') ||
      warnedNames.includes('Hayabusa')
    ).toBe(true)
  })

  it('hero facing victims gets bonus and Counters strength, no penalty', () => {
    const victim = makeHero({ id: 30, hero_name: 'Lolita' })

    const hero = makeHero({
      id: 51,
      hero_name: 'TestJungler',
      role: ['Assassin'],
      lane: ['Jungle'],
      tier: 'A',
      weakAgainst: [makeRelation(30, 'Lolita', 3.5)],
      counters: [],
    })

    const result = calculateJunglerRecommendation(hero, [], [victim])

    expect(result.breakdown.strong_against).toBeGreaterThan(0)
    expect(result.breakdown.counter_penalty).toEqual(-0)

    const counterStrengths = result.strengths.filter(s => s.startsWith('Counters '))
    expect(counterStrengths.length).toBeGreaterThan(0)
    expect(counterStrengths[0]).toContain('Lolita')
  })
})
