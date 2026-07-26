import type { Hero, RecommendationResult, UserRank } from '../types/hero'
import type { EnemyRuleReadout } from './heroUtils'
import {
  HEAVY_CC_AT,
  HIGH_CC_SHARE,
  enemyRuleReadout,
  getCCScore,
  getMobilityScore,
  isDamageDealer,
  isPrimarilyMagic,
  isPrimarilyPhysical,
} from './heroUtils'

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
  comfort: number
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
    const comfort = result.breakdown.comfort
    return {
      result,
      hero: result.hero,
      match: best > 0
        ? Math.round(DISPLAY_FLOOR + (DISPLAY_CEILING - DISPLAY_FLOOR) * (result.total_score / best))
        : DISPLAY_FLOOR,
      strength,
      comfort,
      // Comfort is a third term, not part of the draft response, so the axis
      // keeps meaning what it says.
      fit: result.total_score - strength - comfort,
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
      stance: read && read.heavyCcCount / read.revealed >= HIGH_CC_SHARE ? 'wanted' : 'neutral',
      present: capabilities.hasImmunity,
      display: capabilities.hasImmunity ? '✓' : '—',
      points: null,
      why: read ? `${read.heavyCcCount} of ${read.revealed} carry heavy control` : '',
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

// A fact earns a line when the rule it drives is worth this much. Anything
// under it is noise: half the roster heals, so "at least one of them heals"
// was true for 86% of teams while paying a median of five points.
const MATERIAL_POINTS = 10

// Who the supply lines are counting. Before a pick is locked that is the list
// of suggestions; afterwards it is the team, because the suggestions are heroes
// this player can no longer take and can no longer see.
export interface Responders {
  heroes: Hero[]
  noun: string
  committed: boolean
}

export const suggested = (suggestions: Suggestion[]): Responders => ({
  heroes: suggestions.map(suggestion => suggestion.hero),
  noun: 'suggestions',
  committed: false,
})

export const chosen = (team: Hero[]): Responders => ({
  heroes: team,
  noun: team.length === 1 ? 'pick' : 'picks',
  committed: true,
})

export function enemyReadout(
  enemies: Hero[],
  pool: Hero[],
  responders: Responders,
  userRank: UserRank = 'Mythic',
): EnemyReadout | null {
  const read = enemyRuleReadout(enemies, userRank)
  if (!read) return null

  const heals = read.antiHealPoints >= MATERIAL_POINTS
  const breaksArmour = read.armourBreakPoints >= MATERIAL_POINTS
  const locks = read.heavyCcCount / read.revealed >= HIGH_CC_SHARE

  const carriers = (predicate: (hero: Hero) => boolean) => responders.heroes.filter(predicate).length
  const supply = (count: number) => `${count} of the ${responders.heroes.length} ${responders.noun} carry it`
  const poolCarriers = pool.filter(hero => hero.capabilities?.antiHeal)

  const levers: Lever[] = []

  if (heals) {
    const claimed = carriers(hero => Boolean(hero.capabilities?.antiHeal))
    levers.push({
      key: 'antiHeal',
      name: 'Anti-heal',
      flag: claimed === 0 ? 'UNCLAIMED' : null,
      tone: claimed === 0 ? 'neg' : 'pos',
      points: read.antiHealPoints,
      evidence: `${read.sustainCount} of ${read.revealed} of them heal`,
      supply: claimed > 0
        ? supply(claimed)
        : responders.committed
          ? 'nothing you have taken carries it'
          : `${poolCarriers.length} of ${pool.length} junglers carry it${poolCarriers.length > 0 ? ` — ${poolCarriers.map(hero => `${hero.hero_name}, ${hero.tier} tier`).join(', ')}` : ''}`,
    })
  }

  if (breaksArmour) {
    levers.push({
      key: 'armour',
      name: 'Armour-ignoring damage',
      flag: null,
      tone: 'pos',
      points: read.armourBreakPoints,
      evidence: `their mitigation is ${read.mitigation.toFixed(2)}`,
      supply: supply(carriers(hero => (hero.capabilities?.armorAgnostic ?? 0) > 0)),
    })
  }

  if (locks) {
    levers.push({
      key: 'immune',
      name: 'Control immunity',
      flag: null,
      tone: 'pos',
      points: null,
      evidence: `${read.heavyCcCount} of ${read.revealed} of them carry heavy control`,
      supply: supply(carriers(hero => Boolean(hero.capabilities?.hasImmunity))),
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
    supply: ccOff
      ? 'the rule runs and returns almost nothing'
      : supply(carriers(hero => (hero.capabilities?.ccScore ?? 0) >= HEAVY_CC_AT)),
  })

  const clauses = [
    heals ? 'they heal' : null,
    locks ? 'they will lock you down' : null,
    breaksArmour && !heals && !locks ? 'they soak damage' : null,
  ].filter((clause): clause is string => Boolean(clause))

  const sentence = clauses.join(', ') || 'nothing about their draft stands out'
  const statement = `${sentence[0].toUpperCase()}${sentence.slice(1)}.`

  // Same test as the headline, so the two can never disagree — the screenshot
  // that started this said "they will lock you down" and then advised anti-heal
  // in the same breath.
  const unclaimed = heals && carriers(hero => Boolean(hero.capabilities?.antiHeal)) === 0

  return {
    read,
    statement,
    aside: read.immunityCount === 0
      ? 'They cannot shrug off control themselves.'
      : `${read.immunityCount} of them shrug off control.`,
    levers,
    poolGap: unclaimed
      ? {
          headline: responders.committed
            ? 'Your draft has no answer to their sustain.'
            : 'Nothing you can pick answers their sustain.',
          detail: responders.committed
            ? `None of your ${responders.heroes.length} carries anti-heal.`
            : poolCarriers.length > 0
              ? `${poolCarriers.length} jungler in the pool carries anti-heal — ${poolCarriers.map(hero => `${hero.hero_name}, ${hero.tier} tier`).join(', ')}.`
              : 'No jungler in the pool carries anti-heal.',
          value: `+${read.antiHealPoints.toFixed(0)} unclaimed`,
          answer: 'This is an item, not a pick.',
        }
      : null,
    tally: [
      { label: 'sustain', value: `${read.sustainCount}/${read.revealed}`, drives: true },
      { label: 'crowd control', value: `${read.ccCount}/${read.revealed}`, drives: false },
      { label: 'heavy control', value: `${read.heavyCcCount}/${read.revealed}`, drives: true },
      { label: 'control immunity', value: `${read.immunityCount}/${read.revealed}`, drives: true },
      { label: 'mobility', value: `${Math.round(read.mobilityShare * 100)}%`, drives: true },
      { label: 'damage mitigation', value: read.mitigation.toFixed(2), drives: true },
      { label: 'squishy', value: `${read.squishy}/${read.revealed}`, drives: false },
      { label: 'tanks', value: `${read.tanks}/${read.revealed}`, drives: false },
    ],
  }
}

// ---------------------------------------------------------------------------
// What is still missing from your side, phrased so it can be said out loud to
// a teammate who has not picked yet.
//
// Every gate here is one the engine already applies, and the composition tests
// use the engine's own predicates rather than the looser ones heroAxes carries,
// so a need can never contradict the score that produced it.
// ---------------------------------------------------------------------------

export interface TeamNeed {
  key: string
  name: string
  points: number | null
  evidence: string
  gap: string
}

export function teamNeeds(
  allies: Hero[],
  enemies: Hero[],
  userRank: UserRank = 'Mythic',
): TeamNeed[] {
  const read = enemyRuleReadout(enemies, userRank)
  if (!read) return []

  const nobody = (predicate: (hero: Hero) => boolean) => !allies.some(predicate)
  const needs: TeamNeed[] = []

  if (read.antiHealPoints >= MATERIAL_POINTS && nobody(hero => Boolean(hero.capabilities?.antiHeal))) {
    needs.push({
      key: 'antiHeal',
      name: 'Anti-heal',
      points: read.antiHealPoints,
      evidence: `${read.sustainCount} of ${read.revealed} of them heal`,
      gap: 'nobody on your side carries it',
    })
  }

  if (read.catchPoints >= SWITCHED_OFF_BELOW && nobody(hero => getCCScore(hero) >= HEAVY_CC_AT)) {
    needs.push({
      key: 'cc',
      name: 'Lockdown',
      points: read.catchPoints,
      evidence: `their mobility is ${Math.round(read.mobilityShare * 100)}%`,
      gap: 'nothing on your side holds anyone still',
    })
  }

  if (read.armourBreakPoints >= MATERIAL_POINTS && nobody(hero => (hero.capabilities?.armorAgnostic ?? 0) > 0)) {
    needs.push({
      key: 'armour',
      name: 'Damage their armour cannot stop',
      points: read.armourBreakPoints,
      evidence: `their mitigation is ${read.mitigation.toFixed(2)}`,
      gap: 'everything you have has to go through it',
    })
  }

  if (read.heavyCcCount / read.revealed >= HIGH_CC_SHARE && nobody(hero => Boolean(hero.capabilities?.hasImmunity))) {
    needs.push({
      key: 'immune',
      name: 'A way out of their control',
      points: null,
      evidence: `${read.heavyCcCount} of ${read.revealed} of them carry heavy control`,
      gap: 'nobody on your side can shrug it off',
    })
  }

  if (allies.length > 0 && allies.every(hero => !isDamageDealer(hero))) {
    needs.push({
      key: 'damage',
      name: 'Someone to do the damage',
      points: null,
      evidence: `none of your ${allies.length} deals it`,
      gap: 'this is the largest single gap the engine scores',
    })
  }

  if (allies.length >= 2) {
    const physical = allies.filter(isPrimarilyPhysical).length
    const magic = allies.filter(isPrimarilyMagic).length
    const single = physical === allies.length ? 'physical' : magic === allies.length ? 'magic' : null

    if (single) {
      needs.push({
        key: 'damageType',
        name: 'The other damage school',
        points: null,
        evidence: `all ${allies.length} of your picks are ${single}`,
        gap: 'one defensive item answers your whole team',
      })
    }

    if (allies.every(hero => !hero.role.includes('Tank'))) {
      needs.push({
        key: 'frontline',
        name: 'A frontline',
        points: null,
        evidence: `none of your ${allies.length} is a tank`,
        gap: 'somebody has to be hit first',
      })
    }
  }

  return needs.sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
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
