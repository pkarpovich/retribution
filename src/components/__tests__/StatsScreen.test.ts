import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'
import heroData from '../../data/heroes.json'
import StatsScreen from '../StatsScreen.svelte'
import { matches } from '../../lib/matches.svelte'
import { CONFIDENT_AT } from '../../utils/matchStats'
import { makeRecord } from '../../utils/__tests__/matchFixtures'

const props = { onClose: () => {}, onReopen: () => {} }

// The delivery half of export touches two APIs jsdom does not carry. The
// serialisation it hands them is covered on its own in matchStats.
let captured: string | null = null

beforeEach(() => {
  matches.clear()
  localStorage.clear()
  captured = null

  // Added to the real URL rather than replacing it: swapping in a plain object
  // takes the constructor with it, and module loading needs it.
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:stub') })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  Object.defineProperty(HTMLAnchorElement.prototype, 'click', { configurable: true, value: vi.fn() })
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn((text: string) => { captured = text; return Promise.resolve() }) },
  })
})

describe('StatsScreen', () => {
  it('explains itself before anything is logged', () => {
    render(StatsScreen, props)

    expect(screen.getByText(/Nothing logged yet/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /EXPORT ALL/ })).toBeNull()
  })

  it('splits the record by whether the top pick was taken', () => {
    matches.log(makeRecord({ id: 'a', outcome: 'won', followedAdvice: true }))
    matches.log(makeRecord({ id: 'b', outcome: 'lost', followedAdvice: false }))

    const { container } = render(StatsScreen, props)
    const figures = [...container.querySelectorAll('.figure-value')].map(node => node.textContent)

    expect(figures).toEqual(['1-1', '1-0', '0-1'])
  })

  it('reconciles blind picks with the settled count in the kicker', () => {
    matches.log(makeRecord({ id: 'a', outcome: 'won', followedAdvice: true }))
    matches.log(makeRecord({ id: 'b', outcome: 'lost', rank: null, shown: 0, followedAdvice: false }))

    const { container } = render(StatsScreen, props)

    expect(container.querySelector('.kicker')?.textContent).toBe('SETTLED · 1 BLIND')
    const figures = [...container.querySelectorAll('.figure-value')].map(node => node.textContent)
    expect(figures).toEqual(['1-1', '1-0', '0-0'])
  })

  it('carries the unsettled count in the kicker alongside the blind one', () => {
    matches.log(makeRecord({ id: 'a', outcome: 'won', followedAdvice: true }))
    matches.log(makeRecord({ id: 'b', outcome: 'lost', rank: null, shown: 0, followedAdvice: false }))
    matches.log(makeRecord({ id: 'c', outcome: 'pending' }))

    const { container } = render(StatsScreen, props)

    expect(container.querySelector('.kicker')?.textContent).toBe('SETTLED · 1 BLIND · 1 OPEN')
  })

  it('names the two shapes a rank can take besides a place in the list', () => {
    matches.log(makeRecord({ id: 'below', rank: 9, shown: 8 }))
    const below = render(StatsScreen, props)
    expect(below.container.querySelector('.game-meta')?.textContent).toContain('below #8')
    expect(below.container.querySelector('.game-meta')?.textContent).not.toContain('#9 of 8')

    matches.clear()
    matches.log(makeRecord({ id: 'blind', rank: null, shown: 0 }))
    const blind = render(StatsScreen, props)
    expect(blind.container.querySelector('.game-meta')?.textContent?.trim()).not.toMatch(/^·/)
    expect(blind.container.querySelector('.game-meta')?.textContent).toContain('blind pick')

    matches.clear()
    matches.log(makeRecord({ id: 'third', rank: 3, shown: 8 }))
    const listed = render(StatsScreen, props)
    expect(listed.container.querySelector('.game-meta')?.textContent).toContain('#3 of 8')
  })

  // A percentage on eight games is theatre; the fraction carries its own n.
  it('withholds a percentage until the sample can carry one', () => {
    for (let i = 0; i < CONFIDENT_AT - 1; i++) {
      matches.log(makeRecord({ id: `g${i}`, outcome: 'won' }))
    }

    const { container, rerender } = render(StatsScreen, props)
    expect(container.querySelector('.figure-value')?.textContent).toBe('19-0')

    matches.log(makeRecord({ id: 'last', outcome: 'won' }))
    rerender(props)
    expect(container.querySelector('.figure-value')?.textContent).toBe('20-0 · 100%')
  })

  it('settles a game that is still open from the log', async () => {
    matches.log(makeRecord({ id: 'a' }))
    render(StatsScreen, props)

    await fireEvent.click(screen.getByRole('button', { name: 'WON' }))
    expect(matches.all[0].outcome).toBe('won')
  })

  // The result can be entered days later, and a misremembered one corrected.
  it('lets a settled game be changed and reopened', async () => {
    matches.log(makeRecord({ id: 'a', outcome: 'won' }))
    render(StatsScreen, props)

    const option = (name: string) => screen.getByRole('button', { name })
    expect(option('WON').getAttribute('aria-pressed')).toBe('true')

    await fireEvent.click(option('LOST'))
    expect(matches.all[0].outcome).toBe('lost')
    expect(option('LOST').getAttribute('aria-pressed')).toBe('true')
    expect(option('WON').getAttribute('aria-pressed')).toBe('false')

    await fireEvent.click(option('OPEN'))
    expect(matches.pending?.id).toBe('a')
  })

  // The iPad drops the app while MLBB is in the foreground, so the game is
  // usually settled in a session that never saw the draft. The screen has no
  // idea where a record came from; that it survives the reload is pinned in
  // the store's own tests.
  it('offers the result on a game this session never drafted', async () => {
    matches.log(makeRecord({ id: 'a', pick: { id: 7, name: 'Baxia', tier: 'A' } }))
    render(StatsScreen, props)

    expect(screen.getByRole('group', { name: 'Result for Baxia' })).toBeTruthy()
    await fireEvent.click(screen.getByRole('button', { name: 'LOST' }))
    expect(matches.all[0].outcome).toBe('lost')
  })

  it('keeps a free text note against the game', async () => {
    matches.log(makeRecord({ id: 'a', pick: { id: 10, name: 'Ling', tier: 'S' } }))
    render(StatsScreen, props)

    await fireEvent.input(screen.getByLabelText('Note for Ling'), {
      target: { value: 'jungle was invaded at 30 seconds' },
    })

    expect(matches.all[0].note).toBe('jungle was invaded at 30 seconds')
  })

  it('hands the whole log over as JSON', async () => {
    matches.log(makeRecord({ id: 'a', outcome: 'won' }))
    render(StatsScreen, props)

    await fireEvent.click(screen.getByRole('button', { name: /EXPORT ALL/ }))

    expect(captured).toBeTruthy()
    const parsed = JSON.parse(captured!)
    expect(parsed.matches).toHaveLength(1)
    expect(parsed.matches[0].id).toBe('a')
  })

  it('hands over a single game on its own', async () => {
    matches.log(makeRecord({ id: 'old', outcome: 'won' }))
    matches.log(makeRecord({ id: 'new' }))
    render(StatsScreen, props)

    await fireEvent.click(screen.getAllByRole('button', { name: 'EXPORT' })[0])

    const parsed = JSON.parse(captured!)
    expect(parsed.matches).toHaveLength(1)
    expect(parsed.matches[0].id).toBe('new')
  })

  it('hands a logged game back to the draft screen', async () => {
    const onReopen = vi.fn()
    matches.log(makeRecord({ id: 'a' }))
    render(StatsScreen, { ...props, onReopen })

    await fireEvent.click(screen.getByRole('button', { name: /OPEN DRAFT/ }))
    expect(onReopen).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }))
  })

  // Reopening rescores against today's roster, so a game logged on an older
  // one will not reproduce its numbers. Better said than left to look like a bug.
  it('warns when the game was scored on a roster that has since moved', () => {
    matches.log(makeRecord({ id: 'old', dataVersion: '2020-01-01T00:00:00.000Z' }))
    const { container } = render(StatsScreen, props)

    expect(container.querySelector('.stale')).toBeTruthy()

    matches.clear()
    matches.log(makeRecord({ id: 'fresh', dataVersion: heroData.lastUpdated }))
    const fresh = render(StatsScreen, props)
    expect(fresh.container.querySelector('.stale')).toBeNull()
  })

  it('drops a game from the log', async () => {
    matches.log(makeRecord({ id: 'a' }))
    render(StatsScreen, props)

    await fireEvent.click(screen.getByRole('button', { name: 'DELETE' }))
    expect(matches.all).toEqual([])
  })
})
