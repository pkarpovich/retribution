import { describe, it, expect, beforeEach, vi } from 'vitest'

const STORAGE_KEY = 'retribution.bans'

async function freshBans(stored?: string) {
  localStorage.clear()
  if (stored !== undefined) localStorage.setItem(STORAGE_KEY, stored)
  vi.resetModules()
  return (await import('../bans.svelte')).bans
}

const persisted = () => localStorage.getItem(STORAGE_KEY)

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('ban list', () => {
  it('adds and removes on the same tap', async () => {
    const bans = await freshBans()

    bans.toggle(12)
    expect(bans.has(12)).toBe(true)
    expect(bans.size).toBe(1)

    bans.toggle(12)
    expect(bans.has(12)).toBe(false)
    expect(bans.size).toBe(0)
  })

  it('survives a reload', async () => {
    const bans = await freshBans()
    bans.toggle(3)
    bans.toggle(9)
    expect(persisted()).toBe('[3,9]')

    const reloaded = await freshBans(persisted()!)
    expect(reloaded.ids).toEqual([3, 9])
  })

  it('empties itself and the storage behind it', async () => {
    const bans = await freshBans('[1,2,3]')
    bans.clear()

    expect(bans.size).toBe(0)
    expect(persisted()).toBe('[]')
  })

  it.each([
    ['not json', 'not json at all'],
    ['not a list', '{"banned":[1]}'],
    ['a list of the wrong thing', '["1", null, 7]'],
  ])('starts clean when storage holds %s', async (_case, stored) => {
    const bans = await freshBans(stored)
    expect(bans.ids.every(id => typeof id === 'number')).toBe(true)
    expect(bans.ids).not.toContain('1')
  })

  it('keeps working when storage refuses to write', async () => {
    const bans = await freshBans()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })

    expect(() => bans.toggle(5)).not.toThrow()
    expect(bans.has(5)).toBe(true)
  })
})
