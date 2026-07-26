import { describe, it, expect, beforeEach } from 'vitest'
import { tick } from 'svelte'
import { render, screen, fireEvent } from '@testing-library/svelte'
import App from '../App.svelte'
import { bans, signatures } from '../lib/pool.svelte'
import { matches } from '../lib/matches.svelte'
import { heroes, textOf } from '../components/__tests__/fixtures'

const cells = (root: ParentNode) => [...root.querySelectorAll('.cell')] as HTMLButtonElement[]

async function draft(root: ParentNode, times: number) {
  for (let i = 0; i < times; i++) await fireEvent.click(cells(root)[0])
}

beforeEach(() => {
  bans.clear()
  signatures.clear()
  matches.clear()
  localStorage.clear()
})

describe('App draft', () => {
  it('counts both teams and the jungle pick against ten slots', async () => {
    const { container } = render(App)
    expect(screen.getByText('0/10')).toBeTruthy()

    await draft(container, 3)
    expect(screen.getByText('3/10')).toBeTruthy()

    await fireEvent.click(screen.getByRole('button', { name: 'LOCK THIS PICK' }))
    expect(screen.getByText('4/10')).toBeTruthy()
  })

  it('stops at five enemies and says why', async () => {
    const { container } = render(App)

    await draft(container, 5)
    expect(container.querySelectorAll('.slot.filled')).toHaveLength(5)
    expect(screen.queryByRole('status')).toBeNull()

    await draft(container, 1)
    expect(container.querySelectorAll('.slot.filled')).toHaveLength(5)
    expect(screen.getByRole('status').textContent).toBe('Enemy slots full')
  })

  it('stops at four allies and says why', async () => {
    const { container } = render(App)
    await fireEvent.click(screen.getByRole('tab', { name: 'Add ally' }))

    await draft(container, 4)
    expect(container.querySelectorAll('.slot.filled')).toHaveLength(4)

    await draft(container, 1)
    expect(container.querySelectorAll('.slot.filled')).toHaveLength(4)
    expect(screen.getByRole('status').textContent).toBe('Ally slots full')
  })

  it('keeps a drafted hero out of the roster and puts it back on removal', async () => {
    const { container } = render(App)
    const taken = cells(container)[0].textContent?.trim()

    await draft(container, 1)
    expect(textOf(container, '.cell-name')).not.toContain(taken)

    await fireEvent.click(container.querySelector('.slot.filled')!)
    expect(textOf(container, '.cell-name')).toContain(taken)
  })

  it('clears the board on reset', async () => {
    const { container } = render(App)
    expect(screen.queryByRole('button', { name: 'RESET' })).toBeNull()

    await draft(container, 2)
    await fireEvent.click(screen.getByRole('button', { name: 'RESET' }))

    expect(screen.getByText('0/10')).toBeTruthy()
    expect(container.querySelectorAll('.slot.filled')).toHaveLength(0)
    expect(screen.getByText('Start with the enemy team')).toBeTruthy()
  })
})

describe('App draft persistence', () => {
  // The board is rebuilt by hand under a pick timer, so losing it to an OS
  // eviction is the expensive failure.
  it('brings the board back when the app is dropped and reopened', async () => {
    const first = render(App)
    await draft(first.container, 2)
    await fireEvent.click(screen.getByRole('button', { name: 'LOCK THIS PICK' }))
    const taken = textOf(first.container, '.slot.filled')
    first.unmount()

    const second = render(App)
    expect(second.container.querySelectorAll('.slot.filled')).toHaveLength(3)
    expect(textOf(second.container, '.slot.filled')).toEqual(taken)
    expect(screen.getByText('YOUR JUNGLE PICK')).toBeTruthy()
  })

  it('keeps the side you were drafting for', async () => {
    const first = render(App)
    await fireEvent.click(screen.getByRole('tab', { name: 'Ban' }))
    first.unmount()

    render(App)
    expect(screen.getByRole('tab', { name: 'Ban' }).getAttribute('aria-selected')).toBe('true')
  })

  it('does not bring back a board that was reset', async () => {
    const first = render(App)
    await draft(first.container, 2)
    await fireEvent.click(screen.getByRole('button', { name: 'RESET' }))
    first.unmount()

    const second = render(App)
    expect(second.container.querySelectorAll('.slot.filled')).toHaveLength(0)
  })
})

describe('App match log', () => {
  it('writes down the draft and what the engine said when a pick is locked', async () => {
    const { container } = render(App)
    await draft(container, 2)

    const suggested = container.querySelector('.card .name')?.textContent
    await fireEvent.click(screen.getByRole('button', { name: 'LOCK THIS PICK' }))

    const record = matches.pending!
    expect(record.pick.name).toBe(suggested)
    expect(record.rank).toBe(1)
    expect(record.followedAdvice).toBe(true)
    expect(record.enemies).toHaveLength(2)
    expect(record.breakdown.base).toBeGreaterThan(0)
    expect(record.build.boots).toBeTruthy()
    expect(record.dataVersion).toBeTruthy()
  })

  it('records that the advice was overridden when it was', async () => {
    const { container } = render(App)
    await draft(container, 2)

    const rows = [...container.querySelectorAll('.row')]
    await fireEvent.click(rows[2])
    await fireEvent.click(screen.getByRole('button', { name: 'LOCK THIS PICK' }))

    expect(matches.pending!.rank).toBe(3)
    expect(matches.pending!.followedAdvice).toBe(false)
    expect(matches.pending!.top!.name).not.toBe(matches.pending!.pick.name)
  })

  it('leaves one open game after changing the pick, not two', async () => {
    const { container } = render(App)
    await draft(container, 2)

    await fireEvent.click(screen.getByRole('button', { name: 'LOCK THIS PICK' }))
    await fireEvent.click(screen.getByRole('button', { name: 'CHANGE' }))
    await fireEvent.click(screen.getByRole('button', { name: 'LOCK THIS PICK' }))

    expect(matches.all).toHaveLength(1)
  })

  // The result lands fifteen minutes after the draft is cleared.
  it('keeps the open game across a reset and settles it from the banner', async () => {
    const { container } = render(App)
    await draft(container, 2)
    await fireEvent.click(screen.getByRole('button', { name: 'LOCK THIS PICK' }))
    await fireEvent.click(screen.getByRole('button', { name: 'RESET' }))

    expect(matches.pending).toBeTruthy()
    expect(screen.getByText('HOW DID IT GO')).toBeTruthy()

    await fireEvent.click(screen.getByRole('button', { name: 'WON' }))
    expect(matches.pending).toBeNull()
    expect(matches.all[0].outcome).toBe('won')
    expect(container.querySelector('.banner')).toBeNull()
  })

  it('discards a game that should not have been logged', async () => {
    const { container } = render(App)
    await draft(container, 2)
    await fireEvent.click(screen.getByRole('button', { name: 'LOCK THIS PICK' }))

    await fireEvent.click(screen.getByRole('button', { name: 'Discard this game without a result' }))
    expect(matches.all).toEqual([])
    expect(container.querySelector('.banner')).toBeNull()
  })

  it('opens the log from the header and closes it again', async () => {
    render(App)

    await fireEvent.click(screen.getByRole('button', { name: 'Your games' }))
    expect(screen.getByText(/Nothing logged yet/)).toBeTruthy()

    await fireEvent.click(screen.getByRole('button', { name: 'DRAFT' }))
    expect(screen.queryByText(/Nothing logged yet/)).toBeNull()
  })
})

describe('App reopening a logged game', () => {
  it('puts the draft back on the board and scores it again', async () => {
    const first = render(App)
    await draft(first.container, 3)
    const board = textOf(first.container, '.slot.filled')
    await fireEvent.click(screen.getByRole('button', { name: 'LOCK THIS PICK' }))
    const taken = matches.pending!.pick.name

    await fireEvent.click(screen.getByRole('button', { name: 'RESET' }))
    expect(first.container.querySelectorAll('.slot.filled')).toHaveLength(0)

    await fireEvent.click(screen.getByRole('button', { name: /Your games/ }))
    await fireEvent.click(screen.getByRole('button', { name: /OPEN DRAFT/ }))

    expect(screen.queryByText(/Nothing logged yet/)).toBeNull()
    expect(textOf(first.container, '.slot.filled')).toEqual(board)
    expect(screen.getByRole('status').textContent).toBe(`Reopened the draft you took ${taken} into`)
  })

  // The point of reopening is to read where that hero stands now, which needs
  // it back among the candidates rather than locked out of them.
  it('leaves the pick unlocked so it can be scored alongside the rest', async () => {
    const first = render(App)
    await draft(first.container, 2)
    await fireEvent.click(screen.getByRole('button', { name: 'LOCK THIS PICK' }))
    const taken = matches.pending!.pick.name

    await fireEvent.click(screen.getByRole('button', { name: /Your games/ }))
    await fireEvent.click(screen.getByRole('button', { name: /OPEN DRAFT/ }))

    expect(screen.queryByText('YOUR JUNGLE PICK')).toBeNull()
    expect(textOf(first.container, '.row-name')).toContain(taken)
  })
})

describe('App match bans', () => {
  it('takes a hero off the board from the ban side of the roster', async () => {
    const { container } = render(App)
    await fireEvent.click(screen.getByRole('tab', { name: 'Ban' }))

    const target = cells(container)[0].textContent?.trim()
    await fireEvent.click(cells(container)[0])

    expect(container.querySelector('.ban-strip .tally')?.textContent).toBe('1')
    expect(textOf(container, '.cell-name')).not.toContain(target)
  })

  // The case that started this: a jungler in the suggestions is banned in the
  // match, one tap takes it out and the rest are scored again without it.
  it('bans the suggested jungler in one tap and drops it from the list', async () => {
    const { container } = render(App)
    await draft(container, 2)

    const suggested = container.querySelector('.card .name')?.textContent
    await fireEvent.click(screen.getByRole('button', { name: `Ban ${suggested} for this match` }))

    expect(screen.getByRole('status').textContent).toBe(`${suggested} banned this match`)
    expect(textOf(container, '.row-name')).not.toContain(suggested)
    expect(container.querySelector('.card .name')?.textContent).not.toBe(suggested)
  })

  it('lifts a ban entered by mistake', async () => {
    const { container } = render(App)
    await fireEvent.click(screen.getByRole('tab', { name: 'Ban' }))

    const target = cells(container)[0].textContent?.trim()
    await fireEvent.click(cells(container)[0])
    await fireEvent.click(container.querySelector('.ban-strip .slot')!)

    expect(container.querySelector('.ban-strip')).toBeNull()
    expect(textOf(container, '.cell-name')).toContain(target)
  })

  it('clears match bans on reset', async () => {
    const { container } = render(App)
    await fireEvent.click(screen.getByRole('tab', { name: 'Ban' }))
    await fireEvent.click(cells(container)[0])

    await fireEvent.click(screen.getByRole('tab', { name: 'Add enemy' }))
    await draft(container, 1)
    await fireEvent.click(screen.getByRole('button', { name: 'RESET' }))

    expect(container.querySelector('.ban-strip')).toBeNull()
  })
})

describe('App pool', () => {
  it('hides banned heroes from the roster and accounts for them', () => {
    bans.toggle(heroes[0].id)
    bans.toggle(heroes[1].id)

    const { container } = render(App)
    const listed = textOf(container, '.cell-name')

    expect(listed).not.toContain(heroes[0].hero_name)
    expect(listed).not.toContain(heroes[1].hero_name)
    expect(screen.getByRole('button', { name: '2 heroes hidden by bans' })).toBeTruthy()
  })

  // A ban symbol carrying the sum said "3 banned" when it was two mains and
  // one ban. The counts are separate, and so are their colours.
  it('never lets the header add mains and bans into one number', async () => {
    const { container } = render(App)

    signatures.toggle(heroes[0].id)
    signatures.toggle(heroes[1].id)
    bans.toggle(heroes[2].id)
    await tick()

    expect(container.querySelector('.pool .badge.main')?.textContent).toBe('2')
    expect(container.querySelector('.pool .badge.banned')?.textContent).toBe('1')
    expect(textOf(container, '.pool .badge')).not.toContain('3')
  })

  it('shows only the count that exists', async () => {
    const { container } = render(App)

    signatures.toggle(heroes[0].id)
    await tick()

    expect(container.querySelector('.pool .badge.main')).toBeTruthy()
    expect(container.querySelector('.pool .badge.banned')).toBeNull()
  })

  it('reads both lists out on the header button instead of leaving a bare badge', async () => {
    render(App)
    expect(screen.getByRole('button', { name: 'Your pool' })).toBeTruthy()

    bans.toggle(heroes[0].id)
    signatures.toggle(heroes[1].id)
    await tick()
    expect(screen.getByRole('button', { name: 'Your pool, 1 main and 1 banned' })).toBeTruthy()
  })

  it('opens the ban list from the roster note and closes it again', async () => {
    bans.toggle(heroes[0].id)
    render(App)

    await fireEvent.click(screen.getByRole('button', { name: '1 hero hidden by bans' }))
    expect(screen.getByText('Your pool')).toBeTruthy()

    await fireEvent.click(screen.getByRole('button', { name: 'DRAFT' }))
    expect(screen.queryByText('Your pool')).toBeNull()
  })
})
