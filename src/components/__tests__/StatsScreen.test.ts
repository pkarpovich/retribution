import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'
import StatsScreen from '../StatsScreen.svelte'
import { matches } from '../../lib/matches.svelte'
import { CONFIDENT_AT } from '../../utils/matchStats'
import { makeRecord } from '../../utils/__tests__/matchFixtures'

const props = { onClose: () => {} }

// The delivery half of export touches two APIs jsdom does not carry. The
// serialisation it hands them is covered on its own in matchStats.
let captured: string | null = null

beforeEach(() => {
  matches.clear()
  localStorage.clear()
  captured = null

  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:stub'),
    revokeObjectURL: vi.fn(),
  })
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

    await fireEvent.click(screen.getAllByRole('button', { name: 'WON' })[0])
    expect(matches.all[0].outcome).toBe('won')
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

  it('drops a game from the log', async () => {
    matches.log(makeRecord({ id: 'a' }))
    render(StatsScreen, props)

    await fireEvent.click(screen.getByRole('button', { name: 'DELETE' }))
    expect(matches.all).toEqual([])
  })
})
