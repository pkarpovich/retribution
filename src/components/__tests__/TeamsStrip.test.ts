import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'
import TeamsStrip from '../TeamsStrip.svelte'
import { heroes } from './fixtures'

const [first, second, third] = heroes

const props = {
  allies: [],
  enemies: [],
  myPick: null,
  onRemoveAlly: () => {},
  onRemoveEnemy: () => {},
  onClearPick: () => {},
  onChoosePick: () => {},
}

describe('TeamsStrip', () => {
  it('always draws the full draft, filled or not', () => {
    const { container } = render(TeamsStrip, { ...props, allies: [first], enemies: [second] })

    expect(container.querySelectorAll('.slot')).toHaveLength(10)
    expect(container.querySelectorAll('.slot.filled')).toHaveLength(2)
    expect(container.querySelectorAll('.slot.empty')).toHaveLength(7)
  })

  it('takes an ally back off the board', async () => {
    const onRemoveAlly = vi.fn()
    render(TeamsStrip, { ...props, allies: [first], onRemoveAlly })

    await fireEvent.click(
      screen.getByRole('button', { name: `Remove ${first.hero_name} from your team` })
    )
    expect(onRemoveAlly).toHaveBeenCalledWith(first)
  })

  it('takes an enemy back off the board', async () => {
    const onRemoveEnemy = vi.fn()
    render(TeamsStrip, { ...props, enemies: [second], onRemoveEnemy })

    await fireEvent.click(
      screen.getByRole('button', { name: `Remove ${second.hero_name} from the enemy team` })
    )
    expect(onRemoveEnemy).toHaveBeenCalledWith(second)
  })

  it('holds the jungle slot open until a pick is locked', async () => {
    const onClearPick = vi.fn()
    const { container, rerender } = render(TeamsStrip, props)

    expect(container.querySelector('.jungle-empty')?.textContent).toBe('JG')
    expect(screen.queryByRole('button', { name: 'Clear your jungle pick' })).toBeNull()

    await rerender({ ...props, myPick: third, onClearPick })
    expect(container.querySelector('.jungle-empty')).toBeNull()

    await fireEvent.click(screen.getByRole('button', { name: 'Clear your jungle pick' }))
    expect(onClearPick).toHaveBeenCalledOnce()
  })

  it('offers the empty jungle slot as the way in to marking your own hero', async () => {
    const onChoosePick = vi.fn()
    render(TeamsStrip, { ...props, onChoosePick })

    await fireEvent.click(screen.getByRole('button', { name: 'Mark your jungle pick' }))
    expect(onChoosePick).toHaveBeenCalledOnce()
  })

  it('turns the jungle slot back into a clear control once a pick is marked', async () => {
    const onChoosePick = vi.fn()
    const onClearPick = vi.fn()
    render(TeamsStrip, { ...props, myPick: third, onChoosePick, onClearPick })

    expect(screen.queryByRole('button', { name: 'Mark your jungle pick' })).toBeNull()

    await fireEvent.click(screen.getByRole('button', { name: 'Clear your jungle pick' }))
    expect(onClearPick).toHaveBeenCalledOnce()
    expect(onChoosePick).not.toHaveBeenCalled()
  })
})
