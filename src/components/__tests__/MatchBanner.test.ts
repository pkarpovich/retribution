import { describe, it, expect, beforeEach } from 'vitest'
import { render } from '@testing-library/svelte'
import MatchBanner from '../MatchBanner.svelte'
import { matches } from '../../lib/matches.svelte'
import { makeRecord } from '../../utils/__tests__/matchFixtures'

const props = (record = makeRecord()) => ({ record, hero: null })

const meta = (container: HTMLElement) => container.querySelector('.when')?.textContent ?? ''

beforeEach(() => {
  matches.clear()
  localStorage.clear()
})

describe('MatchBanner', () => {
  it('reports where the pick stood when a list was on screen', () => {
    const { container } = render(MatchBanner, props(makeRecord({ rank: 3, shown: 8 })))

    expect(meta(container)).toContain('#3 of 8')
  })

  it('refuses to print a place past the end of the list', () => {
    const { container } = render(MatchBanner, props(makeRecord({ rank: 9, shown: 8 })))

    expect(meta(container)).toContain('below #8')
    expect(meta(container)).not.toContain('#9 of 8')
  })

  it('leaves no dangling separator on a pick taken with no list up', () => {
    const { container } = render(MatchBanner, props(makeRecord({ rank: null, shown: 0 })))

    expect(meta(container).trim()).not.toMatch(/^·/)
    expect(meta(container)).toContain('blind pick')
  })

  it('offers a result and a way out without sending anyone to the log', () => {
    const { container } = render(MatchBanner, props())

    expect(container.querySelector('.kicker')?.textContent).toBe('LAST GAME · UNLOGGED')
    expect([...container.querySelectorAll('.call')].map(call => call.textContent))
      .toEqual(['WON', 'LOST', 'SKIP'])
  })
})
