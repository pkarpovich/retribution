import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'
import PoolScreen from '../PoolScreen.svelte'
import { bans, signatures } from '../../lib/pool.svelte'
import { heroes, junglers, textOf } from './fixtures'

const props = { heroes, onClose: () => {} }

const rowFor = (root: ParentNode, name: string) =>
  [...root.querySelectorAll('.row:not([hidden])')]
    .find(row => row.querySelector('.name')?.textContent === name)!

beforeEach(() => {
  bans.clear()
  signatures.clear()
  localStorage.clear()
})

describe('PoolScreen', () => {
  it('opens on the jungle pool and can widen to the whole roster', async () => {
    const { container } = render(PoolScreen, props)

    expect(container.querySelector('.count')?.textContent).toBe(String(junglers.length))

    await fireEvent.click(screen.getByRole('button', { name: 'ALL HEROES' }))
    expect(container.querySelector('.count')?.textContent).toBe(String(heroes.length))
  })

  it('filters by name and says so when nothing matches', async () => {
    const { container } = render(PoolScreen, props)
    const search = screen.getByLabelText('Search heroes') as HTMLInputElement

    const needle = junglers[0].hero_name
    await fireEvent.input(search, { target: { value: needle } })
    const shown = textOf(container, '.row:not([hidden]) .name')

    expect(shown).toContain(needle)
    for (const name of shown) expect(name.toLowerCase()).toContain(needle.toLowerCase())

    await fireEvent.input(search, { target: { value: 'zzzz' } })
    expect(screen.getByText('No heroes match')).toBeTruthy()
    expect(container.querySelector('.count')?.textContent).toBe('0')

    await fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(search.value).toBe('')
    expect(container.querySelector('.count')?.textContent).toBe(String(junglers.length))
  })

  const pill = (root: ParentNode, name: string, which: 'main' | 'ban') =>
    rowFor(root, name).querySelector(`.pill.${which}`) as HTMLButtonElement

  it('bans a hero and lets it back in', async () => {
    const target = junglers[0]
    const { container } = render(PoolScreen, props)
    const ban = () => pill(container, target.hero_name, 'ban')

    expect(ban().getAttribute('aria-pressed')).toBe('false')

    await fireEvent.click(ban())
    expect(bans.has(target.id)).toBe(true)
    expect(ban().getAttribute('aria-pressed')).toBe('true')

    await fireEvent.click(ban())
    expect(bans.has(target.id)).toBe(false)
  })

  it('marks a hero as one you main', async () => {
    const target = junglers[0]
    const { container } = render(PoolScreen, props)

    await fireEvent.click(pill(container, target.hero_name, 'main'))
    expect(signatures.has(target.id)).toBe(true)
    expect(pill(container, target.hero_name, 'main').getAttribute('aria-pressed')).toBe('true')

    await fireEvent.click(pill(container, target.hero_name, 'main'))
    expect(signatures.has(target.id)).toBe(false)
  })

  // A hero you main is not a hero you refuse to play, so the two states
  // replace each other rather than stacking.
  it('never lets a hero be a main and a ban at once', async () => {
    const target = junglers[0]
    const { container } = render(PoolScreen, props)

    await fireEvent.click(pill(container, target.hero_name, 'main'))
    await fireEvent.click(pill(container, target.hero_name, 'ban'))

    expect(bans.has(target.id)).toBe(true)
    expect(signatures.has(target.id)).toBe(false)

    await fireEvent.click(pill(container, target.hero_name, 'main'))
    expect(signatures.has(target.id)).toBe(true)
    expect(bans.has(target.id)).toBe(false)
  })

  it('counts both lists and clears both', async () => {
    const { container } = render(PoolScreen, props)
    const counts = () => textOf(container, '.tally-count')

    expect(screen.queryByRole('button', { name: 'CLEAR' })).toBeNull()
    expect(counts()).toEqual(['0', '0'])

    await fireEvent.click(pill(container, junglers[0].hero_name, 'main'))
    await fireEvent.click(pill(container, junglers[1].hero_name, 'ban'))
    await fireEvent.click(pill(container, junglers[2].hero_name, 'ban'))
    expect(counts()).toEqual(['1', '2'])

    await fireEvent.click(screen.getByRole('button', { name: 'CLEAR' }))
    expect(bans.size).toBe(0)
    expect(signatures.size).toBe(0)
    expect(screen.queryByRole('button', { name: 'CLEAR' })).toBeNull()
  })

  it('goes back to the draft', async () => {
    const onClose = vi.fn()
    render(PoolScreen, { ...props, onClose })

    await fireEvent.click(screen.getByRole('button', { name: 'DRAFT' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
