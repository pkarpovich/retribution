import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'
import RosterPanel from '../RosterPanel.svelte'
import { heroes, textOf } from './fixtures'

const props = {
  heroes,
  mode: 'enemy' as const,
  banned: new Set<number>(),
  onModeChange: () => {},
  onPick: () => {},
}

const tanks = heroes.filter(hero => hero.role.includes('Tank'))
const count = (root: ParentNode) => root.querySelector('.count')?.textContent

describe('RosterPanel', () => {
  it('marks the side being drafted and can switch it', async () => {
    const onModeChange = vi.fn()
    render(RosterPanel, { ...props, onModeChange })

    expect(screen.getByRole('tab', { name: 'Add enemy' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: 'Add ally' }).getAttribute('aria-selected')).toBe('false')

    await fireEvent.click(screen.getByRole('tab', { name: 'Add ally' }))
    expect(onModeChange).toHaveBeenCalledWith('ally')
  })

  // Match bans are not limited to junglers: any hero taken off the board
  // changes what the enemy can still pick, so the whole roster stays tappable.
  it('offers a third side for heroes banned in the match', async () => {
    const onModeChange = vi.fn()
    const { container } = render(RosterPanel, { ...props, mode: 'ban', onModeChange })

    expect(screen.getByRole('tab', { name: 'Ban' }).getAttribute('aria-selected')).toBe('true')
    expect(container.querySelectorAll('.cell')).toHaveLength(heroes.length)

    await fireEvent.click(screen.getByRole('tab', { name: 'Add enemy' }))
    expect(onModeChange).toHaveBeenCalledWith('enemy')
  })

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

  // A personal ban is a note to self, not a rule of the match. The panel marks
  // the hero and keeps it tappable: the enemy taking a hero you refuse to play
  // is a thing that happens, and the app has to be able to hear about it.
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
