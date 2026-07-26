import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'
import SuggestionBlock from '../SuggestionBlock.svelte'
import { getCCScore, situationalBudget } from '../../utils/heroUtils'
import { byName, controllers, drySlow, junglers, suggestionFor, textOf } from './fixtures'

const [a, b, c, d, e] = junglers.slice(0, 5)

// Totals descend the way the engine hands them over; fit deliberately does not
// follow, so anything that reads one order while meaning the other shows up.
const spread = [
  suggestionFor(a, 100, 30),
  suggestionFor(b, 118, 6),
  suggestionFor(c, 100, 20.4),
  suggestionFor(d, 100, 19.6),
  suggestionFor(e, 60, 50),
]

const props = {
  suggestions: spread,
  enemies: [],
  myPick: null,
  hasDraft: true,
  onLock: () => {},
  onUnlock: () => {},
}

const names = (root: ParentNode) => textOf(root, '.row-name')
const ranks = (root: ParentNode) => textOf(root, '.row-rank')

describe('SuggestionBlock states', () => {
  it('asks for a draft before anything is picked', () => {
    render(SuggestionBlock, { ...props, hasDraft: false })

    expect(screen.getByText('Start with the enemy team')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'LOCK THIS PICK' })).toBeNull()
  })

  it('shows the locked pick instead of suggestions and can release it', async () => {
    const onUnlock = vi.fn()
    render(SuggestionBlock, { ...props, myPick: byName('Ling'), onUnlock })

    expect(screen.getByText('YOUR JUNGLE PICK')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'LOCK THIS PICK' })).toBeNull()

    await fireEvent.click(screen.getByRole('button', { name: 'CHANGE' }))
    expect(onUnlock).toHaveBeenCalledOnce()
  })

  it('locks the hero currently in focus, not the first one', async () => {
    const onLock = vi.fn()
    render(SuggestionBlock, { ...props, onLock })

    await fireEvent.click(screen.getByRole('button', { name: `${c.hero_name}, fit 20` }))
    await fireEvent.click(screen.getByRole('button', { name: 'LOCK THIS PICK' }))

    expect(onLock).toHaveBeenCalledWith(c)
  })
})

describe('SuggestionBlock focus card', () => {
  it('opens on the engine leader and reports its standing', () => {
    const { container } = render(SuggestionBlock, props)

    expect(container.querySelector('.card .name')?.textContent).toBe(a.hero_name)
    expect(container.querySelector('.identity .kicker')?.textContent).toBe('#1 of 5')
    expect(container.querySelector('.figures')?.textContent?.replace(/\s/g, '')).toBe('100+30')
  })

  it('splits the bar into the strength and fit it just named', () => {
    const { container } = render(SuggestionBlock, props)
    const segments = container.querySelectorAll('.card .stack .seg')

    expect(segments[0].getAttribute('style')).toContain(`${(100 / 130) * 100}%`)
    expect(segments[1].getAttribute('style')).toContain(`${(30 / 130) * 100}%`)
  })

  it('falls back to the first suggestion when the list shrinks under the focus', async () => {
    const { container, rerender } = render(SuggestionBlock, props)

    await fireEvent.click(screen.getByRole('button', { name: `${e.hero_name}, fit 50` }))
    expect(container.querySelector('.card .name')?.textContent).toBe(e.hero_name)

    await rerender({ ...props, suggestions: spread.slice(0, 2) })
    expect(container.querySelector('.card .name')?.textContent).toBe(a.hero_name)
    expect(container.querySelector('.identity .kicker')?.textContent).toBe('#1 of 2')
  })
})

describe('SuggestionBlock fit axis', () => {
  it('places every dot against the engine ceiling, not the spread on screen', () => {
    const budget = situationalBudget()
    const { container } = render(SuggestionBlock, props)
    const dots = [...container.querySelectorAll('.dot')]

    expect(dots).toHaveLength(spread.length)
    for (const [index, dot] of dots.entries()) {
      const expected = (spread[index].fit / budget) * 100
      expect(dot.getAttribute('style')).toContain(`${expected}%`)
    }
  })

  it('keeps a fit beyond the ceiling on the axis', () => {
    const budget = situationalBudget()
    const { container } = render(SuggestionBlock, {
      ...props,
      suggestions: [suggestionFor(a, 10, budget * 2)],
    })

    expect(container.querySelector('.dot')?.getAttribute('style')).toContain('100%')
  })

  it('steps through the dots in fit order rather than list order', async () => {
    const { container } = render(SuggestionBlock, props)
    const focused = () => container.querySelector('.card .name')?.textContent

    // Leader a sits fourth by fit, between c (20.4) and e (50).
    await fireEvent.click(screen.getByRole('button', { name: 'Previous by fit' }))
    expect(focused()).toBe(c.hero_name)

    await fireEvent.click(screen.getByRole('button', { name: 'Next by fit' }))
    await fireEvent.click(screen.getByRole('button', { name: 'Next by fit' }))
    expect(focused()).toBe(e.hero_name)
  })

  it('disables each arrow at its end of the axis', async () => {
    render(SuggestionBlock, props)
    const back = screen.getByRole('button', { name: 'Previous by fit' }) as HTMLButtonElement
    const forward = screen.getByRole('button', { name: 'Next by fit' }) as HTMLButtonElement

    await fireEvent.click(screen.getByRole('button', { name: `${e.hero_name}, fit 50` }))
    expect(forward.disabled).toBe(true)
    expect(back.disabled).toBe(false)

    await fireEvent.click(screen.getByRole('button', { name: `${b.hero_name}, fit 6` }))
    expect(back.disabled).toBe(true)
    expect(forward.disabled).toBe(false)
  })

  it('names the strongest fit even while another hero holds focus', () => {
    const { container } = render(SuggestionBlock, props)

    expect(container.querySelector('.axis-focus')?.textContent)
      .toBe(`${a.hero_name} 30 · best ${e.hero_name}`)
  })
})

describe('SuggestionBlock list', () => {
  it('brackets the heroes the engine cannot separate', () => {
    const { container } = render(SuggestionBlock, props)

    expect(ranks(container)).toEqual(['#1', '#2', '#3–4', '#3–4', '#5'])
    expect(container.querySelectorAll('.row-group.tied')).toHaveLength(1)
    expect(container.querySelectorAll('.tie-note')).toHaveLength(1)
  })

  it('keeps engine ranks when the list is re-sorted by fit', async () => {
    const { container } = render(SuggestionBlock, props)

    await fireEvent.click(screen.getByRole('button', { name: 'FIT' }))

    expect(names(container)).toEqual([e, a, c, d, b].map(hero => hero.hero_name))
    expect(ranks(container)).toEqual(['#5', '#1', '#3–4', '#3–4', '#2'])
  })

  it('drops the tie bracket once the order on screen is no longer the engine one', async () => {
    const { container } = render(SuggestionBlock, props)

    await fireEvent.click(screen.getByRole('button', { name: 'FIT' }))
    expect(container.querySelectorAll('.row-group.tied')).toHaveLength(0)
    expect(container.querySelectorAll('.tie-note')).toHaveLength(0)

    await fireEvent.click(screen.getByRole('button', { name: 'TOTAL' }))
    expect(container.querySelectorAll('.tie-note')).toHaveLength(1)
  })

  it('moves focus to a row that is clicked', async () => {
    const { container } = render(SuggestionBlock, props)

    await fireEvent.click([...container.querySelectorAll('.row')][4])
    expect(container.querySelector('.card .name')?.textContent).toBe(e.hero_name)
    expect(container.querySelectorAll('.row.on')).toHaveLength(1)
  })
})

describe('SuggestionBlock capability read-out', () => {
  it('says nothing about capabilities while the enemy team is empty', () => {
    const { container } = render(SuggestionBlock, props)
    expect(container.querySelectorAll('.cap')).toHaveLength(0)
  })

  it('only marks the capabilities this enemy team pays for', () => {
    const { container } = render(SuggestionBlock, { ...props, enemies: drySlow.slice(0, 5) })
    const shown = textOf(container, '.cap-label')

    expect(shown).toContain('CC')
    expect(shown).not.toContain('MOB')
    expect(shown).not.toContain('SELF')
  })

  it('explains a switched-off rule only for a hero that brought the capability', async () => {
    const controller = controllers[0]
    const bare = junglers.find(hero => hero.id !== controller.id && getCCScore(hero) < 4)!

    const { container } = render(SuggestionBlock, {
      ...props,
      enemies: drySlow.slice(0, 5),
      suggestions: [suggestionFor(controller, 100, 10), suggestionFor(bare, 90, 8)],
    })

    expect(container.querySelector('.note')?.textContent).toContain('switched off')

    await fireEvent.click(screen.getByRole('button', { name: `${bare.hero_name}, fit 8` }))
    expect(container.querySelector('.note')).toBeNull()
  })
})
