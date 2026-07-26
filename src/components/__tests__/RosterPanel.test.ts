import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'
import RosterPanel from '../RosterPanel.svelte'
import { heroes, textOf } from './fixtures'

const props = {
  heroes,
  mode: 'enemy' as const,
  hiddenByBans: 0,
  onModeChange: () => {},
  onPick: () => {},
  onOpenBans: () => {},
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
    expect(container.querySelectorAll('.cell')).toHaveLength(0)
  })

  it('hands the tapped hero back', async () => {
    const onPick = vi.fn()
    const { container } = render(RosterPanel, { ...props, onPick })

    await fireEvent.click(container.querySelector('.cell')!)
    expect(onPick).toHaveBeenCalledWith(heroes[0])
  })

  it('accounts for heroes the ban list is holding back', async () => {
    const onOpenBans = vi.fn()
    const { rerender } = render(RosterPanel, { ...props, hiddenByBans: 1, onOpenBans })
    expect(screen.getByRole('button', { name: '1 hero hidden by bans' })).toBeTruthy()

    await rerender({ ...props, hiddenByBans: 3, onOpenBans })
    await fireEvent.click(screen.getByRole('button', { name: '3 heroes hidden by bans' }))
    expect(onOpenBans).toHaveBeenCalledOnce()

    await rerender({ ...props, hiddenByBans: 0, onOpenBans })
    expect(screen.queryByRole('button', { name: /hidden by bans/ })).toBeNull()
  })
})
