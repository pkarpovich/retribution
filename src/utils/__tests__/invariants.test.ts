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

  it('team balance stays silent until allies are known, then grows with them', () => {
    const enemy = makeHero()
    const ally = () => makeHero({ role: ['Tank'] })
    const hero = makeHero({ role: ['Assassin'] })

    const balanceWith = (allies: Hero[]) =>
      calculateJunglerRecommendation(hero, allies, [enemy], 'Mythic').breakdown.team_balance

    expect(balanceWith([])).toBe(0)
    expect(Math.abs(balanceWith([ally(), ally()])))
      .toBeLessThan(Math.abs(balanceWith([ally(), ally(), ally(), ally()])))
  })

  it('the meta bonus has no cliff', () => {
    const enemy = makeHero()
    const banned = (rate: number) => makeHero({
      statistics: [{ ...makeHero().statistics[0], ban_rate: rate }],
    })

    const below = scoreOf(banned(29.9), [enemy])
    const above = scoreOf(banned(30.1), [enemy])
    const high = scoreOf(banned(50), [enemy])

    expect(above - below).toBeLessThan(1)
    expect(high).toBeGreaterThan(above)
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

describe('counter threat', () => {
  const pool = getJunglers(heroData.heroes as unknown as Hero[])

  const evaluate = (hero: Hero, enemies: Hero[], matchBans: Hero[] = []) =>
    calculateJunglerRecommendation(hero, [], enemies, 'Mythic', { matchBans })

  const filler = (count: number) => Array.from({ length: count }, () => makeHero())

  it('is switched off once the enemy has no picks left', () => {
    const bully = makeHero()
    const hero = makeHero({ counters: [relation(bully, 9)] })

    expect(evaluate(hero, filler(5)).breakdown.counter_threat).toBe(0)
    expect(evaluate(hero, filler(4)).breakdown.counter_threat).toBeLessThan(0)
  })

  it('costs more the heavier the counter still on the board', () => {
    const bully = makeHero()
    const enemies = filler(3)
    const light = makeHero({ counters: [relation(bully, 1)] })
    const heavy = makeHero({ counters: [relation(bully, 9)] })

    expect(evaluate(heavy, enemies).total_score).toBeLessThan(evaluate(light, enemies).total_score)
  })

  it('stops charging for a counter the match has banned', () => {
    const bully = makeHero()
    const hero = makeHero({ counters: [relation(bully, 9)] })
    const enemies = filler(3)

    const open = evaluate(hero, enemies)
    const banned = evaluate(hero, enemies, [bully])

    expect(banned.breakdown.counter_threat).toBe(0)
    expect(banned.total_score).toBeGreaterThan(open.total_score)
  })

  it('ignores a match ban that was never a threat to this hero', () => {
    const bully = makeHero()
    const stranger = makeHero()
    const hero = makeHero({ counters: [relation(bully, 9)] })
    const enemies = filler(3)

    expect(evaluate(hero, enemies, [stranger]).total_score)
      .toBe(evaluate(hero, enemies).total_score)
  })

  it('does not charge twice for a counter already on the enemy team', () => {
    const bully = makeHero()
    const hero = makeHero({ counters: [relation(bully, 9)] })
    const breakdown = evaluate(hero, [bully, ...filler(3)]).breakdown

    expect(breakdown.counter_penalty).toBeLessThan(0)
    expect(breakdown.counter_threat).toBe(0)
  })

  // counter_threat only moves a score when a banned hero actually counters a
  // candidate, so the shelved set is chosen by relationship. Picking it by
  // position - pool.slice(10, 14) - asserted nothing on a roster ordered by
  // score: it passed while those four happened to counter someone and went
  // quietly vacant the week the meta reshuffled them out.
  const enemies = pool.slice(0, 3)
  const enemyIds = new Set(enemies.map(hero => hero.id))

  const baseline = recommendJunglers(pool, [], enemies, [], 'Mythic')
  const roster = new Map((heroData.heroes as unknown as Hero[]).map(hero => [hero.id, hero]))

  // Anchored to a hero the engine actually returns, and the whole counter list
  // goes on the board rather than a slice of it. Two earlier versions of this
  // test asserted nothing: one banned heroes chosen by list position, the other
  // banned counters that were never among the top two the term actually reads.
  const { anchor, threats } = (() => {
    for (const result of baseline) {
      const live = (result.hero.counters ?? [])
        .map(relation => roster.get(relation.id))
        .filter((hero): hero is Hero => hero !== undefined)
        .filter(hero => !enemyIds.has(hero.id) && hero.id !== result.hero.id)
      if (live.length > 0) return { anchor: result.hero, threats: live }
    }
    return { anchor: null as Hero | null, threats: [] as Hero[] }
  })()

  // Junglers only, so that personal-banning them actually removes candidates.
  const shelved = pool.filter(hero => !enemyIds.has(hero.id)).slice(0, 4)

  it('finds a suggested hero whose counters are still on the board', () => {
    expect(anchor).not.toBeNull()
    expect(threats.length).toBeGreaterThan(0)
    expect(shelved.length).toBeGreaterThan(0)
  })

  // Refusing to play a hero says nothing about what the other team can pick.
  // Only a match ban takes it off the board for both sides.
  it('leaves every score alone when heroes are only on the personal ban list', () => {
    const scores = new Map(
      recommendJunglers(pool, [], enemies, [], 'Mythic').map(r => [r.hero.id, r.total_score])
    )

    const shared = recommendJunglers(pool, [], enemies, shelved, 'Mythic')
      .filter(result => scores.has(result.hero.id))

    expect(shared.length).toBeGreaterThan(0)
    for (const result of shared) {
      expect(result.total_score, result.hero.hero_name).toBe(scores.get(result.hero.id))
    }
  })

  it('drops the threat term to zero once every counter is off the board', () => {
    const before = baseline.find(result => result.hero.id === anchor!.id)!
    const after = recommendJunglers(pool, [], enemies, [], 'Mythic', threats)
      .find(result => result.hero.id === anchor!.id)

    expect(before.breakdown.counter_threat, anchor!.hero_name).toBeLessThan(0)
    expect(after, anchor!.hero_name).toBeDefined()
    expect(after!.breakdown.counter_threat).toBe(0)
    expect(after!.total_score).toBeGreaterThan(before.total_score)
  })
})

describe('comfort', () => {
  const evaluate = (hero: Hero, enemies: Hero[], signatures: number[] = []) =>
    calculateJunglerRecommendation(hero, [], enemies, 'Mythic', { signatures })

  it('lifts a hero the player is good on', () => {
    const hero = makeHero()
    const enemies = [makeHero(), makeHero()]

    expect(evaluate(hero, enemies, [hero.id]).total_score)
      .toBeGreaterThan(evaluate(hero, enemies).total_score)
  })

  // It sits outside the squash, so it must not touch the draft response: every
  // other component stays exactly where it was and the total moves by the flat
  // bonus alone.
  it('adds itself without disturbing anything the draft decided', () => {
    const hero = makeHero({ counters: [relation(makeHero(), 4)] })
    const enemies = [makeHero(), makeHero(), makeHero()]

    const plain = evaluate(hero, enemies)
    const mine = evaluate(hero, enemies, [hero.id])

    for (const key of Object.keys(plain.breakdown) as (keyof typeof plain.breakdown)[]) {
      if (key === 'comfort') continue
      expect(mine.breakdown[key], key).toBe(plain.breakdown[key])
    }

    expect(mine.breakdown.comfort).toBeGreaterThan(0)
    expect(mine.total_score - plain.total_score).toBeCloseTo(mine.breakdown.comfort, 10)
  })

  // A nudge, not a verdict: the list still belongs to the engine.
  it('cannot carry a bad hero past a good one', () => {
    const enemies = [makeHero(), makeHero()]
    const weak = makeHero({ tier: 'D' })
    const strong = makeHero({ tier: 'SS' })

    expect(evaluate(weak, enemies, [weak.id]).total_score)
      .toBeLessThan(evaluate(strong, enemies).total_score)
  })

  it('leaves every hero the player did not name alone', () => {
    const hero = makeHero()
    const other = makeHero()
    const enemies = [makeHero(), makeHero()]

    expect(evaluate(hero, enemies, [other.id]).total_score)
      .toBe(evaluate(hero, enemies).total_score)
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

  const bulky = () => makeHero({
    role: ['Tank'],
    capabilities: makeCapabilities({
      hasShield: true,
      damageReduction: true,
      statProfile: { durability: 0.95, regen: 0.5, attack: 0.3, speed: 0.3 },
    }),
  })
  const frail = () => makeHero({
    role: ['Marksman'],
    capabilities: makeCapabilities({ statProfile: { durability: 0.05, regen: 0.1, attack: 0.7, speed: 0.5 } }),
  })

  it('damage that ignores armour gains value against a durable enemy team', () => {
    const shredder = makeHero({ capabilities: makeCapabilities({ armorAgnostic: 2 }) })
    const plain = makeHero({ capabilities: makeCapabilities({ armorAgnostic: 0 }) })

    const durable = [bulky(), bulky(), bulky()]
    const squishy = [frail(), frail(), frail()]

    const gapVsDurable = scoreOf(shredder, durable) - scoreOf(plain, durable)
    const gapVsSquishy = scoreOf(shredder, squishy) - scoreOf(plain, squishy)

    expect(gapVsDurable).toBeGreaterThan(gapVsSquishy)
  })

  it('enemy immunity blunts the value of crowd control', () => {
    const locker = makeHero({ capabilities: makeCapabilities({ ccScore: 5 }) })
    const noControl = makeHero({ capabilities: makeCapabilities({ ccScore: 0 }) })

    const catchable = [evasive(), evasive(), evasive()]
    const slippery = Array.from({ length: 3 }, () => makeHero({
      role: ['Assassin'],
      capabilities: makeCapabilities({ mobilityScore: 5, hasImmunity: true }),
    }))

    const gapVsCatchable = scoreOf(locker, catchable) - scoreOf(noControl, catchable)
    const gapVsSlippery = scoreOf(locker, slippery) - scoreOf(noControl, slippery)

    expect(gapVsSlippery).toBeLessThan(gapVsCatchable)
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
