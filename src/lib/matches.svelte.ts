import type { MatchOutcome, MatchRecord } from '../types/match'

const STORAGE_KEY = 'retribution.matches'

// A record is ~1.1KB, so this is about half a megabyte of a five megabyte
// budget. Old games are dropped from the tail rather than refused at the head.
const MAX_RECORDS = 500

function load(): MatchRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((entry): entry is MatchRecord =>
      Boolean(entry)
      && typeof entry === 'object'
      && typeof (entry as MatchRecord).id === 'string'
      && typeof (entry as MatchRecord).outcome === 'string')
  } catch {
    return []
  }
}

function persist(records: MatchRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch {
    // storage unavailable or full - the log stays in memory for this session
  }
}

export function newMatchId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

// Persisting means serialising the whole log. Every other write is a button
// press, but a note is typed a character at a time, and at a few hundred games
// that is half a megabyte of JSON per keystroke.
const NOTE_SETTLE_MS = 400

function createMatches() {
  let records = $state<MatchRecord[]>(load())
  let noteTimer: ReturnType<typeof setTimeout> | undefined

  const write = (next: MatchRecord[], defer = false) => {
    records = next.slice(0, MAX_RECORDS)
    clearTimeout(noteTimer)
    if (!defer) return persist(records)
    noteTimer = setTimeout(() => persist(records), NOTE_SETTLE_MS)
  }

  return {
    get all() {
      return records
    },
    get pending() {
      return records.find(record => record.outcome === 'pending') ?? null
    },
    get settled() {
      return records.filter(record => record.outcome !== 'pending')
    },
    // Locking, changing your mind and locking again is one game, not two, so a
    // pending record is replaced rather than joined.
    log(record: MatchRecord) {
      write([record, ...records.filter(existing => existing.outcome !== 'pending')])
    },
    settle(id: string, outcome: MatchOutcome) {
      write(records.map(record => (record.id === id ? { ...record, outcome } : record)))
    },
    annotate(id: string, note: string) {
      write(records.map(record => (record.id === id ? { ...record, note } : record)), true)
    },
    remove(id: string) {
      write(records.filter(record => record.id !== id))
    },
    clear() {
      write([])
    },
  }
}

export const matches = createMatches()
