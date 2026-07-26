import { describe, it, expect } from 'vitest'
import heroData from '../../data/heroes.json'
import liquipediaData from '../../data/liquipedia-heroes.json'
import expected from './fixtures/jungler-capabilities.json'
import type { Hero } from '../../types/hero'
import { getJunglers } from '../heroUtils'

const allHeroes = heroData.heroes as unknown as Hero[]
const junglers = getJunglers(allHeroes)

describe('hero data integrity', () => {
  it('every hero has capabilities', () => {
    const missing = allHeroes.filter(hero => !hero.capabilities).map(hero => hero.hero_name)
    expect(missing).toEqual([])
  })

  it('every hero has a Liquipedia entry with skills', () => {
    const sources = liquipediaData.heroes as Record<string, { skills: unknown[] } | undefined>
    const missing = allHeroes
      .filter(hero => !sources[hero.hero_name]?.skills?.length)
      .map(hero => hero.hero_name)
    expect(missing).toEqual([])
  })

  it('every hero has base stats and a stat profile', () => {
    const missing = allHeroes
      .filter(hero => !hero.capabilities?.baseStats?.hp || !hero.capabilities?.statProfile)
      .map(hero => hero.hero_name)
    expect(missing).toEqual([])
  })

  it('stat profile values stay within 0..1', () => {
    for (const hero of allHeroes) {
      const profile = hero.capabilities?.statProfile
      if (!profile) continue
      for (const [axis, value] of Object.entries(profile)) {
        expect(value, `${hero.hero_name}.${axis}`).toBeGreaterThanOrEqual(0)
        expect(value, `${hero.hero_name}.${axis}`).toBeLessThanOrEqual(1)
      }
    }
  })

  it('sustain flags stay consistent', () => {
    for (const hero of allHeroes) {
      const capabilities = hero.capabilities
      if (!capabilities) continue
      expect(capabilities.hasSustain, hero.hero_name)
        .toBe(capabilities.selfSustain || capabilities.allySustain)
    }
  })
})

describe('jungler capabilities golden set', () => {
  it('covers every jungler in the pool', () => {
    const names = junglers.map(hero => hero.hero_name).sort()
    expect(names).toEqual(Object.keys(expected).sort())
  })

  for (const [name, values] of Object.entries(expected)) {
    it(`${name} matches the reviewed capability profile`, () => {
      const hero = junglers.find(candidate => candidate.hero_name === name)
      expect(hero, `${name} missing from jungler pool`).toBeDefined()

      const capabilities = hero!.capabilities!
      expect({
        ccScore: capabilities.ccScore,
        mobilityScore: capabilities.mobilityScore,
        selfSustain: capabilities.selfSustain,
        allySustain: capabilities.allySustain,
        antiHeal: capabilities.antiHeal,
        hasImmunity: capabilities.hasImmunity,
        hasShield: capabilities.hasShield,
        armorAgnostic: capabilities.armorAgnostic,
        damageReduction: capabilities.damageReduction,
        hasAOE: capabilities.hasAOE,
      }).toEqual(values)
    })
  }
})
