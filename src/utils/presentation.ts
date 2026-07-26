import type { Hero, RecommendationResult, UserRank } from '../types/hero'
import type { EnemyRuleReadout } from './heroUtils'
import { enemyRuleReadout, getCCScore, getMobilityScore } from './heroUtils'

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
  strength: number
  fit: number
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

  return results.map(result => {
    const strength = result.breakdown.base + result.breakdown.meta_bonus
    return {
      result,
      hero: result.hero,
      match: best > 0
        ? Math.round(DISPLAY_FLOOR + (DISPLAY_CEILING - DISPLAY_FLOOR) * (result.total_score / best))
        : DISPLAY_FLOOR,
      strength,
      fit: result.total_score - strength,
      matchups: matchupsFor(result.hero, enemies, allies),
      reasons: buildReasons(result, enemies),
    }
  })
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

// ---------------------------------------------------------------------------
// Engine read-out: what this enemy team makes worth taking, and by how much.
// Magnitudes come from enemyRuleReadout so the screen and the score cannot drift.
// ---------------------------------------------------------------------------

export type Stance = 'wanted' | 'off' | 'interpretation' | 'neutral'

export interface CapabilityFact {
  key: string
  short: string
  label: string
  stance: Stance
  present: boolean
  display: string
  points: number | null
  why: string
}

const SWITCHED_OFF_BELOW = 3

function armourDisplay(grade: number) {
  if (grade >= 2) return '%MAX'
  if (grade === 1) return '%HP'
  return '—'
}

export function capabilitiesFor(hero: Hero, enemies: Hero[], userRank: UserRank = 'Mythic'): CapabilityFact[] {
  const capabilities = hero.capabilities
  const read = enemyRuleReadout(enemies, userRank)
  if (!capabilities) return []

  const ccStance: Stance = !read ? 'neutral' : read.catchPoints < SWITCHED_OFF_BELOW ? 'off' : 'wanted'

  return [
    {
      key: 'antiHeal',
      short: 'AHEAL',
      label: 'anti-heal',
      stance: read && read.sustainCount > 0 ? 'wanted' : 'neutral',
      present: capabilities.antiHeal,
      display: capabilities.antiHeal ? '✓' : '—',
      points: read?.antiHealPoints ?? null,
      why: read ? `${read.sustainCount} of ${read.revealed} of them heal` : '',
    },
    {
      key: 'armour',
      short: 'ARMR',
      label: 'armour-ignoring damage',
      stance: read && read.mitigation > 0 ? 'wanted' : 'neutral',
      present: capabilities.armorAgnostic > 0,
      display: armourDisplay(capabilities.armorAgnostic),
      points: read ? read.armourBreakPoints * (capabilities.armorAgnostic / 2) : null,
      why: read ? `their mitigation is ${read.mitigation.toFixed(2)}` : '',
    },
    {
      key: 'immune',
      short: 'IMMUN',
      label: 'control immunity',
      stance: read && read.ccCount / read.revealed >= 0.6 ? 'wanted' : 'neutral',
      present: capabilities.hasImmunity,
      display: capabilities.hasImmunity ? '✓' : '—',
      points: null,
      why: read ? `${read.ccCount} of ${read.revealed} carry crowd control` : '',
    },
    {
      key: 'cc',
      short: 'CC',
      label: 'crowd control',
      stance: ccStance,
      present: capabilities.ccScore > 0,
      display: `${capabilities.ccScore}/6`,
      points: read ? read.catchPoints * Math.min(capabilities.ccScore / 4, 1) : null,
      why: read
        ? `their mobility is ${Math.round(read.mobilityShare * 100)}%${ccStance === 'off' ? ' — the rule is effectively switched off' : ''}`
        : '',
    },
    {
      key: 'mob',
      short: 'MOB',
      label: 'mobility',
      stance: 'interpretation',
      present: capabilities.mobilityScore > 0,
      display: `${capabilities.mobilityScore}/6`,
      points: null,
      why: 'feeds invade resistance, not their control',
    },
    {
      key: 'selfHeal',
      short: 'SELF',
      label: 'self-sustain',
      stance: 'neutral',
      present: capabilities.selfSustain,
      display: capabilities.selfSustain ? '✓' : '—',
      points: null,
      why: '',
    },
    {
      key: 'shield',
      short: 'SHLD',
      label: 'shield',
      stance: 'neutral',
      present: capabilities.hasShield,
      display: capabilities.hasShield ? '✓' : '—',
      points: null,
      why: '',
    },
  ]
}

export interface Lever {
  key: string
  name: string
  flag: string | null
  tone: 'pos' | 'neg' | 'faint'
  points: number | null
  evidence: string
  supply: string
}

export interface PoolGap {
  headline: string
  detail: string
  value: string
  answer: string
}

export interface EnemyReadout {
  read: EnemyRuleReadout
  statement: string
  aside: string
  levers: Lever[]
  poolGap: PoolGap | null
  tally: { label: string; value: string; drives: boolean }[]
}

export function enemyReadout(
  enemies: Hero[],
  pool: Hero[],
  suggestions: Suggestion[],
  userRank: UserRank = 'Mythic',
): EnemyReadout | null {
  const read = enemyRuleReadout(enemies, userRank)
  if (!read) return null

  const heals = read.sustainCount / read.revealed >= 0.5
  const locks = read.ccCount / read.revealed >= 0.6

  const carriers = (predicate: (hero: Hero) => boolean) => suggestions.filter(s => predicate(s.hero)).length
  const poolCarriers = pool.filter(hero => hero.capabilities?.antiHeal)

  const levers: Lever[] = []

  if (read.sustainCount > 0) {
    const claimed = carriers(hero => Boolean(hero.capabilities?.antiHeal))
    levers.push({
      key: 'antiHeal',
      name: 'Anti-heal',
      flag: claimed === 0 ? 'UNCLAIMED' : null,
      tone: claimed === 0 ? 'neg' : 'pos',
      points: read.antiHealPoints,
      evidence: `${read.sustainCount} of ${read.revealed} of them heal`,
      supply: claimed === 0
        ? `${poolCarriers.length} of ${pool.length} junglers carry it${poolCarriers.length > 0 ? ` — ${poolCarriers.map(hero => `${hero.hero_name}, ${hero.tier} tier`).join(', ')}` : ''}`
        : `${claimed} of the ${suggestions.length} suggestions carry it`,
    })
  }

  if (read.mitigation > 0) {
    levers.push({
      key: 'armour',
      name: 'Armour-ignoring damage',
      flag: null,
      tone: 'pos',
      points: read.armourBreakPoints,
      evidence: `their mitigation is ${read.mitigation.toFixed(2)}`,
      supply: `${carriers(hero => (hero.capabilities?.armorAgnostic ?? 0) > 0)} of the ${suggestions.length} suggestions carry it`,
    })
  }

  if (locks) {
    levers.push({
      key: 'immune',
      name: 'Control immunity',
      flag: null,
      tone: 'pos',
      points: null,
      evidence: `${read.ccCount} of ${read.revealed} of them carry crowd control`,
      supply: `${carriers(hero => Boolean(hero.capabilities?.hasImmunity))} of the ${suggestions.length} carry it`,
    })
  }

  const ccOff = read.catchPoints < SWITCHED_OFF_BELOW
  levers.push({
    key: 'cc',
    name: 'Lockdown of your own',
    flag: ccOff ? 'SWITCHED OFF' : null,
    tone: ccOff ? 'faint' : 'pos',
    points: read.catchPoints,
    evidence: `their mobility is ${Math.round(read.mobilityShare * 100)}%`,
    supply: ccOff ? 'the rule runs and returns almost nothing' : `${carriers(hero => (hero.capabilities?.ccScore ?? 0) >= 4)} of the ${suggestions.length} carry heavy control`,
  })

  const statement = [
    heals ? 'They heal' : null,
    locks ? 'they will lock you down' : null,
  ].filter(Boolean).join(', ') || 'Nothing about their draft is extreme'

  const unclaimed = read.sustainCount > 0 && carriers(hero => Boolean(hero.capabilities?.antiHeal)) === 0

  return {
    read,
    statement: `${statement}.`,
    aside: read.immunityCount === 0
      ? 'They cannot shrug off control themselves.'
      : `${read.immunityCount} of them shrug off control.`,
    levers,
    poolGap: unclaimed
      ? {
          headline: 'Nothing you can pick answers their sustain.',
          detail: poolCarriers.length > 0
            ? `${poolCarriers.length} jungler in the pool carries anti-heal — ${poolCarriers.map(hero => `${hero.hero_name}, ${hero.tier} tier`).join(', ')}.`
            : 'No jungler in the pool carries anti-heal.',
          value: `+${read.antiHealPoints.toFixed(0)} unclaimed`,
          answer: 'This is an item, not a pick.',
        }
      : null,
    tally: [
      { label: 'sustain', value: `${read.sustainCount}/${read.revealed}`, drives: true },
      { label: 'crowd control', value: `${read.ccCount}/${read.revealed}`, drives: true },
      { label: 'control immunity', value: `${read.immunityCount}/${read.revealed}`, drives: true },
      { label: 'mobility', value: `${Math.round(read.mobilityShare * 100)}%`, drives: true },
      { label: 'damage mitigation', value: read.mitigation.toFixed(2), drives: true },
      { label: 'squishy', value: `${read.squishy}/${read.revealed}`, drives: false },
      { label: 'tanks', value: `${read.tanks}/${read.revealed}`, drives: false },
    ],
  }
}

// Ties are what rounding already collapses — no extra threshold to tune.
export function tieGroups(suggestions: Suggestion[]): string[][] {
  const buckets = new Map<number, string[]>()
  for (const suggestion of suggestions) {
    const key = Math.round(suggestion.result.total_score)
    buckets.set(key, [...(buckets.get(key) ?? []), suggestion.hero.hero_name])
  }
  return [...buckets.values()].filter(names => names.length > 1)
}
