import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'
import BansScreen from '../BansScreen.svelte'
import { bans } from '../../lib/bans.svelte'
import { heroes, junglers, textOf } from './fixtures'

const props = { heroes, onClose: () => {} }

const rowFor = (root: ParentNode, name: string) =>
  [...root.querySelectorAll('.row')]
    .find(row => row.querySelector('.name')?.textContent === name)!

beforeEach(() => {
  bans.clear()
  localStorage.clear()
})

describe('BansScreen', () => {
  it('opens on the jungle pool and can widen to the whole roster', async () => {
    const { container } = render(BansScreen, props)

    expect(container.querySelector('.count')?.textContent).toBe(String(junglers.length))

    await fireEvent.click(screen.getByRole('button', { name: 'ALL HEROES' }))
    expect(container.querySelector('.count')?.textContent).toBe(String(heroes.length))
  })

  it('filters by name and says so when nothing matches', async () => {
    const { container } = render(BansScreen, props)
    const search = screen.getByLabelText('Search heroes')

    await fireEvent.input(search, { target: { value: junglers[0].hero_name } })
    expect(textOf(container, '.name')).toContain(junglers[0].hero_name)

    await fireEvent.input(search, { target: { value: 'zzzz' } })
    expect(screen.getByText('No heroes match')).toBeTruthy()
    expect(container.querySelector('.count')?.textContent).toBe('0')
  })

  it('bans a hero and lets it back in', async () => {
    const target = junglers[0]
    const { container } = render(BansScreen, props)

    const row = rowFor(container, target.hero_name)
    expect(row.querySelector('.pill')?.textContent).toBe('BAN')

    await fireEvent.click(row)
    expect(bans.has(target.id)).toBe(true)
    expect(row.getAttribute('aria-pressed')).toBe('true')
    expect(row.querySelector('.pill')?.textContent).toBe('BANNED')

    await fireEvent.click(row)
    expect(bans.has(target.id)).toBe(false)
    expect(row.querySelector('.pill')?.textContent).toBe('BAN')
  })

  it('only offers CLEAR once something is banned, and counts as it goes', async () => {
    const { container } = render(BansScreen, props)

    expect(screen.queryByRole('button', { name: 'CLEAR' })).toBeNull()
    expect(container.querySelector('.tally-count')?.textContent).toBe('0')

    await fireEvent.click(rowFor(container, junglers[0].hero_name))
    await fireEvent.click(rowFor(container, junglers[1].hero_name))
    expect(container.querySelector('.tally-count')?.textContent).toBe('2')

    await fireEvent.click(screen.getByRole('button', { name: 'CLEAR' }))
    expect(bans.size).toBe(0)
    expect(screen.queryByRole('button', { name: 'CLEAR' })).toBeNull()
  })

  it('goes back to the draft', async () => {
    const onClose = vi.fn()
    render(BansScreen, { ...props, onClose })

    await fireEvent.click(screen.getByRole('button', { name: 'DRAFT' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
