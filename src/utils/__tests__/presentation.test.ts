import { describe, it, expect } from 'vitest'
import heroData from '../../data/heroes.json'
import draftData from '../../data/pro-drafts.json'
import type { Hero } from '../../types/hero'
import { getJunglers, recommendJunglers } from '../heroUtils'
import type { PickBoard } from '../presentation'
import { AXES, axisContributors, axisDeltas, heroAxes, matchupsFor, pickReadout, teamNeeds, teamProfile, toSuggestions } from '../presentation'
import { makeRecord } from './matchFixtures'

const allHeroes = heroData.heroes as unknown as Hero[]
const junglers = getJunglers(allHeroes)
const byName = (name: string) => allHeroes.find(hero => hero.hero_name === name)!
const heroById = new Map(allHeroes.map(hero => [hero.id, hero]))

describe('hero axes', () => {
  it('keeps every axis inside 0..1 for the whole roster', () => {
    for (const hero of allHeroes) {
      const axes = heroAxes(hero)
      for (const axis of AXES) {
        expect(axes[axis.key], `${hero.hero_name}.${axis.key}`).toBeGreaterThanOrEqual(0)
        expect(axes[axis.key], `${hero.hero_name}.${axis.key}`).toBeLessThanOrEqual(1)
      }
    }
  })

  it('never calls the same hero both physical and magic', () => {
    for (const hero of allHeroes) {
      const axes = heroAxes(hero)
      expect(axes.phys + axes.magic, hero.hero_name).toBeLessThanOrEqual(1)
    }
  })

  it('separates a control tank from a mobile assassin', () => {
    const tank = heroAxes(byName('Khufra'))
    const assassin = heroAxes(byName('Gusion'))

    expect(tank.cc).toBeGreaterThan(assassin.cc)
    expect(heroAxes(byName('Ling')).mobility).toBeGreaterThan(heroAxes(byName('Tigreal')).mobility)
  })
})

describe('axis deltas', () => {
  it('is empty-safe and symmetric', () => {
    expect(teamProfile([])).toEqual({ phys: 0, magic: 0, burst: 0, cc: 0, sustain: 0, mobility: 0 })

    const allies = junglers.slice(0, 3)
    const enemies = junglers.slice(3, 6)
    const forward = axisDeltas(allies, enemies)
    const backward = axisDeltas(enemies, allies)

    for (const axis of AXES) {
      const a = forward.find(entry => entry.key === axis.key)!
      const b = backward.find(entry => entry.key === axis.key)!
      expect(a.delta).toBeCloseTo(-b.delta, 10)
    }
  })

  it('sorts by the size of the gap', () => {
    const deltas = axisDeltas(junglers.slice(0, 4), junglers.slice(4, 9))
    for (let i = 1; i < deltas.length; i++) {
      expect(Math.abs(deltas[i].delta)).toBeLessThanOrEqual(Math.abs(deltas[i - 1].delta))
    }
  })

  it('only credits contributors that actually carry the axis', () => {
    const contributors = axisContributors(junglers.slice(0, 6), 'cc', 3)
    expect(contributors.length).toBeLessThanOrEqual(3)
    for (const entry of contributors) expect(entry.value).toBeGreaterThan(0)
  })
})

describe('matchups', () => {
  it('only reports heroes present in the draft', () => {
    const hero = junglers.find(candidate => (candidate.counters?.length ?? 0) > 0)!
    const bully = allHeroes.find(candidate => candidate.id === hero.counters![0].id)!

    const withBully = matchupsFor(hero, [bully], [])
    expect(withBully.weak.map(enemy => enemy.id)).toContain(bully.id)

    const withoutBully = matchupsFor(hero, [], [])
    expect(withoutBully.weak).toEqual([])
    expect(withoutBully.strong).toEqual([])
    expect(withoutBully.synergy).toEqual([])
  })
})

describe('team needs', () => {
  const healers = allHeroes.filter(hero =>
    hero.capabilities?.selfSustain || hero.capabilities?.allySustain).slice(0, 5)

  it('has nothing to say before an enemy is revealed', () => {
    expect(teamNeeds(junglers.slice(0, 2), [])).toEqual([])
  })

  it('drops a need as soon as somebody on your side covers it', () => {
    const carrier = allHeroes.find(hero => hero.capabilities?.antiHeal)!
    const bare = allHeroes.find(hero => hero.capabilities && !hero.capabilities.antiHeal)!

    const keys = (allies: Hero[]) => teamNeeds(allies, healers).map(need => need.key)

    expect(keys([bare])).toContain('antiHeal')
    expect(keys([bare, carrier])).not.toContain('antiHeal')
  })

  it('puts the needs the engine actually pays for first', () => {
    const needs = teamNeeds(junglers.slice(0, 2), healers)
    const priced = needs.filter(need => need.points !== null)

    for (let i = 1; i < priced.length; i++) {
      expect(priced[i].points!).toBeLessThanOrEqual(priced[i - 1].points!)
    }
    expect(needs.slice(priced.length).every(need => need.points === null)).toBe(true)
  })

  // Advice that fires on every draft is not advice. Measured over the pro
  // corpus at two allies and three enemies revealed, the busiest need lands on
  // 58% of drafts and the median draft raises exactly one.
  it('never turns into something every draft is told', () => {
    const counts = new Map<string, number>()
    const raised: number[] = []

    for (const game of draftData.games) {
      for (const [side, team] of game.teams.entries()) {
        const allies = team.picks.slice(0, 2).map(pick => heroById.get(pick.id)!)
        const enemies = game.teams[1 - side].picks.slice(0, 3).map(pick => heroById.get(pick.id)!)
        const needs = teamNeeds(allies, enemies)

        raised.push(needs.length)
        for (const need of needs) counts.set(need.key, (counts.get(need.key) ?? 0) + 1)
      }
    }

    for (const [key, hits] of counts) {
      expect(hits / raised.length, key).toBeLessThan(0.7)
    }

    raised.sort((a, b) => a - b)
    expect(raised[Math.floor(raised.length / 2)]).toBeLessThanOrEqual(2)
  })
})

describe('suggestions', () => {
  const enemies = junglers.slice(0, 5)
  const results = recommendJunglers(junglers, [], enemies, [], 'Mythic')
  const suggestions = toSuggestions(results, enemies, [])

  it('scores the leader highest and stays inside the display range', () => {
    expect(suggestions[0].match).toBe(99)
    for (const suggestion of suggestions) {
      expect(suggestion.match).toBeGreaterThanOrEqual(40)
      expect(suggestion.match).toBeLessThanOrEqual(99)
    }
  })

  it('never ranks a later suggestion above an earlier one', () => {
    for (let i = 1; i < suggestions.length; i++) {
      expect(suggestions[i].match).toBeLessThanOrEqual(suggestions[i - 1].match)
    }
  })

  it('always gives a reason', () => {
    for (const suggestion of suggestions) {
      expect(suggestion.reasons.length).toBeGreaterThan(0)
    }
  })

  it('falls back to a blind-pick reason with no draft', () => {
    const blind = toSuggestions(recommendJunglers(junglers, [], junglers.slice(0, 1), [], 'Mythic'), [], [])
    expect(blind.every(suggestion => suggestion.reasons.length > 0)).toBe(true)
  })
})

describe('pick readout', () => {
  const sun = byName('Sun')
  const board = (over: Partial<PickBoard> = {}): PickBoard => ({
    myTeam: [sun],
    enemies: [],
    matchBans: [],
    roster: allHeroes,
    ...over,
  })
  const names = (heroes: Hero[]) => heroes.map(hero => hero.hero_name)

  it('names the counters, the victims and the allies it works with', () => {
    const readout = pickReadout(sun, board({
      myTeam: [sun, byName('Akai')],
      enemies: [byName('Natan'), byName('Masha')],
    }), null)

    expect(names(readout.taken.map(threat => threat.hero))).toEqual(['Natan'])
    expect(readout.taken[0].severity).toBe('HIGH')
    expect(names(readout.beaten)).toEqual(['Masha'])
    expect(names(readout.worksWith)).toEqual(['Akai'])
  })

  it('caps the live threats by the open slots and drops them at five enemies', () => {
    const four = [byName('Gord'), byName('Miya'), byName('Hanabi'), byName('Layla')]

    expect(pickReadout(sun, board({ enemies: [byName('Gord')] }), null).openSlots).toBe(4)
    expect(pickReadout(sun, board({ enemies: [byName('Gord')] }), null).live.length).toBe(3)
    expect(pickReadout(sun, board({ enemies: four }), null).live.length).toBe(1)

    const full = pickReadout(sun, board({ enemies: [...four, byName('Estes')] }), null)
    expect(full.live).toEqual([])
    expect(full.openSlots).toBe(0)
  })

  it('leaves the index bit-identical when an enemy with no priced relation appears', () => {
    const before = pickReadout(sun, board({ enemies: [byName('Masha'), byName('Natan')] }), null)
    const after = pickReadout(sun, board({
      enemies: [byName('Masha'), byName('Natan'), byName('Gord'), byName('Miya'), byName('Hanabi')],
    }), null)

    expect(after.index).toBe(before.index)
    expect(before.index).not.toBe(0)
  })

  it('drops a zero-weight relation from both the group and the number', () => {
    const ling = byName('Ling')
    expect(ling.counters!.find(relation => relation.hero_name === 'Masha')!.weighted_score).toBe(0)

    const readout = pickReadout(ling, { myTeam: [ling], enemies: [byName('Masha')], matchBans: [], roster: allHeroes }, null)

    expect(readout.taken).toEqual([])
    expect(readout.index).toBe(0)
  })

  it('moves for nothing but the enemy team', () => {
    const enemies = [byName('Natan')]
    const plain = pickReadout(sun, board({ enemies }), null)

    expect(pickReadout(sun, board({ enemies, myTeam: [sun, byName('Akai'), byName('X.Borg')] }), null).index).toBe(plain.index)
    expect(pickReadout(sun, board({ enemies, matchBans: [byName('Aldous'), byName('Masha')] }), null).index).toBe(plain.index)

    const tanky = pickReadout(sun, board({ enemies: [...enemies, byName('Tigreal'), byName('Gord')] }), null)
    expect(tanky.index).toBe(plain.index)
  })

  it('reports the movement since the recorded enemies', () => {
    const locked = makeRecord({
      pick: { id: sun.id, name: sun.hero_name, tier: sun.tier },
      enemies: [{ id: byName('Masha').id, name: 'Masha' }],
    })
    const atLock = pickReadout(sun, board({ enemies: [byName('Masha')] }), locked)
    expect(atLock.sinceLock).toBe(0)

    const later = pickReadout(sun, board({ enemies: [byName('Masha'), byName('Natan')] }), locked)
    expect(later.sinceLock).toBeCloseTo(later.index - atLock.index, 10)
    expect(later.sinceLock).toBeLessThan(0)

    const neutral = pickReadout(sun, board({ enemies: [byName('Masha'), byName('Gord')] }), locked)
    expect(neutral.sinceLock).toBe(0)
  })

  it('returns the delta to zero when an enemy is taken back off the board', () => {
    const locked = makeRecord({
      pick: { id: sun.id, name: sun.hero_name, tier: sun.tier },
      enemies: [{ id: byName('Masha').id, name: 'Masha' }, { id: byName('Natan').id, name: 'Natan' }],
    })

    expect(pickReadout(sun, board({ enemies: [byName('Masha'), byName('Natan')] }), locked).sinceLock).toBe(0)
    expect(pickReadout(sun, board({ enemies: [byName('Masha')] }), locked).sinceLock).toBeGreaterThan(0)
  })

  it('has no delta without a baseline for this pick', () => {
    const enemies = [byName('Natan')]
    expect(pickReadout(sun, board({ enemies }), null).sinceLock).toBeNull()

    const other = makeRecord({ pick: { id: byName('Ling').id, name: 'Ling', tier: byName('Ling').tier } })
    expect(pickReadout(sun, board({ enemies }), other).sinceLock).toBeNull()
  })

  it('reads zero on a board with nothing revealed', () => {
    const readout = pickReadout(sun, board(), null)

    expect(readout.index).toBe(0)
    expect(readout.taken).toEqual([])
    expect(readout.beaten).toEqual([])
  })
})
