import { describe, it, expect } from 'vitest'
import heroData from '../../data/heroes.json'
import type { Hero } from '../../types/hero'
import { getJunglers, recommendJunglers } from '../heroUtils'
import { AXES, axisContributors, axisDeltas, heroAxes, matchupsFor, teamProfile, toSuggestions } from '../presentation'

const allHeroes = heroData.heroes as unknown as Hero[]
const junglers = getJunglers(allHeroes)
const byName = (name: string) => allHeroes.find(hero => hero.hero_name === name)!

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
