import { describe, it, expect } from 'vitest'
import type { Hero, HeroCapabilities, HeroRelation, RecommendationLevel } from '../../types/hero'
import heroData from '../../data/heroes.json'
import { getJunglers, calculateJunglerRecommendation, recommendJunglers } from '../heroUtils'

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
    damageReduction: false,
    maxBurstDamage: 0,
    avgCooldown: null,
    baseStats: null,
    source: 'liquipedia',
    skillsSummary: [],
    ...overrides,
  }
}

let nextId = 1000

function makeHero(overrides: Partial<Hero> = {}): Hero {
  const id = overrides.id ?? nextId++
  return {
    id,
    hero_name: `Hero${id}`,
    channel_id: 1,
    img_src: '',
    role: ['Fighter'],
    lane: ['Jungle'],
    speciality: [],
    tier: 'B',
    previous_tier: 'B',
    score: 400,
    statistics: [{
      hero_id: id,
      pick_rate: 1,
      win_rate: 50,
      ban_rate: 1,
      rank_name: 'Mythic',
      rank_id: 7,
      timeframe_name: 'Past 7 days',
      timeframe_id: 1,
      created_at: '2026-01-01',
    }],
    capabilities: makeCapabilities(),
    ...overrides,
  }
}

function relation(target: Hero, weight: number): HeroRelation {
  return {
    id: target.id,
    hero_name: target.hero_name,
    img_src: '',
    role: target.role,
    lane: target.lane,
    speciality: [],
    weighted_score: weight,
    tier: target.tier,
  }
}

const scoreOf = (hero: Hero, enemies: Hero[], allies: Hero[] = []) =>
  calculateJunglerRecommendation(hero, allies, enemies, 'Mythic').total_score

describe('matchup monotonicity', () => {
  it('adding an enemy that counters the hero never raises its score', () => {
    const bully = makeHero()
    const neutral = makeHero()
    const hero = makeHero({ counters: [relation(bully, 4)], weakAgainst: [] })

    expect(scoreOf(hero, [neutral, bully])).toBeLessThan(scoreOf(hero, [neutral, neutral]))
  })

  it('adding an enemy the hero counters never lowers its score', () => {
    const victim = makeHero()
    const neutral = makeHero()
    const hero = makeHero({ counters: [], weakAgainst: [relation(victim, 4)] })

    expect(scoreOf(hero, [neutral, victim])).toBeGreaterThan(scoreOf(hero, [neutral, neutral]))
  })

  it('a counter matters more the heavier its weighted score', () => {
    const bully = makeHero()
    const light = makeHero({ counters: [relation(bully, 1)] })
    const heavy = makeHero({ counters: [relation(bully, 9)] })

    expect(scoreOf(heavy, [bully])).toBeLessThan(scoreOf(light, [bully]))
  })
})

describe('hero strength monotonicity', () => {
  it('a higher win rate ranks above an otherwise identical hero', () => {
    const enemy = makeHero()
    const weak = makeHero({ statistics: [{ ...makeHero().statistics[0], win_rate: 46 }] })
    const strong = makeHero({ statistics: [{ ...makeHero().statistics[0], win_rate: 56 }] })

    expect(scoreOf(strong, [enemy])).toBeGreaterThan(scoreOf(weak, [enemy]))
  })

  it('a higher tier ranks above an otherwise identical hero', () => {
    const enemy = makeHero()
    expect(scoreOf(makeHero({ tier: 'SS' }), [enemy]))
      .toBeGreaterThan(scoreOf(makeHero({ tier: 'D' }), [enemy]))
  })
})

describe('unknown information is not treated as evidence', () => {
  it('team components stay silent while no ally is known', () => {
    const enemy = makeHero()
    const breakdown = calculateJunglerRecommendation(makeHero(), [], [enemy], 'Mythic').breakdown

    expect(breakdown.synergy_bonus).toBe(0)
    expect(breakdown.cc_chain_synergy).toBe(0)
    expect(breakdown.damage_type_balance).toBe(0)
  })

  it('an enemy threshold cannot fire on a single revealed enemy', () => {
    const tank = makeHero({ role: ['Tank'] })
    const hero = makeHero({ role: ['Tank'] })

    const oneTank = calculateJunglerRecommendation(hero, [], [tank], 'Mythic').breakdown.enemy_analysis
    const twoTanks = calculateJunglerRecommendation(hero, [], [tank, makeHero({ role: ['Tank'] })], 'Mythic').breakdown.enemy_analysis

    expect(oneTank).toBeLessThanOrEqual(twoTanks)
  })

  it('revealing more enemies never flips a hero from unplayable to best without cause', () => {
    const enemy = makeHero()
    const hero = makeHero()
    const one = scoreOf(hero, [enemy])
    const five = scoreOf(hero, [enemy, makeHero(), makeHero(), makeHero(), makeHero()])

    expect(Math.abs(five - one)).toBeLessThan(150)
  })
})

describe('the draft adjusts a pick, it does not decide it', () => {
  const victims = (count: number) => Array.from({ length: count }, () => makeHero({
    role: ['Marksman'],
    capabilities: makeCapabilities({ mobilityScore: 0 }),
  }))

  it('a bottom tier hero cannot overtake a top tier one on matchups alone', () => {
    const enemies = victims(5)
    const favoured = makeHero({
      tier: 'D',
      role: ['Assassin'],
      capabilities: makeCapabilities({ ccScore: 6, antiHeal: true }),
      weakAgainst: enemies.map(enemy => relation(enemy, 9)),
    })
    const strong = makeHero({ tier: 'SS' })

    expect(scoreOf(favoured, enemies)).toBeLessThan(scoreOf(strong, enemies))
  })

  it('within one tier a favourable matchup does decide', () => {
    const victim = makeHero()
    const bully = makeHero()
    const enemies = [victim, bully]

    const counterPick = makeHero({ tier: 'B', weakAgainst: [relation(victim, 6)] })
    const countered = makeHero({ tier: 'B', counters: [relation(bully, 6)] })

    expect(scoreOf(counterPick, enemies)).toBeGreaterThan(scoreOf(countered, enemies))
  })

  it('situational terms never outweigh the empirical foundation', () => {
    const enemies = victims(5)
    const hero = makeHero({
      capabilities: makeCapabilities({ ccScore: 6, antiHeal: true }),
      weakAgainst: enemies.map(enemy => relation(enemy, 9)),
    })

    const breakdown = calculateJunglerRecommendation(hero, [], enemies, 'Mythic').breakdown
    const foundation = Math.abs(breakdown.base) + Math.abs(breakdown.meta_bonus)
    const situational = Math.abs(breakdown.team_balance) + Math.abs(breakdown.damage_type_balance)
      + Math.abs(breakdown.enemy_analysis) + Math.abs(breakdown.strong_against)
      + Math.abs(breakdown.cc_chain_synergy) + Math.abs(breakdown.invade_resistance)
      + Math.abs(breakdown.counter_penalty) + Math.abs(breakdown.synergy_bonus)
      + Math.abs(breakdown.early_late_game)

    expect(situational).toBeLessThan(foundation * 2)
  })
})

describe('recommendation labels stay meaningful', () => {
  const junglers = getJunglers(heroData.heroes as unknown as Hero[])
  const ORDER: RecommendationLevel[] = ['RISKY_PICK', 'SAFE_PICK', 'GOOD_PICK', 'STRONG_PICK', 'BEST_PICK']

  it('BEST_PICK stays a minority of what gets shown', () => {
    let best = 0
    let shown = 0

    for (let offset = 0; offset + 5 <= junglers.length; offset += 5) {
      const enemies = junglers.slice(offset, offset + 5)
      for (const result of recommendJunglers(junglers, [], enemies, [], 'Mythic')) {
        shown += 1
        if (result.recommendation_level === 'BEST_PICK') best += 1
      }
    }

    expect(best / shown).toBeLessThanOrEqual(0.35)
  })

  it('a lower ranked hero never carries a better label', () => {
    const enemies = junglers.slice(0, 5)
    const levels = recommendJunglers(junglers, [], enemies, [], 'Mythic')
      .map(result => ORDER.indexOf(result.recommendation_level))

    for (let i = 1; i < levels.length; i++) expect(levels[i]).toBeLessThanOrEqual(levels[i - 1])
  })
})

describe('banned and picked heroes never appear', () => {
  const junglers = getJunglers(heroData.heroes as unknown as Hero[])

  it('excludes banned, enemy and allied heroes', () => {
    const enemies = junglers.slice(0, 3)
    const allies = junglers.slice(3, 5)
    const banned = junglers.slice(5, 8)

    const results = recommendJunglers(junglers, allies, enemies, banned, 'Mythic')
    const excluded = new Set([...enemies, ...allies, ...banned].map(hero => hero.id))

    for (const result of results) expect(excluded.has(result.hero.id)).toBe(false)
  })
})

describe('capability counter-play', () => {
  const evasive = () => makeHero({
    role: ['Assassin'],
    capabilities: makeCapabilities({ mobilityScore: 5 }),
  })
  const sturdy = () => makeHero({ role: ['Fighter'], capabilities: makeCapabilities({ mobilityScore: 0 }) })

  it('crowd control gains value against a mobile enemy team', () => {
    const locker = makeHero({ capabilities: makeCapabilities({ ccScore: 5 }) })
    const noControl = makeHero({ capabilities: makeCapabilities({ ccScore: 0 }) })

    const mobile = [evasive(), evasive(), evasive()]
    const grounded = [sturdy(), sturdy(), sturdy()]

    const gapVsMobile = scoreOf(locker, mobile) - scoreOf(noControl, mobile)
    const gapVsGrounded = scoreOf(locker, grounded) - scoreOf(noControl, grounded)

    expect(gapVsMobile).toBeGreaterThan(gapVsGrounded)
  })

  it('anti-heal gains value against a sustaining enemy team', () => {
    const cutter = makeHero({ capabilities: makeCapabilities({ antiHeal: true }) })
    const plain = makeHero({ capabilities: makeCapabilities({ antiHeal: false }) })

    const healers = [
      makeHero({ capabilities: makeCapabilities({ selfSustain: true }) }),
      makeHero({ capabilities: makeCapabilities({ selfSustain: true }) }),
      makeHero({ capabilities: makeCapabilities({ allySustain: true }) }),
    ]
    const dry = [makeHero(), makeHero(), makeHero()]

    const gapVsHealers = scoreOf(cutter, healers) - scoreOf(plain, healers)
    const gapVsDry = scoreOf(cutter, dry) - scoreOf(plain, dry)

    expect(gapVsHealers).toBeGreaterThan(gapVsDry)
  })
})
