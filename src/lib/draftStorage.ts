import type { Hero } from '../types/hero'
import type { MatchRecord } from '../types/match'
import { MAX_ALLIES, MAX_ENEMIES } from '../utils/heroUtils'

export interface Draft {
  allies: Hero[]
  enemies: Hero[]
  matchBans: Hero[]
  myPick: Hero | null
}

const STORAGE_KEY = 'retribution.draft'

// Long enough to cover a match and a break, short enough that yesterday's
// board is never restored. A stale draft is worse than none: the screen would
// look ready and quietly answer the wrong enemy team.
export const DRAFT_TTL_MS = 3 * 60 * 60 * 1000

export const emptyDraft = (): Draft => ({
  allies: [],
  enemies: [],
  matchBans: [],
  myPick: null,
})

// Puts a logged game back on the board so it can be scored against today's
// data. The jungle pick is deliberately left off: locking it would hide the
// suggestions, and the point of reopening a game is to see where that hero
// stands now, which needs it back among the candidates.
export function draftFromRecord(record: MatchRecord, heroes: Hero[]): Draft {
  const byId = new Map(heroes.map(hero => [hero.id, hero]))
  const resolve = (named: { id: number }[], limit: number) =>
    named
      .map(entry => byId.get(entry.id))
      .filter((hero): hero is Hero => Boolean(hero))
      .slice(0, limit)

  return {
    allies: resolve(record.allies, MAX_ALLIES),
    enemies: resolve(record.enemies, MAX_ENEMIES),
    matchBans: resolve(record.matchBans, heroes.length),
    myPick: null,
  }
}

interface StoredDraft {
  at: number
  allies: number[]
  enemies: number[]
  matchBans: number[]
  myPick: number | null
}

// Ids, not heroes: the roster is refreshed twice a week and the board should
// come back resolved against the data that is live now. The match log makes
// the opposite choice for the opposite reason.
export function saveDraft(draft: Draft, now: number) {
  const ids = (heroes: Hero[]) => heroes.map(hero => hero.id)
  const stored: StoredDraft = {
    at: now,
    allies: ids(draft.allies),
    enemies: ids(draft.enemies),
    matchBans: ids(draft.matchBans),
    myPick: draft.myPick?.id ?? null,
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  } catch {
    // storage unavailable - the draft stays in memory for this session
  }
}

export function loadDraft(heroes: Hero[], now: number): Draft {
  const empty = emptyDraft()

  let stored: Partial<StoredDraft>
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return empty
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return empty
    stored = parsed as Partial<StoredDraft>
  } catch {
    return empty
  }

  if (typeof stored.at !== 'number' || now - stored.at > DRAFT_TTL_MS) return empty

  const byId = new Map(heroes.map(hero => [hero.id, hero]))
  const resolve = (ids: unknown, limit: number) =>
    (Array.isArray(ids) ? ids : [])
      .map(id => byId.get(id as number))
      .filter((hero): hero is Hero => Boolean(hero))
      .slice(0, limit)

  return {
    allies: resolve(stored.allies, MAX_ALLIES),
    enemies: resolve(stored.enemies, MAX_ENEMIES),
    matchBans: resolve(stored.matchBans, heroes.length),
    myPick: (stored.myPick !== null && byId.get(stored.myPick as number)) || null,
  }
}
