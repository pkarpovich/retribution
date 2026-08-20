import { describe, it, expect, beforeEach } from 'vitest'
import { DRAFT_TTL_MS, emptyDraft, loadDraft, saveDraft } from '../draftStorage'
import { heroes } from '../../components/__tests__/fixtures'

const STORAGE_KEY = 'retribution.draft'
const NOW = 1_800_000_000_000

const [first, second, third, fourth] = heroes

beforeEach(() => {
  localStorage.clear()
})

describe('draft storage', () => {
  it('starts empty when nothing was left behind', () => {
    expect(loadDraft(heroes, NOW)).toEqual(emptyDraft())
  })

  it('brings the whole board back', () => {
    saveDraft({
      allies: [first],
      enemies: [second, third],
      matchBans: [fourth],
      myPick: first,
    }, NOW)

    const restored = loadDraft(heroes, NOW + 60_000)

    expect(restored.allies).toEqual([first])
    expect(restored.enemies).toEqual([second, third])
    expect(restored.matchBans).toEqual([fourth])
    expect(restored.myPick).toBe(first)
  })

  // A board that looks ready but answers yesterday's enemy team is worse than
  // no board at all.
  it('refuses a draft that has gone stale', () => {
    saveDraft({ ...emptyDraft(), enemies: [first, second] }, NOW)

    expect(loadDraft(heroes, NOW + DRAFT_TTL_MS - 1).enemies).toHaveLength(2)
    expect(loadDraft(heroes, NOW + DRAFT_TTL_MS + 1)).toEqual(emptyDraft())
  })

  // Ids are stored, not heroes, so the board resolves against whatever the
  // twice-weekly refresh left in the roster.
  it('drops a hero the roster no longer has', () => {
    saveDraft({ ...emptyDraft(), enemies: [first, second] }, NOW)

    const shrunk = heroes.filter(hero => hero.id !== second.id)
    expect(loadDraft(shrunk, NOW).enemies).toEqual([first])
  })

  it('clamps a board that somehow holds more than the game allows', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      at: NOW,
      allies: heroes.slice(0, 9).map(hero => hero.id),
      enemies: heroes.slice(0, 9).map(hero => hero.id),
      matchBans: [],
      myPick: null,
    }))

    const restored = loadDraft(heroes, NOW)
    expect(restored.allies).toHaveLength(4)
    expect(restored.enemies).toHaveLength(5)
  })

  it.each([
    ['not json', 'nonsense'],
    ['a list', '[1,2,3]'],
    ['no timestamp', '{"enemies":[1]}'],
    ['a field the app no longer keeps', `{"at":${NOW},"mode":"spectator","enemies":[]}`],
  ])('survives storage holding %s', (label, stored) => {
    localStorage.setItem(STORAGE_KEY, stored)
    const restored = loadDraft(heroes, NOW)

    expect(restored.enemies, label).toEqual([])
    expect(restored.myPick, label).toBeNull()
  })

  it('keeps working when storage refuses to write', () => {
    const setItem = Storage.prototype.setItem
    Storage.prototype.setItem = () => {
      throw new Error('quota exceeded')
    }

    expect(() => saveDraft({ ...emptyDraft(), enemies: [first] }, NOW)).not.toThrow()
    Storage.prototype.setItem = setItem
  })
})
