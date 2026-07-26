import { describe, it, expect } from 'vitest'
import { CONFIDENT_AT, exportMatches, summarise, winRate } from '../matchStats'
import { makeRecord } from './matchFixtures'

const settled = (outcome: 'won' | 'lost', followedAdvice: boolean, pick = 10, name = 'Guinevere') =>
  makeRecord({ outcome, followedAdvice, pick: { id: pick, name, tier: 'S' } })

describe('win rate', () => {
  it('refuses to quote a percentage on a sample that cannot carry one', () => {
    expect(winRate({ won: 4, lost: 4 })).toBeNull()
    expect(winRate({ won: 0, lost: 0 })).toBeNull()
  })

  it('quotes one once there are enough games', () => {
    expect(winRate({ won: CONFIDENT_AT / 2, lost: CONFIDENT_AT / 2 })).toBe(50)
  })
})

describe('summary', () => {
  it('separates the games where the top pick was taken from the rest', () => {
    const summary = summarise([
      settled('won', true),
      settled('won', true),
      settled('lost', true),
      settled('lost', false),
      makeRecord({ outcome: 'pending' }),
    ])

    expect(summary.total).toBe(5)
    expect(summary.pending).toBe(1)
    expect(summary.settled).toEqual({ won: 2, lost: 2 })
    expect(summary.followed).toEqual({ won: 2, lost: 1 })
    expect(summary.overrode).toEqual({ won: 0, lost: 1 })
  })

  it('leaves unsettled games out of every tally', () => {
    const summary = summarise([makeRecord(), makeRecord(), makeRecord()])

    expect(summary.pending).toBe(3)
    expect(summary.settled).toEqual({ won: 0, lost: 0 })
    expect(summary.heroes).toEqual([])
  })

  it('ranks heroes by how often they were taken', () => {
    const summary = summarise([
      settled('won', true, 1, 'Ling'),
      settled('lost', true, 1, 'Ling'),
      settled('won', true, 2, 'Baxia'),
    ])

    expect(summary.heroes.map(entry => entry.hero.name)).toEqual(['Ling', 'Baxia'])
    expect(summary.heroes[0].tally).toEqual({ won: 1, lost: 1 })
  })
})

describe('export', () => {
  it('is valid JSON carrying the records and the version they were scored on', () => {
    const records = [makeRecord({ id: 'one', outcome: 'won' })]
    const parsed = JSON.parse(exportMatches(records, '2026-07-26T19:00:00.000Z'))

    expect(parsed.app).toBe('retribution')
    expect(parsed.schema).toBe(1)
    expect(parsed.count).toBe(1)
    expect(parsed.matches[0].id).toBe('one')
    expect(parsed.matches[0].dataVersion).toBe('2026-07-20T06:06:44.293Z')
    expect(parsed.matches[0].breakdown.base).toBe(300)
  })

  // The file is meant to be handed to an agent with nothing else, so it has to
  // say what the fields mean.
  it('explains itself to a reader who has never seen the app', () => {
    const parsed = JSON.parse(exportMatches([], '2026-07-26T19:00:00.000Z'))

    expect(parsed.about).toContain('followedAdvice')
    expect(parsed.about).toContain('dataVersion')
    expect(parsed.about).toContain('breakdown')
  })
})
