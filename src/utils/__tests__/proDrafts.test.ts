import { describe, it, expect } from 'vitest'
import heroData from '../../data/heroes.json'
import draftData from '../../data/pro-drafts.json'
import type { Hero } from '../../types/hero'
import { getJunglers, calculateJunglerRecommendation } from '../heroUtils'

const JUNGLE_INDEX = 1

const allHeroes = heroData.heroes as unknown as Hero[]
const junglers = getJunglers(allHeroes)
const heroById = new Map(allHeroes.map(hero => [hero.id, hero]))

interface DraftCase {
  enemies: Hero[]
  bans: Hero[]
  target: Hero
}

const draftCases: DraftCase[] = draftData.games.flatMap(game =>
  game.teams.map((team, index) => ({
    enemies: game.teams[1 - index].picks.map(pick => heroById.get(pick.id)!),
    bans: game.teams.flatMap(t => t.bans).map(ban => heroById.get(ban.id)!),
    target: heroById.get(team.picks[JUNGLE_INDEX].id)!,
  }))
)

const inPool = draftCases.filter(draft => junglers.some(jungler => jungler.id === draft.target.id))

let seed = 7
function nextRandom() {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

function sample(heroes: Hero[], size: number): Hero[] {
  const copy = heroes.slice()
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, size)
}

function rankJunglers(draft: DraftCase, enemies: Hero[]): number[] {
  const unavailable = new Set([...draft.bans.map(ban => ban.id), ...enemies.map(enemy => enemy.id)])
  return junglers
    .filter(jungler => !unavailable.has(jungler.id))
    .map(jungler => calculateJunglerRecommendation(jungler, [], enemies, 'Mythic', {
      matchBans: draft.bans,
    }))
    .sort((a, b) => b.total_score - a.total_score)
    .map(result => result.hero.id)
}

function measure(revealed?: number) {
  let inTop8 = 0
  let evaluated = 0
  const ranks: number[] = []

  for (const draft of inPool) {
    const trials = revealed === undefined || revealed >= 5
      ? [draft.enemies]
      : Array.from({ length: 4 }, () => sample(draft.enemies, revealed))

    for (const enemies of trials) {
      const position = rankJunglers(draft, enemies).indexOf(draft.target.id)
      evaluated += 1
      if (position >= 0 && position < 8) inTop8 += 1
      ranks.push(position < 0 ? junglers.length : position + 1)
    }
  }

  ranks.sort((a, b) => a - b)
  return { recallAt8: inTop8 / evaluated, medianRank: ranks[Math.floor(ranks.length / 2)] }
}

describe('pro draft corpus', () => {
  it('parses into usable draft cases', () => {
    expect(draftData.games.length).toBeGreaterThanOrEqual(70)
    expect(draftCases).toHaveLength(draftData.games.length * 2)
  })

  it('resolves every pick and ban to a known hero', () => {
    for (const game of draftData.games) {
      for (const team of game.teams) {
        expect(team.picks).toHaveLength(5)
        for (const pick of [...team.picks, ...team.bans]) {
          expect(heroById.get(pick.id), pick.name).toBeDefined()
        }
      }
    }
  })

  it('covers almost every pro jungler with the jungler pool', () => {
    const coverage = inPool.length / draftCases.length
    expect(coverage).toBeGreaterThan(0.95)
  })

  it('places heroes the pros jungle with in the meta jungle pool', () => {
    for (const name of ['Akai', 'Guinevere', 'Hirara', 'Fredrinn']) {
      const hero = allHeroes.find(candidate => candidate.hero_name === name)
      expect(hero?.lane, name).toContain('Jungle')
    }
  })
})

describe('recommendation quality against pro picks', () => {
  it('keeps the pro jungler in the top 8 often enough', () => {
    const { recallAt8, medianRank } = measure()
    console.log(`full information: recall@8=${(recallAt8 * 100).toFixed(0)}% median rank=${medianRank}`)
    expect(recallAt8).toBeGreaterThan(0.50)
    expect(medianRank).toBeLessThanOrEqual(8)
  })

  it('does not collapse when only part of the enemy team is revealed', () => {
    for (const revealed of [1, 2, 3, 4]) {
      const { recallAt8, medianRank } = measure(revealed)
      console.log(`${revealed} enemies revealed: recall@8=${(recallAt8 * 100).toFixed(0)}% median rank=${medianRank}`)
      expect(recallAt8, `${revealed} enemies revealed`).toBeGreaterThan(0.52)
    }
  })
})
