import { describe, it, expect, vi } from 'vitest'
import { makeRecord } from '../../utils/__tests__/matchFixtures'

const STORAGE_KEY = 'retribution.matches'

async function freshMatches(stored?: string) {
  localStorage.clear()
  if (stored !== undefined) localStorage.setItem(STORAGE_KEY, stored)
  vi.resetModules()
  return (await import('../matches.svelte')).matches
}

const persisted = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')

describe('match log', () => {
  it('starts a game as unsettled and keeps it findable', async () => {
    const matches = await freshMatches()
    matches.log(makeRecord({ id: 'a' }))

    expect(matches.pending?.id).toBe('a')
    expect(matches.settled).toEqual([])
    expect(persisted()).toHaveLength(1)
  })

  // Locking, changing your mind and locking again is one game.
  it('replaces an open game rather than starting a second', async () => {
    const matches = await freshMatches()
    matches.log(makeRecord({ id: 'first' }))
    matches.log(makeRecord({ id: 'second' }))

    expect(matches.all).toHaveLength(1)
    expect(matches.pending?.id).toBe('second')
  })

  it('keeps settled games when a new one opens', async () => {
    const matches = await freshMatches()
    matches.log(makeRecord({ id: 'old' }))
    matches.settle('old', 'won')
    matches.log(makeRecord({ id: 'new' }))

    expect(matches.all.map(record => record.id)).toEqual(['new', 'old'])
    expect(matches.settled).toHaveLength(1)
    expect(matches.pending?.id).toBe('new')
  })

  it('records the result and the note against the right game', async () => {
    const matches = await freshMatches()
    matches.log(makeRecord({ id: 'a' }))
    matches.settle('a', 'lost')
    matches.annotate('a', 'lost the early game, not the draft')

    expect(matches.all[0].outcome).toBe('lost')
    expect(matches.all[0].note).toBe('lost the early game, not the draft')
  })

  // A note is typed a character at a time and persisting means serialising the
  // whole log, so the write waits; the value on screen must not.
  it('shows a note at once and writes it a moment later', async () => {
    const matches = await freshMatches()
    matches.log(makeRecord({ id: 'a' }))

    matches.annotate('a', 'fed')
    matches.annotate('a', 'fed early')
    expect(matches.all[0].note).toBe('fed early')
    expect(persisted()[0].note).toBe('')

    await vi.waitFor(() => expect(persisted()[0].note).toBe('fed early'))
  })

  it('does not lose a pending note when something else is written', async () => {
    const matches = await freshMatches()
    matches.log(makeRecord({ id: 'a' }))

    matches.annotate('a', 'close game')
    matches.settle('a', 'won')

    expect(persisted()[0].note).toBe('close game')
    expect(persisted()[0].outcome).toBe('won')
  })

  it('drops a game that should not have been logged', async () => {
    const matches = await freshMatches()
    matches.log(makeRecord({ id: 'a' }))
    matches.remove('a')

    expect(matches.all).toEqual([])
    expect(matches.pending).toBeNull()
  })

  it('survives a reload', async () => {
    const matches = await freshMatches()
    matches.log(makeRecord({ id: 'a', outcome: 'won' }))

    const reloaded = await freshMatches(localStorage.getItem(STORAGE_KEY)!)
    expect(reloaded.all).toHaveLength(1)
    expect(reloaded.all[0].id).toBe('a')
  })

  it.each([
    ['not json', 'nonsense'],
    ['not a list', '{"matches":[]}'],
    ['entries of the wrong shape', '[1, null, {"nope":true}]'],
  ])('starts clean when storage holds %s', async (_case, stored) => {
    const matches = await freshMatches(stored)
    expect(matches.all).toEqual([])
  })

  it('keeps working when storage refuses to write', async () => {
    const matches = await freshMatches()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })

    expect(() => matches.log(makeRecord({ id: 'a' }))).not.toThrow()
    expect(matches.pending?.id).toBe('a')
    vi.restoreAllMocks()
  })

  it('drops the oldest games rather than growing without a bound', async () => {
    const seeded = Array.from({ length: 520 }, (_, i) => makeRecord({ id: `g${i}`, outcome: 'won' }))
    const matches = await freshMatches(JSON.stringify(seeded))

    matches.log(makeRecord({ id: 'newest' }))

    expect(matches.all).toHaveLength(500)
    expect(matches.all[0].id).toBe('newest')
    expect(matches.all.some(record => record.id === 'g0')).toBe(true)
    expect(matches.all.some(record => record.id === 'g519')).toBe(false)
  })
})
