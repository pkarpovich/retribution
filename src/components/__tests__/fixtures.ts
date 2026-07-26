import heroData from '../../data/heroes.json'
import type { Hero, RecommendationResult, ScoreBreakdown } from '../../types/hero'
import type { Suggestion } from '../../utils/presentation'
import { getCCScore, getJunglers, getMobilityScore } from '../../utils/heroUtils'

export const heroes = heroData.heroes as unknown as Hero[]
export const junglers = getJunglers(heroes)

export function byName(name: string): Hero {
  const hero = heroes.find(candidate => candidate.hero_name === name)
  if (!hero) throw new Error(`no hero named ${name}`)
  return hero
}

export const sustainers = heroes.filter(hero =>
  hero.capabilities?.selfSustain || hero.capabilities?.allySustain)

export const drySlow = heroes.filter(hero =>
  hero.capabilities
  && !hero.capabilities.selfSustain
  && !hero.capabilities.allySustain
  && getMobilityScore(hero) === 0)

export const controllers = junglers.filter(hero => getCCScore(hero) >= 4)

const NO_BREAKDOWN: ScoreBreakdown = {
  base: 0,
  team_balance: 0,
  damage_type_balance: 0,
  enemy_analysis: 0,
  strong_against: 0,
  cc_chain_synergy: 0,
  counter_penalty: 0,
  synergy_bonus: 0,
  meta_bonus: 0,
  early_late_game: 0,
  invade_resistance: 0,
}

// The screen only reads hero, strength, fit and total_score, so a suggestion
// can be stated directly instead of steering the engine towards one.
export function suggestionFor(hero: Hero, strength: number, fit: number): Suggestion {
  const result: RecommendationResult = {
    hero,
    total_score: strength + fit,
    breakdown: { ...NO_BREAKDOWN, base: strength },
    jungler_type: 'DAMAGE',
    warnings: [],
    strengths: [],
    bootRecommendation: {
      boots: 'Warrior Boots',
      bootsReason: '',
      blessing: 'Ice',
      blessingReason: '',
    },
    recommendation_level: 'GOOD_PICK',
  }

  return {
    result,
    hero,
    match: 0,
    strength,
    fit,
    matchups: { strong: [], weak: [], synergy: [] },
    reasons: [],
  }
}

export const textOf = (root: ParentNode, selector: string) =>
  [...root.querySelectorAll(selector)].map(node => node.textContent?.trim() ?? '')
