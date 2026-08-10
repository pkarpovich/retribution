import { describe, it, expect } from 'vitest'
import heroData from '../../data/heroes.json'
// @ts-expect-error - plain JS module, no types, and not worth a .d.ts for one function
import { validateHeroes } from '../../../scripts/lib/validate-heroes.js'

type Hero = Record<string, unknown>
const roster = () => JSON.parse(JSON.stringify(heroData.heroes)) as Hero[]
const errors = (heroes: Hero[]) => (validateHeroes(heroes) as { errors: string[] }).errors

// Every case below is a way a parser can fail while still producing a file that
// looks fine. None of them is about the meta being unusual.
describe('hero data validation', () => {
  it('passes a healthy roster', () => {
    expect(errors(roster())).toEqual([])
  })

  it('catches a truncated roster', () => {
    expect(errors(roster().slice(0, 40)).join()).toMatch(/roster collapsed/)
  })

  it('catches duplicate ids', () => {
    const heroes = roster()
    heroes[1].id = heroes[0].id
    expect(errors(heroes).join()).toMatch(/duplicate hero ids/)
  })

  it('catches a field the API stopped returning', () => {
    const heroes = roster().map(hero => ({ ...hero, score: undefined }))
    expect(errors(heroes).join()).toMatch(/missing "score"/)
  })

  it('catches relations coming back empty', () => {
    const heroes = roster().map(hero => ({ ...hero, counters: [] }))
    expect(errors(heroes).join()).toMatch(/only 0\.0% of heroes have "counters"/)
  })

  it('catches a broken join, where relations point at heroes that do not exist', () => {
    const heroes = roster()
    ;(heroes[0].counters as { id: number }[])[0].id = 99999
    expect(errors(heroes).join()).toMatch(/point at unknown heroes/)
  })

  it('catches statistics that did not parse', () => {
    const heroes = roster().map(hero => ({ ...hero, statistics: [] }))
    expect(errors(heroes).join()).toMatch(/no statistics rows/)
  })

  it('catches the rank and timeframe the engine reads disappearing', () => {
    const heroes = roster().map(hero => ({
      ...hero,
      statistics: (hero.statistics as { timeframe_name: string }[]).map(row => ({
        ...row,
        timeframe_name: 'Past 400 days',
      })),
    }))
    expect(errors(heroes).join()).toMatch(/have no "Mythic \/ Past 7 days" row/)
  })

  it('catches a win rate that arrived as a string', () => {
    const heroes = roster()
    ;(heroes[0].statistics as { win_rate: unknown }[])[0].win_rate = '52.4'
    expect(errors(heroes).join()).toMatch(/unparsable win_rate/)
  })

  it('catches lane parsing losing the jungle tag', () => {
    const heroes = roster().map(hero => ({
      ...hero,
      lane: (hero.lane as string[]).filter(lane => lane !== 'Jungle'),
    }))
    expect(errors(heroes).join()).toMatch(/tagged Jungle/)
  })

  it('says nothing about the meta being unusual', () => {
    // Every hero SS tier, every win rate 99, scores inverted. Absurd as a game
    // state, structurally perfect. The validator must not care.
    const heroes = roster().map(hero => ({
      ...hero,
      tier: 'SS',
      score: 1100 - (hero.score as number),
      statistics: (hero.statistics as { win_rate: number }[]).map(row => ({ ...row, win_rate: 99 })),
    }))
    expect(errors(heroes)).toEqual([])
  })
})
