import type { MatchHero, MatchRecord } from '../types/match'
import { MATCH_SCHEMA } from '../types/match'

export interface Tally {
  won: number
  lost: number
}

export interface MatchSummary {
  total: number
  pending: number
  settled: Tally
  followed: Tally
  overrode: Tally
  blind: Tally
  heroes: { hero: MatchHero; tally: Tally }[]
}

// Below this a percentage is theatre: at eight games the interval on a win rate
// runs from roughly a fifth to four fifths. Under it the screen shows the
// fraction and nothing else, which carries its own sample size.
export const CONFIDENT_AT = 20

const empty = (): Tally => ({ won: 0, lost: 0 })
const games = (tally: Tally) => tally.won + tally.lost

export function winRate(tally: Tally): number | null {
  const played = games(tally)
  if (played < CONFIDENT_AT) return null
  return Math.round((tally.won / played) * 100)
}

// A record written before this shape existed carries no rank at all, and the
// log's loader does not police the field. Anything that is not a pair of
// numbers reads as blind rather than as "#undefined of undefined".
export function rankLabel(record: Pick<MatchRecord, 'rank' | 'shown'>): string {
  if (typeof record.rank !== 'number' || typeof record.shown !== 'number') return 'blind pick'
  if (record.rank > record.shown) return `below #${record.shown}`
  return `#${record.rank} of ${record.shown}`
}

export function summarise(records: MatchRecord[]): MatchSummary {
  const settled = empty()
  const followed = empty()
  const overrode = empty()
  const blind = empty()
  const byHero = new Map<number, { hero: MatchHero; tally: Tally }>()
  let pending = 0

  for (const record of records) {
    if (record.outcome === 'pending') {
      pending += 1
      continue
    }

    const side = record.outcome === 'won' ? 'won' : 'lost'
    settled[side] += 1

    if (typeof record.rank !== 'number') blind[side] += 1
    else (record.followedAdvice ? followed : overrode)[side] += 1

    const entry = byHero.get(record.pick.id)
      ?? { hero: { id: record.pick.id, name: record.pick.name }, tally: empty() }
    entry.tally[side] += 1
    byHero.set(record.pick.id, entry)
  }

  return {
    total: records.length,
    pending,
    settled,
    followed,
    overrode,
    blind,
    heroes: [...byHero.values()].sort((a, b) => games(b.tally) - games(a.tally)),
  }
}

// The export is meant to be handed to an agent with no other context, so it
// says what the fields mean rather than assuming the reader has the codebase.
const ABOUT = [
  'Draft log from Retribution, an MLBB jungler recommendation app.',
  'One record per game, written when the jungle pick was locked.',
  'breakdown holds the engine score split into its components; base and',
  'meta_bonus are the hero on its own, everything else is this draft.',
  'rank is where the locked hero stood in the suggestions (1 is first),',
  'shown is how many were on screen, and followedAdvice is rank === 1.',
  'rank null means no suggestion list was on screen when the pick was taken',
  '(shown is 0): those games are blind picks and belong to neither the',
  'followed nor the overrode column. rank === shown + 1 means the hero was',
  'picked while a list was up but stood below it, which is an override.',
  'dataVersion is the hero dataset the score was computed against; it moves',
  'twice a week, so scores from different versions are not directly comparable.',
  'note is free text written by the player after the game.',
].join(' ')

export function exportMatches(records: MatchRecord[], exportedAt: string): string {
  return JSON.stringify(
    {
      app: 'retribution',
      schema: MATCH_SCHEMA,
      exportedAt,
      about: ABOUT,
      count: records.length,
      matches: records,
    },
    null,
    2,
  )
}
