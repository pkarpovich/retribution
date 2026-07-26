import type { Hero, RecommendationResult } from '../types/hero'
import { getCCScore, getMobilityScore } from './heroUtils'

export type AxisKey = 'phys' | 'magic' | 'burst' | 'cc' | 'sustain' | 'mobility'

export interface Axis {
  key: AxisKey
  short: string
  full: string
}

export const AXES: Axis[] = [
  { key: 'phys', short: 'PHYS', full: 'physical damage' },
  { key: 'magic', short: 'MAGIC', full: 'magic damage' },
  { key: 'burst', short: 'BURST', full: 'burst' },
  { key: 'cc', short: 'CC', full: 'crowd control' },
  { key: 'sustain', short: 'SUST', full: 'sustain' },
  { key: 'mobility', short: 'MOB', full: 'mobility' },
]

const CC_SATURATES_AT = 6
const MOBILITY_SATURATES_AT = 4
const BURST_SATURATES_AT = 900

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

function isMagic(hero: Hero) {
  return hero.role.includes('Mage') || hero.speciality.includes('Magic Damage')
}

function isPhysical(hero: Hero) {
  if (isMagic(hero)) return false
  return hero.role.some(role => ['Marksman', 'Fighter', 'Assassin'].includes(role))
}

export function heroAxes(hero: Hero): Record<AxisKey, number> {
  const capabilities = hero.capabilities
  const profile = capabilities?.statProfile

  const burstSpec = hero.speciality.some(spec => ['Burst', 'Finisher'].includes(spec)) ? 0.35 : 0
  const burstDamage = clamp01((capabilities?.maxBurstDamage ?? 0) / BURST_SATURATES_AT)

  const sustainSources = [
    capabilities?.selfSustain ? 0.5 : 0,
    capabilities?.allySustain ? 0.3 : 0,
    capabilities?.hasShield ? 0.2 : 0,
    (profile?.regen ?? 0) * 0.3,
  ]

  return {
    phys: isPhysical(hero) ? 1 : 0,
    magic: isMagic(hero) ? 1 : 0,
    burst: clamp01(burstDamage + burstSpec),
    cc: clamp01(getCCScore(hero) / CC_SATURATES_AT),
    sustain: clamp01(sustainSources.reduce((sum, value) => sum + value, 0)),
    mobility: clamp01(getMobilityScore(hero) / MOBILITY_SATURATES_AT),
  }
}

export function teamProfile(team: Hero[]): Record<AxisKey, number> {
  const totals = { phys: 0, magic: 0, burst: 0, cc: 0, sustain: 0, mobility: 0 }
  for (const hero of team) {
    const axes = heroAxes(hero)
    for (const axis of AXES) totals[axis.key] += axes[axis.key]
  }
  return totals
}

export interface AxisDelta extends Axis {
  ally: number
  enemy: number
  delta: number
}

export function axisDeltas(allies: Hero[], enemies: Hero[]): AxisDelta[] {
  const ally = teamProfile(allies)
  const enemy = teamProfile(enemies)

  return AXES
    .map(axis => ({
      ...axis,
      ally: ally[axis.key],
      enemy: enemy[axis.key],
      delta: ally[axis.key] - enemy[axis.key],
    }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
}

export interface AxisContributor {
  hero: Hero
  value: number
}

export function axisContributors(team: Hero[], axis: AxisKey, limit = 2): AxisContributor[] {
  return team
    .map(hero => ({ hero, value: heroAxes(hero)[axis] }))
    .filter(entry => entry.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
}

export interface Matchup {
  strong: Hero[]
  weak: Hero[]
  synergy: Hero[]
}

export function matchupsFor(hero: Hero, enemies: Hero[], allies: Hero[]): Matchup {
  const enemyById = new Map(enemies.map(enemy => [enemy.id, enemy]))
  const allyById = new Map(allies.map(ally => [ally.id, ally]))

  const pick = (relations: { id: number }[] | undefined, pool: Map<number, Hero>) =>
    (relations ?? []).map(relation => pool.get(relation.id)).filter((found): found is Hero => Boolean(found))

  return {
    strong: pick(hero.weakAgainst, enemyById),
    weak: pick(hero.counters, enemyById),
    synergy: pick(hero.synergies, allyById),
  }
}

export interface Suggestion {
  result: RecommendationResult
  hero: Hero
  match: number
  matchups: Matchup
  reasons: string[]
}

const DISPLAY_CEILING = 99
const DISPLAY_FLOOR = 40

export function toSuggestions(
  results: RecommendationResult[],
  enemies: Hero[],
  allies: Hero[],
): Suggestion[] {
  const best = results[0]?.total_score ?? 0

  return results.map(result => ({
    result,
    hero: result.hero,
    match: best > 0
      ? Math.round(DISPLAY_FLOOR + (DISPLAY_CEILING - DISPLAY_FLOOR) * (result.total_score / best))
      : DISPLAY_FLOOR,
    matchups: matchupsFor(result.hero, enemies, allies),
    reasons: buildReasons(result, enemies),
  }))
}

function buildReasons(result: RecommendationResult, enemies: Hero[]): string[] {
  const reasons = [...result.strengths]

  const highest = result.warnings
    .filter(warning => warning.severity === 'HIGH')
    .map(warning => warning.message)

  if (highest.length > 0) reasons.push(highest[0])
  if (reasons.length === 0) {
    reasons.push(enemies.length > 0
      ? `Solid ${result.hero.tier}-tier pick into this draft`
      : `Solid ${result.hero.tier}-tier blind pick`)
  }

  return reasons
}
