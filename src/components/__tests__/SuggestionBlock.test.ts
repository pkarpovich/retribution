import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'
import type { BootRecommendation, Hero } from '../../types/hero'
import type { MatchRecord } from '../../types/match'
import type { PickReadout, TeamNeed } from '../../utils/presentation'
import SuggestionBlock from '../SuggestionBlock.svelte'
import { getCCScore, recommendBoots, situationalBudget } from '../../utils/heroUtils'
import { teamNeeds } from '../../utils/presentation'
import { byName, controllers, drySlow, junglers, suggestionFor, sustainers, textOf } from './fixtures'

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
  enemies: [] as Hero[],
  myPick: null as Hero | null,
  hasDraft: true,
  pickRead: null as PickReadout | null,
  build: null as BootRecommendation | null,
  needs: [] as TeamNeed[],
  unlogged: null as { record: MatchRecord; hero: Hero | null } | null,
  onLock: () => {},
  onUnlock: () => {},
  onBan: () => {},
  onOpenPlan: () => {},
}

const emptyReadout: PickReadout = {
  index: 0,
  sinceLock: null,
  taken: [],
  beaten: [],
  worksWith: [],
  live: [],
  openSlots: 5,
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

  // The engine has computed boots and a blessing for every candidate since
  // before the Svelte rewrite, and nothing rendered them until now.
  it('merges the pick and its board reading into one card', () => {
    const pick = byName('Ling')
    const { container } = render(SuggestionBlock, {
      ...props,
      myPick: pick,
      pickRead: { ...emptyReadout, index: -31, taken: [{ hero: byName('Natan'), severity: 'HIGH' }] },
    })

    expect(container.querySelector('.live')).toBeTruthy()
    expect(textOf(container, '.serif')).toContain('Ling')
    expect(container.querySelector('.index')?.textContent).toBe('-31')
    expect(textOf(container, '.chip-name')).toEqual(['Natan'])
  })

  it('folds the plan into one line that names the boots', () => {
    const pick = byName('Ling')
    const enemies = drySlow.slice(0, 5)
    const build = recommendBoots(pick, enemies)
    const needs = teamNeeds([pick], enemies)

    const { container } = render(SuggestionBlock, {
      ...props,
      myPick: pick,
      enemies,
      pickRead: emptyReadout,
      build,
      needs,
    })

    const bar = container.querySelector('.plan')
    expect(bar?.textContent).toContain('YOUR PLAN')
    expect(bar?.textContent).toContain(build.boots)
    expect(bar?.textContent).toContain('2 items')
    expect(screen.queryByText('WHAT TO BUY')).toBeNull()
  })

  it('counts the calls for the team on the plan line, and says nothing when there are none', () => {
    const pick = byName('Ling')
    const build = recommendBoots(pick, [])

    const withCalls = render(SuggestionBlock, {
      ...props,
      myPick: pick,
      pickRead: emptyReadout,
      build,
      needs: teamNeeds([pick], sustainers.slice(0, 5)),
    })
    expect(withCalls.container.querySelector('.plan')?.textContent).toMatch(/calls? for the team/)
    withCalls.unmount()

    const quiet = render(SuggestionBlock, {
      ...props,
      myPick: pick,
      pickRead: emptyReadout,
      build,
      needs: [],
    })
    expect(quiet.container.querySelector('.plan')?.textContent).not.toMatch(/for the team/)
  })

  it('opens the plan when the line is tapped', async () => {
    const pick = byName('Ling')
    const onOpenPlan = vi.fn()
    const { container } = render(SuggestionBlock, {
      ...props,
      myPick: pick,
      pickRead: emptyReadout,
      build: recommendBoots(pick, []),
      onOpenPlan,
    })

    await fireEvent.click(container.querySelector('.plan')!)
    expect(onOpenPlan).toHaveBeenCalledOnce()
  })

  it('shows the locked pick on an otherwise blank board rather than the onboarding prompt', () => {
    const pick = byName('Ling')
    render(SuggestionBlock, {
      ...props,
      myPick: pick,
      hasDraft: false,
      pickRead: emptyReadout,
    })

    expect(screen.getByText('YOUR JUNGLE PICK')).toBeTruthy()
    expect(screen.queryByText('Start with the enemy team')).toBeNull()
  })

  it('sends the hero in focus to the match ban list', async () => {
    const onBan = vi.fn()
    render(SuggestionBlock, { ...props, onBan })

    await fireEvent.click(screen.getByRole('button', { name: `${c.hero_name}, fit 20` }))
    await fireEvent.click(screen.getByRole('button', { name: `Ban ${c.hero_name} for this match` }))

    expect(onBan).toHaveBeenCalledWith(c)
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

  it('shows a draft that costs the hero as a loss rather than dropping it', () => {
    const { container } = render(SuggestionBlock, {
      ...props,
      suggestions: [suggestionFor(a, 100, -25)],
    })

    expect(container.querySelector('.figures')?.textContent?.replace(/\s/g, '')).toBe('100-25')
    expect(container.querySelector('.card .fit-figure')?.className).toContain('lost')

    const segments = container.querySelectorAll('.card .stack .seg')
    expect(segments[0].getAttribute('style')).toContain(`${(75 / 75) * 100}%`)
    expect(segments[1].className).toContain('lost')
    expect(segments[1].getAttribute('style')).toContain(`${(25 / 75) * 100}%`)
  })

  // Comfort is a third reading, not part of the draft response, so it gets its
  // own segment and its own figure rather than folding into fit.
  it('shows what the hero is worth to this player as a third term', () => {
    const { container } = render(SuggestionBlock, {
      ...props,
      suggestions: [{ ...suggestionFor(a, 100, 20), comfort: 8, result: { ...suggestionFor(a, 100, 20).result, total_score: 128 } }],
    })

    expect(container.querySelector('.figures')?.textContent?.replace(/\s/g, '')).toBe('100+20+8')
    expect(container.querySelectorAll('.card .stack .seg')).toHaveLength(3)
    expect(container.querySelector('.card .stack .seg.comfort')).toBeTruthy()
  })

  it('says nothing about comfort for a hero the player never named', () => {
    const { container } = render(SuggestionBlock, props)

    expect(container.querySelector('.card .stack .seg.comfort')).toBeNull()
    expect(container.querySelector('.comfort-figure')).toBeNull()
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
      const expected = ((spread[index].fit + budget) / (2 * budget)) * 100
      expect(dot.getAttribute('style')).toContain(`${expected}%`)
    }
  })

  // Fit is the squashed situational half, so it lives in -budget..+budget with
  // zero in the middle: a draft that costs the hero sits left of the mark.
  it('puts a draft that costs the hero on the left of zero', () => {
    const budget = situationalBudget()
    const { container } = render(SuggestionBlock, {
      ...props,
      suggestions: [suggestionFor(a, 100, -budget / 2), suggestionFor(b, 100, budget / 2)],
    })
    const [costly, paying] = [...container.querySelectorAll('.dot')]

    expect(costly.getAttribute('style')).toContain('25%')
    expect(paying.getAttribute('style')).toContain('75%')
  })

  it('keeps a fit beyond either end on the axis', () => {
    const budget = situationalBudget()
    const { container } = render(SuggestionBlock, {
      ...props,
      suggestions: [suggestionFor(a, 10, budget * 2), suggestionFor(b, 10, -budget * 2)],
    })
    const [high, low] = [...container.querySelectorAll('.dot')]

    expect(high.getAttribute('style')).toContain('100%')
    expect(low.getAttribute('style')).toContain('0%')
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
      .toBe(`${a.hero_name} +30 · best ${e.hero_name}`)
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

  it('offers no sort by comfort until the player has named a hero', () => {
    render(SuggestionBlock, props)
    expect(screen.queryByRole('button', { name: 'YOURS' })).toBeNull()
  })

  it('sorts by what the heroes are worth to the player', async () => {
    const mine = (suggestion: ReturnType<typeof suggestionFor>, comfort: number) => ({
      ...suggestion,
      comfort,
      result: { ...suggestion.result, total_score: suggestion.result.total_score + comfort },
    })

    const { container } = render(SuggestionBlock, {
      ...props,
      suggestions: [
        suggestionFor(a, 130, 0),
        mine(suggestionFor(b, 100, 0), 8),
        suggestionFor(c, 90, 0),
        mine(suggestionFor(d, 60, 0), 8),
      ],
    })

    await fireEvent.click(screen.getByRole('button', { name: 'YOURS' }))

    expect(names(container).slice(0, 2)).toEqual([b.hero_name, d.hero_name])
    // Engine ranks stay the engine's, exactly as they do under the fit sort.
    expect(ranks(container)).toEqual(['#2', '#4', '#1', '#3'])
  })

  it('falls back to the engine order when the last main leaves the list', async () => {
    const mine = { ...suggestionFor(b, 100, 0), comfort: 8 }
    const { rerender } = render(SuggestionBlock, {
      ...props,
      suggestions: [suggestionFor(a, 130, 0), mine],
    })

    await fireEvent.click(screen.getByRole('button', { name: 'YOURS' }))
    await rerender({ ...props, suggestions: [suggestionFor(a, 130, 0)] })

    expect(screen.queryByRole('button', { name: 'YOURS' })).toBeNull()
    expect(screen.getByRole('button', { name: 'TOTAL' }).getAttribute('aria-pressed')).toBe('true')
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
