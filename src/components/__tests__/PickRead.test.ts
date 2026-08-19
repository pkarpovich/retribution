import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/svelte'
import PickRead from '../PickRead.svelte'
import type { PickReadout } from '../../utils/presentation'
import { byName, textOf } from './fixtures'

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

describe('PickRead', () => {
  it('renders all four groups with their heroes', () => {
    const { container } = render(PickRead, { readout: full })

    expect(textOf(container, '.group.taken .row-name')).toEqual(['Natan'])
    expect(textOf(container, '.group.beaten .row-name')).toEqual(['Masha'])
    expect(textOf(container, '.group.works .row-name')).toEqual(['Angela'])
    expect(textOf(container, '.group.live .row-name')).toEqual(['Ling'])
    expect(textOf(container, '.kicker')).toContain('AGAINST THIS BOARD')
    expect(textOf(container, '.group.live .kicker')).toContain('3 slots open')
  })

  it('tags a taken row with its severity', () => {
    const { container } = render(PickRead, {
      readout: readout({
        taken: [
          { hero: natan, severity: 'HIGH' },
          { hero: ling, severity: 'MEDIUM' },
        ],
      }),
    })

    expect(textOf(container, '.severity')).toEqual(['HIGH', 'MEDIUM'])
    expect(container.querySelector('.severity')?.getAttribute('data-severity')).toBe('HIGH')
  })

  it('leaves out a group with nothing in it', () => {
    const { container } = render(PickRead, {
      readout: readout({ index: 37, beaten: [masha] }),
    })

    expect(container.querySelector('.group.beaten')).toBeTruthy()
    expect(container.querySelector('.group.taken')).toBeNull()
    expect(container.querySelector('.group.works')).toBeNull()
    expect(container.querySelector('.group.live')).toBeNull()
    expect(container.querySelector('.flat')).toBeNull()
  })

  it('falls back to one line when nothing on their board cuts either way', () => {
    const { container } = render(PickRead, {
      readout: readout({ worksWith: [angela], live: [ling], openSlots: 1 }),
    })

    expect(container.querySelector('.flat')?.textContent?.trim())
      .toBe('Nothing on their board cuts either way.')
    expect(container.querySelector('.group.taken')).toBeNull()
    expect(container.querySelector('.group.beaten')).toBeNull()
    expect(textOf(container, '.group.works .row-name')).toEqual(['Angela'])
    expect(textOf(container, '.group.live .row-name')).toEqual(['Ling'])
    expect(textOf(container, '.group.live .kicker')).toContain('1 slot open')
  })

  it('reads 0 with the first two groups empty when no enemy is revealed', () => {
    const { container } = render(PickRead, { readout: blank })

    expect(container.querySelector('.index')?.textContent).toBe('+0')
    expect(container.querySelector('.flat')).toBeTruthy()
    expect(container.querySelector('.delta')).toBeNull()
  })

  it('hides the delta without a baseline and prints +0 when nothing moved', () => {
    const without = render(PickRead, { readout: readout({ index: -31, sinceLock: null }) })
    expect(without.container.querySelector('.delta')).toBeNull()

    const held = render(PickRead, { readout: readout({ index: -31, sinceLock: 0 }) })
    expect(held.container.querySelector('.delta')?.textContent?.trim()).toBe('+0 since lock')
  })

  it('renders the widest index and the widest delta in full', () => {
    const { container } = render(PickRead, { readout: readout({ index: -139.8, sinceLock: -218.6 }) })

    expect(container.querySelector('.index')?.textContent).toBe('-140')
    expect(container.querySelector('.delta')?.textContent?.trim()).toBe('-219 since lock')
  })

  it('tones the index by its sign', () => {
    const down = render(PickRead, { readout: readout({ index: -31 }) })
    expect(down.container.querySelector('.index')?.getAttribute('data-tone')).toBe('neg')

    const up = render(PickRead, { readout: readout({ index: 37 }) })
    expect(up.container.querySelector('.index')?.getAttribute('data-tone')).toBe('pos')

    const flat = render(PickRead, { readout: blank })
    expect(flat.container.querySelector('.index')?.getAttribute('data-tone')).toBe('flat')
  })

  // Taking the sign off the unrounded value and the magnitude off the rounded
  // one prints "-0" for anything in (-0.5, 0), in the colour that means the
  // draft turned against you - on a panel where +0 means nothing has moved.
  it('reads a hair below zero as flat, not as a negative', () => {
    const { container } = render(PickRead, { readout: readout({ index: -0.064, sinceLock: -0.49 }) })

    expect(container.querySelector('.index')?.textContent).toBe('+0')
    expect(container.querySelector('.index')?.getAttribute('data-tone')).toBe('flat')
    expect(container.querySelector('.delta')?.textContent?.trim()).toBe('+0 since lock')
  })

  it('says the number reads the enemy board only', () => {
    const { container } = render(PickRead, { readout: full })

    expect(container.querySelector('.scope')?.textContent?.trim())
      .toBe('Reads their side only - an ally never moves this number.')
  })
})
