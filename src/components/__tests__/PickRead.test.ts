import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'
import PickRead from '../PickRead.svelte'
import type { PickReadout } from '../../utils/presentation'
import { byName, textOf } from './fixtures'

const sun = byName('Sun')
const natan = byName('Natan')
const masha = byName('Masha')
const angela = byName('Angela')
const ling = byName('Ling')

const blank: PickReadout = {
  index: 0,
  sinceLock: null,
  taken: [],
  beaten: [],
  worksWith: [],
  live: [],
  openSlots: 5,
}

const readout = (patch: Partial<PickReadout>): PickReadout => ({ ...blank, ...patch })

const full = readout({
  index: -31,
  sinceLock: -68,
  taken: [{ hero: natan, severity: 'HIGH' }],
  beaten: [masha],
  worksWith: [angela],
  live: [ling],
  openSlots: 3,
})

const mount = (value: PickReadout | null, onUnlock = () => {}) =>
  render(PickRead, { pick: sun, readout: value, onUnlock })

const lines = (root: ParentNode) =>
  [...root.querySelectorAll('.line')].map(line => textOf(line, '.chip-name'))

describe('PickRead', () => {
  it('carries the pick identity and the figure in one card', () => {
    const { container } = mount(full)

    expect(textOf(container, '.serif')).toEqual(['Sun'])
    expect(container.querySelector('.kicker')?.textContent).toBe('YOUR JUNGLE PICK')
    expect(container.querySelector('.index')?.textContent).toBe('-31')
    expect(screen.getByRole('button', { name: 'CHANGE' })).toBeTruthy()
  })

  it('hands the pick back when CHANGE is tapped', async () => {
    const onUnlock = vi.fn()
    mount(full, onUnlock)

    await fireEvent.click(screen.getByRole('button', { name: 'CHANGE' }))
    expect(onUnlock).toHaveBeenCalledOnce()
  })

  it('names what is on their board, and nothing about your own team', () => {
    const { container } = mount(full)

    expect(lines(container)).toEqual([['Natan'], ['Masha'], ['Ling']])
    expect(textOf(container, '.said')).toEqual(['took your edge', 'you beat'])
    expect(textOf(container, '.count')).toEqual(['3 enemy slots open'])
    expect(textOf(container, '.chip-name')).not.toContain('Angela')
  })

  it('tags a taken chip with its severity', () => {
    const { container } = mount(readout({
      taken: [
        { hero: natan, severity: 'HIGH' },
        { hero: ling, severity: 'MEDIUM' },
      ],
    }))

    expect(textOf(container, '.flag')).toEqual(['HIGH', 'MEDIUM'])
    expect(container.querySelector('.flag')?.getAttribute('data-severity')).toBe('HIGH')
  })

  it('draws what they can still take as a dashed row', () => {
    const { container } = mount(readout({ live: [ling], openSlots: 1 }))

    expect(container.querySelector('.chip.dim .chip-name')?.textContent).toBe('Ling')
    expect(textOf(container, '.count')).toEqual(['1 enemy slot open'])
  })

  it('leaves out a line with nothing in it', () => {
    const { container } = mount(readout({ index: 37, beaten: [masha] }))

    expect(lines(container)).toEqual([['Masha']])
    expect(container.querySelector('.flat')).toBeNull()
  })

  it('falls back to one line when nothing on their board cuts either way', () => {
    const { container } = mount(readout({ worksWith: [angela], live: [ling], openSlots: 1 }))

    expect(container.querySelector('.flat')?.textContent?.trim())
      .toBe('Nothing on their board cuts either way.')
    expect(lines(container)).toEqual([['Ling']])
  })

  it('reads 0 with nothing named when no enemy is revealed', () => {
    const { container } = mount(blank)

    expect(container.querySelector('.index')?.textContent).toBe('+0')
    expect(container.querySelector('.flat')).toBeTruthy()
  })

  it('names the delta only when it differs from the figure', () => {
    const alone = mount(readout({ index: -31, sinceLock: null }))
    expect(alone.container.querySelector('.note')?.textContent?.trim()).toBe('vs their board')

    const same = mount(readout({ index: -31, sinceLock: -31 }))
    expect(same.container.querySelector('.note')?.textContent?.trim()).toBe('vs their board')

    const moved = mount(readout({ index: -31, sinceLock: 0 }))
    expect(moved.container.querySelector('.note')?.textContent?.trim()).toBe('+0 since lock')
  })

  it('renders the widest index and the widest delta in full', () => {
    const { container } = mount(readout({ index: -139.8, sinceLock: -218.6 }))

    expect(container.querySelector('.index')?.textContent).toBe('-140')
    expect(container.querySelector('.note')?.textContent?.trim()).toBe('-219 since lock')
  })

  it('tones the index by its sign', () => {
    const down = mount(readout({ index: -31 }))
    expect(down.container.querySelector('.index')?.getAttribute('data-tone')).toBe('neg')

    const up = mount(readout({ index: 37 }))
    expect(up.container.querySelector('.index')?.getAttribute('data-tone')).toBe('pos')

    const flat = mount(blank)
    expect(flat.container.querySelector('.index')?.getAttribute('data-tone')).toBe('flat')
  })

  it('reads a hair below zero as flat, not as a negative', () => {
    const { container } = mount(readout({ index: -0.064, sinceLock: -0.49 }))

    expect(container.querySelector('.index')?.textContent).toBe('+0')
    expect(container.querySelector('.index')?.getAttribute('data-tone')).toBe('flat')
  })

  it('keeps the identity and the CHANGE button without a readout', () => {
    const { container } = mount(null)

    expect(textOf(container, '.serif')).toEqual(['Sun'])
    expect(screen.getByRole('button', { name: 'CHANGE' })).toBeTruthy()
    expect(container.querySelector('.index')).toBeNull()
  })
})
