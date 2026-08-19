import { describe, it, expect } from 'vitest'
import heroData from '../../data/heroes.json'
import {
  counterPenaltyRaw,
  counterSeverity,
  getDefaultWeights,
  getJunglers,
  liveCounterThreats,
  matchupIndex,
  recommendBoots,
  strongAgainstRaw,
  calculateJunglerRecommendation,
  recommendJunglers,
} from '../heroUtils'
import type { Hero, HeroCapabilities } from '../../types/hero'

const snapshotHeroes = heroData.heroes as unknown as Hero[]
const snapshotJunglers = getJunglers(snapshotHeroes)
const snapshotHero = (name: string) => snapshotHeroes.find(hero => hero.hero_name === name)!

function makeCapabilities(overrides: Partial<HeroCapabilities> = {}): HeroCapabilities {
  return {
    mobilityScore: 0,
    ccScore: 0,
    hasSustain: false,
    selfSustain: false,
    allySustain: false,
    antiHeal: false,
    hasAOE: false,
    hasImmunity: false,
    hasShield: false,
    armorAgnostic: 0,
    damageReduction: false,
    maxBurstDamage: 0,
    avgCooldown: null,
    baseStats: null,
    source: 'liquipedia',
    skillsSummary: [],
    ...overrides,
  }
}

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

function makeRelation(id: number, name: string, score: number) {
  return {
    id,
    hero_name: name,
    img_src: '',
    role: ['Fighter' as const],
    lane: ['Jungle' as const],
    speciality: [],
    weighted_score: score,
    tier: 'A' as const,
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
      capabilities: makeCapabilities({ mobilityScore: 1, ccScore: 2, hasSustain: false, hasAOE: true, hasImmunity: false, maxBurstDamage: 100, avgCooldown: 8, skillsSummary: [] }),
    })
    const ccEnemy2 = makeHero({
      id: 11,
      role: ['Support'],
      speciality: ['Control'],
      capabilities: makeCapabilities({ mobilityScore: 0, ccScore: 2, hasSustain: false, hasAOE: false, hasImmunity: false, maxBurstDamage: 50, avgCooldown: 10, skillsSummary: [] }),
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
      capabilities: makeCapabilities({ mobilityScore: 1, ccScore: 1, hasSustain: false, hasAOE: false, hasImmunity: false, maxBurstDamage: 100, avgCooldown: 8, skillsSummary: [] }),
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
      capabilities: makeCapabilities({ mobilityScore: 1, ccScore: 1, hasSustain: false, hasAOE: true, hasImmunity: false, maxBurstDamage: 300, avgCooldown: 8, skillsSummary: [] }),
    })
    const result = recommendBoots(fighter, [])
    expect(result.boots).toBe('Magic Shoes')
  })

  it('single-target fighter with Damage speciality gets Swift Boots (auto-attack based)', () => {
    const fighter = makeHero({
      role: ['Fighter'],
      speciality: ['Damage'],
      capabilities: makeCapabilities({ mobilityScore: 3, ccScore: 0, hasSustain: false, hasAOE: false, hasImmunity: false, maxBurstDamage: 300, avgCooldown: 24, skillsSummary: [] }),
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
      capabilities: makeCapabilities({ mobilityScore: 1, ccScore: 3, hasSustain: false, hasAOE: true, hasImmunity: false, maxBurstDamage: 100, avgCooldown: 8, skillsSummary: [] }),
    })
    const ccEnemy2 = makeHero({
      id: 11,
      capabilities: makeCapabilities({ mobilityScore: 0, ccScore: 2, hasSustain: false, hasAOE: false, hasImmunity: false, maxBurstDamage: 50, avgCooldown: 10, skillsSummary: [] }),
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
      capabilities: makeCapabilities({ mobilityScore: 1, ccScore: 1, hasSustain: true, hasAOE: false, hasImmunity: false, maxBurstDamage: 100, avgCooldown: 8, skillsSummary: [] }),
    })
    const result = recommendBoots(hero, [])
    expect(result.blessing).toBe('Bloody')
  })

  it('burst hero gets Flame (high maxBurstDamage)', () => {
    const hero = makeHero({
      role: ['Assassin'],
      speciality: ['Chase'],
      capabilities: makeCapabilities({ mobilityScore: 3, ccScore: 0, hasSustain: false, hasAOE: false, hasImmunity: false, maxBurstDamage: 500, avgCooldown: 6, skillsSummary: [] }),
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
    expect(result.breakdown.counter_penalty).toBe(0)
  })
})

describe('regression: Aamon-vs-counters scenario', () => {
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

    const untouched = makeHero({ id: 51, hero_name: 'Untouched', role: ['Assassin'], lane: ['Jungle'], tier: 'B' })
    const result = calculateJunglerRecommendation(aamon, [], [gloo, atlas, hayabusa])


    expect(result.breakdown.counter_penalty).toBeLessThan(0)
    expect(result.breakdown.strong_against).toBe(0)
    expect(result.total_score).toBeLessThan(calculateJunglerRecommendation(untouched, [], [gloo, atlas, hayabusa]).total_score)

    const ranked = recommendJunglers([aamon, untouched], [], [gloo, atlas, hayabusa], [], 'Mythic')
    expect(ranked[0].hero.hero_name).toBe('Untouched')
    expect(ranked[1].recommendation_level).not.toBe('BEST_PICK')

    const weakWarnings = result.warnings.filter(w => w.type === 'WEAK_AGAINST')
    expect(weakWarnings.length).toBe(3)
    const warnedNames = weakWarnings.map(w => w.hero)
    expect(warnedNames).toContain('Gloo')
    expect(warnedNames).toContain('Atlas')
    expect(warnedNames).toContain('Hayabusa')
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
    expect(result.breakdown.counter_penalty).toBe(0)

    const counterStrengths = result.strengths.filter(s => s.startsWith('Counters '))
    expect(counterStrengths.length).toBeGreaterThan(0)
    expect(counterStrengths[0]).toContain('Lolita')
  })
})

describe('counterSeverity', () => {
  const legend = getDefaultWeights('Legend')
  const glory = getDefaultWeights('Mythical Glory+')
  const mythic = getDefaultWeights('Mythic')

  it('grades a relation sitting exactly on a scaled threshold as the lower band', () => {
    expect(counterSeverity(2, legend)).toBe('LOW')
    expect(counterSeverity(5, legend)).toBe('MEDIUM')
    expect(counterSeverity(1, glory)).toBe('LOW')
    expect(counterSeverity(2.5, glory)).toBe('MEDIUM')
  })

  it('grades a relation above a scaled threshold as the higher band', () => {
    expect(counterSeverity(2.01, legend)).toBe('MEDIUM')
    expect(counterSeverity(5.01, legend)).toBe('HIGH')
    expect(counterSeverity(1.01, glory)).toBe('MEDIUM')
    expect(counterSeverity(2.51, glory)).toBe('HIGH')
  })

  it('applies the rank scale once, inside', () => {
    expect(counterSeverity(3.55, mythic)).toBe('HIGH')
    expect(counterSeverity(2.5, mythic)).toBe('MEDIUM')
    expect(counterSeverity(3.55, legend)).toBe('MEDIUM')
  })
})

describe('generateWarnings severity parity', () => {
  it('grades Sun against Faramis HIGH at Mythic', () => {
    const sun = snapshotHero('Sun')
    const faramis = snapshotHero('Faramis')
    const relation = sun.counters!.find(counter => counter.hero_name === 'Faramis')!

    expect(relation.weighted_score).toBeCloseTo(3.55, 10)

    const result = calculateJunglerRecommendation(sun, [], [faramis], 'Mythic')
    const warning = result.warnings.find(w => w.type === 'WEAK_AGAINST' && w.hero === 'Faramis')!

    expect(warning.severity).toBe('HIGH')
  })
})

describe('matchupIndex', () => {
  it('is exactly 0 for every jungler against a board with no priced relation to it', () => {
    for (const jungler of snapshotJunglers) {
      const priced = new Set([
        ...(jungler.counters ?? []).filter(r => r.weighted_score > 0).map(r => r.id),
        ...(jungler.weakAgainst ?? []).filter(r => r.weighted_score > 0).map(r => r.id),
      ])
      const board = snapshotHeroes.filter(hero => hero.id !== jungler.id && !priced.has(hero.id)).slice(0, 5)

      expect(board).toHaveLength(5)
      expect(matchupIndex(jungler, board), jungler.hero_name).toBe(0)
    }
  })

  it('rises on a priced victim, falls on a priced counter, and ignores an unrelated hero', () => {
    const sun = snapshotHero('Sun')
    const masha = snapshotHero('Masha')
    const natan = snapshotHero('Natan')
    const gord = snapshotHero('Gord')

    const empty = matchupIndex(sun, [])
    const neutral = matchupIndex(sun, [gord])
    const victim = matchupIndex(sun, [gord, masha])
    const counter = matchupIndex(sun, [gord, masha, natan])

    expect(empty).toBe(0)
    expect(neutral).toBe(0)
    expect(victim).toBeCloseTo(37.18, 2)
    expect(counter).toBeCloseTo(-30.82, 2)
    expect(matchupIndex(sun, [gord, masha, natan, snapshotHero('Miya')])).toBe(counter)
    expect(matchupIndex(sun, [gord, masha, natan, snapshotHero('Miya'), snapshotHero('Hanabi')])).toBe(counter)
  })

  it('leaves a zero-weight relation out of the number', () => {
    const ling = snapshotHero('Ling')
    const zeroWeight = ling.counters!.find(counter => counter.weighted_score === 0)!
    const masha = snapshotHeroes.find(hero => hero.id === zeroWeight.id)!

    expect(matchupIndex(ling, [masha])).toBe(matchupIndex(ling, []))
  })

  it('keeps moving past the point the engine cap would have clipped', () => {
    const sun = snapshotHero('Sun')
    const four = ['Natan', 'Aldous', 'Alucard', 'Ruby'].map(snapshotHero)
    const fourDeep = matchupIndex(sun, four)
    const fiveDeep = matchupIndex(sun, [...four, snapshotHero('Faramis')])

    expect(counterPenaltyRaw(sun, four, getDefaultWeights('Mythic'))).toBeGreaterThan(120)
    expect(fiveDeep).toBeLessThan(fourDeep)
  })
})

describe('liveCounterThreats', () => {
  const threatened = () => makeHero({
    id: 60,
    hero_name: 'Threatened',
    weakAgainst: [makeRelation(70, 'Victim', 4.0)],
    counters: [
      makeRelation(71, 'BullyA', 6.0),
      makeRelation(72, 'BullyB', 5.0),
      makeRelation(73, 'BullyC', 4.0),
      makeRelation(74, 'BullyD', 3.0),
    ],
  })

  it('reproduces the counter_threat the score charged', () => {
    const hero = threatened()
    const victim = makeHero({ id: 70, hero_name: 'Victim' })
    const weights = getDefaultWeights('Mythic')

    const threats = liveCounterThreats(hero, [], [victim], [])
    const exposure = threats.reduce((sum, threat) => sum + threat.exposure, 0)
    const expectedThreat = -Math.sqrt(exposure) * 15 * (weights.counter_penalty / 10)
    const expectedStrong = strongAgainstRaw(hero, [victim], weights)

    const { breakdown } = calculateJunglerRecommendation(hero, [], [victim], 'Mythic')

    expect(threats).toHaveLength(3)
    expect(breakdown.counter_threat / breakdown.strong_against).toBeCloseTo(expectedThreat / expectedStrong, 10)
  })

  it('returns the highest exposures first', () => {
    const threats = liveCounterThreats(threatened(), [], [], [])
    expect(threats.map(threat => threat.hero_name)).toEqual(['BullyA', 'BullyB', 'BullyC'])
  })

  it('returns nothing when the enemy has no open slots', () => {
    const enemies = [10, 11, 12, 13, 14].map(id => makeHero({ id }))
    expect(liveCounterThreats(threatened(), [], enemies, [])).toEqual([])
  })

  it('drops a counter that is already drafted or match banned', () => {
    const hero = threatened()
    const drafted = liveCounterThreats(hero, [makeHero({ id: 71, hero_name: 'BullyA' })], [], [])
    const enemyHeld = liveCounterThreats(hero, [], [makeHero({ id: 72, hero_name: 'BullyB' })], [])
    const banned = liveCounterThreats(hero, [], [], [makeHero({ id: 73, hero_name: 'BullyC' })])

    expect(drafted.map(threat => threat.hero_name)).not.toContain('BullyA')
    expect(enemyHeld.map(threat => threat.hero_name)).not.toContain('BullyB')
    expect(banned.map(threat => threat.hero_name)).not.toContain('BullyC')
  })

  it('drops a counter the data does not price, keeping the score a number', () => {
    const hero = makeHero({
      id: 61,
      hero_name: 'Unpriced',
      counters: [makeRelation(75, 'BullyE', -3.0), makeRelation(76, 'BullyF', 0)],
    })

    expect(liveCounterThreats(hero, [], [], [])).toEqual([])
    expect(calculateJunglerRecommendation(hero, [], [], 'Mythic').total_score).not.toBeNaN()
  })

  it('keeps a counter the player has personally banned, since that does not stop the enemy taking it', () => {
    const hero = threatened()
    const bully = makeHero({ id: 71, hero_name: 'BullyA', lane: ['Jungle'] })

    const enemies = [makeHero({ id: 90, hero_name: 'Neutral' })]

    const open = recommendJunglers([hero, bully], [], enemies, [], 'Mythic')
    const banned = recommendJunglers([hero, bully], [], enemies, [bully], 'Mythic')

    const before = open.find(result => result.hero.id === hero.id)!
    const after = banned.find(result => result.hero.id === hero.id)!

    expect(after.total_score).toBe(before.total_score)
    expect(liveCounterThreats(hero, [], [], []).map(threat => threat.hero_name)).toContain('BullyA')
  })
})

describe('engine matchup caps over uncapped raw bodies', () => {
  const enemy = () => makeHero({ id: 70, hero_name: 'Enemy', lane: ['Gold Lane'] })

  const total = (relation: 'counters' | 'weakAgainst', weight: number) =>
    calculateJunglerRecommendation(
      makeHero({ [relation]: [makeRelation(70, 'Enemy', weight)] }),
      [],
      [enemy()],
      'Mythic',
    ).total_score

  it('stops charging counter_penalty past 120', () => {
    const weights = getDefaultWeights('Mythic')
    const overCap = makeHero({ counters: [makeRelation(70, 'Enemy', 40)] })
    const wayOverCap = makeHero({ counters: [makeRelation(70, 'Enemy', 90)] })

    expect(counterPenaltyRaw(overCap, [enemy()], weights)).toBeGreaterThan(120)
    expect(counterPenaltyRaw(wayOverCap, [enemy()], weights))
      .toBeGreaterThan(counterPenaltyRaw(overCap, [enemy()], weights))
    expect(total('counters', 90)).toBe(total('counters', 40))
  })

  it('stops paying strong_against past 120', () => {
    const weights = getDefaultWeights('Mythic')
    const overCap = makeHero({ weakAgainst: [makeRelation(70, 'Enemy', 150)] })
    const wayOverCap = makeHero({ weakAgainst: [makeRelation(70, 'Enemy', 400)] })

    expect(strongAgainstRaw(overCap, [enemy()], weights)).toBeGreaterThan(120)
    expect(strongAgainstRaw(wayOverCap, [enemy()], weights))
      .toBeGreaterThan(strongAgainstRaw(overCap, [enemy()], weights))
    expect(total('weakAgainst', 400)).toBe(total('weakAgainst', 150))
  })

  it('still moves below the cap, so the caps are not hiding a constant', () => {
    expect(total('counters', 4)).toBeGreaterThan(total('counters', 20))
    expect(total('weakAgainst', 20)).toBeGreaterThan(total('weakAgainst', 4))
  })
})

describe('negative relation weights', () => {
  const weights = getDefaultWeights('Mythic')
  const enemy = makeHero({ id: 70, hero_name: 'Enemy', lane: ['Gold Lane'] })
  const negative = (relation: 'counters' | 'weakAgainst') =>
    makeHero({ [relation]: [makeRelation(70, 'Enemy', -3)] })

  it('leaves a negative counters weight out of the penalty', () => {
    const hero = negative('counters')

    expect(counterPenaltyRaw(hero, [enemy], weights)).toBe(0)
    expect(matchupIndex(hero, [enemy])).toBe(0)
  })

  it('leaves a negative weakAgainst weight out of the bonus', () => {
    const hero = negative('weakAgainst')

    expect(strongAgainstRaw(hero, [enemy], weights)).toBe(0)
    expect(matchupIndex(hero, [enemy])).toBe(0)
  })

  it('keeps the recommendation finite and equal to a board without the hero', () => {
    for (const relation of ['counters', 'weakAgainst'] as const) {
      const scored = calculateJunglerRecommendation(negative(relation), [], [enemy], 'Mythic')
      const bare = calculateJunglerRecommendation(makeHero(), [], [enemy], 'Mythic')

      expect(Number.isFinite(scored.total_score)).toBe(true)
      expect(scored.total_score).toBe(bare.total_score)
    }
  })
})
