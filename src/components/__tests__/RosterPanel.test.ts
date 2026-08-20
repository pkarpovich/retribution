import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'
import RosterPanel from '../RosterPanel.svelte'
import { heroes, textOf } from './fixtures'

const props = {
  heroes,
  banned: new Set<number>(),
  onPick: () => {},
}

const tanks = heroes.filter(hero => hero.role.includes('Tank'))
const count = (root: ParentNode) => root.querySelector('.count')?.textContent

describe('RosterPanel', () => {
  it('filters by role and lets the same chip clear itself', async () => {
    const { container } = render(RosterPanel, props)
    expect(count(container)).toBe(String(heroes.length))

    await fireEvent.click(screen.getByRole('button', { name: 'TANK' }))
    expect(count(container)).toBe(String(tanks.length))

    await fireEvent.click(screen.getByRole('button', { name: 'TANK' }))
    expect(count(container)).toBe(String(heroes.length))
  })

  it('narrows by name and role at once', async () => {
    const { container } = render(RosterPanel, props)

    await fireEvent.click(screen.getByRole('button', { name: 'TANK' }))
    await fireEvent.input(screen.getByLabelText('Search heroes'), {
      target: { value: tanks[0].hero_name },
    })

    expect(textOf(container, '.cell-name')).toContain(tanks[0].hero_name)
    expect(Number(count(container))).toBeLessThan(tanks.length)
  })

  it('reports when the search leaves nothing', async () => {
    const { container } = render(RosterPanel, props)

    await fireEvent.input(screen.getByLabelText('Search heroes'), { target: { value: 'zzzz' } })
    expect(screen.getByText('No heroes match')).toBeTruthy()
    expect(container.querySelectorAll('.cell:not([hidden])')).toHaveLength(0)
  })

  it('empties the search in one tap', async () => {
    const { container } = render(RosterPanel, props)
    const search = screen.getByLabelText('Search heroes') as HTMLInputElement

    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull()

    await fireEvent.input(search, { target: { value: tanks[0].hero_name } })
    await fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))

    expect(search.value).toBe('')
    expect(count(container)).toBe(String(heroes.length))
  })

  // The portraits are remote and uncached, so a cell that gets torn down and
  // rebuilt costs a round trip. Filtering must hide cells, not replace them.
  it('keeps the very same cells alive across a search', async () => {
    const { container } = render(RosterPanel, props)
    const search = screen.getByLabelText('Search heroes')
    const before = [...container.querySelectorAll('.cell')]

    await fireEvent.input(search, { target: { value: tanks[0].hero_name } })
    await fireEvent.input(search, { target: { value: '' } })

    expect([...container.querySelectorAll('.cell')]).toEqual(before)
  })

  it('hands the tapped hero back', async () => {
    const onPick = vi.fn()
    const { container } = render(RosterPanel, { ...props, onPick })

    await fireEvent.click(container.querySelector('.cell')!)
    expect(onPick).toHaveBeenCalledWith(heroes[0])
  })

  it('marks a personally banned hero without taking it off the board', async () => {
    const onPick = vi.fn()
    const banned = new Set([heroes[0].id])
    const { container } = render(RosterPanel, { ...props, banned, onPick })

    const cells = [...container.querySelectorAll('.cell')]
    expect(cells).toHaveLength(heroes.length)
    expect(cells[0].querySelector('.strike')).toBeTruthy()
    expect(cells[1].querySelector('.strike')).toBeNull()

    await fireEvent.click(cells[0])
    expect(onPick).toHaveBeenCalledWith(heroes[0])
  })

})
