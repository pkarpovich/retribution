import { describe, it, expect, beforeEach } from 'vitest'
import { tick } from 'svelte'
import { render, screen, fireEvent } from '@testing-library/svelte'
import App from '../App.svelte'
import { bans, signatures } from '../lib/pool.svelte'
import { matches } from '../lib/matches.svelte'
import { byName, heroes, textOf } from '../components/__tests__/fixtures'

const cells = (root: ParentNode) => [...root.querySelectorAll('.cell')] as HTMLButtonElement[]

const cellFor = (root: ParentNode, name: string) =>
  cells(root).find(cell => cell.querySelector('.cell-name')?.textContent?.trim() === name)!

const shortlist = (root: ParentNode) =>
  [...root.querySelectorAll('.axis-line .dot')]
    .map(dot => dot.getAttribute('aria-label')?.replace(/, fit .*$/, '') ?? '')

const route = (name: RegExp) => fireEvent.click(screen.getByRole('button', { name }))

const send = async (cell: HTMLElement, to: RegExp) => {
  await fireEvent.click(cell)
  await route(to)
}

const AS_ENEMY = /Add as enemy/
const AS_ALLY = /Add as ally/
const AS_JUNGLE = /Your jungle pick/
const AS_BAN = /Ban this match/

async function draft(root: ParentNode, times: number) {
  for (let i = 0; i < times; i++) await send(cells(root)[0], AS_ENEMY)
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

  it('closes the enemy side once its five slots are gone', async () => {
    const { container } = render(App)

    await draft(container, 5)
    expect(container.querySelectorAll('.slot.filled')).toHaveLength(5)

    await fireEvent.click(cells(container)[0])
    expect(screen.getByRole("button", { name: AS_ENEMY }).hasAttribute("disabled")).toBe(true)
    expect(screen.getByRole("button", { name: AS_ALLY }).hasAttribute("disabled")).toBe(false)
  })

  it('closes the ally side once its four slots are gone', async () => {
    const { container } = render(App)

    for (let i = 0; i < 4; i++) await send(cells(container)[0], AS_ALLY)
    expect(container.querySelectorAll('.slot.filled')).toHaveLength(4)

    await fireEvent.click(cells(container)[0])
    expect(screen.getByRole("button", { name: AS_ALLY }).hasAttribute("disabled")).toBe(true)
    expect(screen.getByRole("button", { name: AS_ENEMY }).hasAttribute("disabled")).toBe(false)
  })

  it('empties the search once the hero has somewhere to go, but not when the sheet is dismissed', async () => {
    const { container } = render(App)
    const search = screen.getByLabelText('Search heroes') as HTMLInputElement

    await fireEvent.input(search, { target: { value: 'Ling' } })
    await fireEvent.click(cellFor(container, 'Ling'))
    await fireEvent.click(screen.getByRole('button', { name: 'CANCEL' }))
    expect(search.value).toBe('Ling')

    await send(cellFor(container, 'Ling'), AS_ENEMY)
    expect(search.value).toBe('')
    expect(textOf(container, '.cell-name').length).toBeGreaterThan(1)
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
    expect(screen.getByText('Add their team, or take the jungle now')).toBeTruthy()
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
  it('keeps the open game across a reset and settles it from the empty board', async () => {
    const { container } = render(App)
    await draft(container, 2)
    await fireEvent.click(screen.getByRole('button', { name: 'LOCK THIS PICK' }))
    await fireEvent.click(screen.getByRole('button', { name: 'RESET' }))

    expect(matches.pending).toBeTruthy()
    expect(screen.getByText('LAST GAME · UNLOGGED')).toBeTruthy()

    await fireEvent.click(screen.getByRole('button', { name: 'WON' }))
    expect(matches.pending).toBeNull()
    expect(matches.all[0].outcome).toBe('won')
    expect(container.querySelector('.unlogged')).toBeNull()
  })

  it('asks about the last game only on an empty board, and marks the header until then', async () => {
    const { container } = render(App)
    await draft(container, 2)
    await fireEvent.click(screen.getByRole('button', { name: 'LOCK THIS PICK' }))

    expect(container.querySelector('.unlogged')).toBeNull()
    expect(container.querySelector('.bar .dot')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Your games, one waiting on a result' })).toBeTruthy()

    await fireEvent.click(screen.getByRole('button', { name: 'RESET' }))
    expect(container.querySelector('.unlogged')).toBeTruthy()
  })

  it('discards a game that should not have been logged', async () => {
    const { container } = render(App)
    await draft(container, 2)
    await fireEvent.click(screen.getByRole('button', { name: 'LOCK THIS PICK' }))
    await fireEvent.click(screen.getByRole('button', { name: 'RESET' }))

    await fireEvent.click(screen.getByRole('button', { name: 'Discard this game without a result' }))
    expect(matches.all).toEqual([])
    expect(container.querySelector('.unlogged')).toBeNull()
    expect(container.querySelector('.bar .dot')).toBeNull()
  })

  it('opens the log from the header and closes it again', async () => {
    render(App)

    await fireEvent.click(screen.getByRole('button', { name: 'Your games' }))
    expect(screen.getByText(/Nothing logged yet/)).toBeTruthy()

    await fireEvent.click(screen.getByRole('button', { name: 'DRAFT' }))
    expect(screen.queryByText(/Nothing logged yet/)).toBeNull()
  })
})

describe('App pick readout', () => {
  it('measures the delta against the enemies revealed at the lock, not against an empty board', async () => {
    const { container } = render(App)

    await send(cellFor(container, 'Gord'), AS_ENEMY)

    const rows = [...container.querySelectorAll('.row')] as HTMLElement[]
    const ling = rows.find(row => row.querySelector('.row-name')?.textContent?.trim() === 'Ling')!
    await fireEvent.click(ling)
    await fireEvent.click(screen.getByRole('button', { name: 'LOCK THIS PICK' }))

    expect(matches.pending!.pick.name).toBe('Ling')
    expect(matches.pending!.enemies.map(enemy => enemy.name)).toEqual(['Gord'])

    const read = container.querySelector('.live')!
    expect(read.querySelector('.index')?.textContent).not.toBe('+0')
    expect(read.querySelector('.note')?.textContent?.trim()).toBe('+0 since lock')
  })
})

describe('App enemy read', () => {
  it('sits on its own until a pick is locked, then folds into the card', async () => {
    const { container } = render(App)
    await draft(container, 2)

    expect(container.querySelector('.peek')).toBeTruthy()
    expect(container.querySelector('.live .peek')).toBeNull()

    await fireEvent.click(screen.getByRole('button', { name: 'LOCK THIS PICK' }))

    expect(container.querySelector('.live .peek')).toBeTruthy()
    expect(container.querySelectorAll('.peek')).toHaveLength(1)
  })

  it('opens the full read from inside the card', async () => {
    const { container } = render(App)
    await draft(container, 2)
    await fireEvent.click(screen.getByRole('button', { name: 'LOCK THIS PICK' }))

    await fireEvent.click(container.querySelector('.live .peek')!)

    expect(container.querySelector('.live .full')).toBeTruthy()
    expect(screen.getByText('THEIR TEAM')).toBeTruthy()
  })
})

describe('App reading a blind pick as the enemies reveal', () => {
  const reading = (root: ParentNode) => {
    const read = root.querySelector('.live')!
    return [
      read.querySelector('.index')?.textContent,
      read.querySelector('.note')?.textContent?.trim(),
    ]
  }

  it('moves only on the priced reveals and holds exactly still on the rest', async () => {
    const { container } = render(App)

    await send(cellFor(container, 'Sun'), AS_JUNGLE)
    expect(reading(container)).toEqual(['+0', 'vs their board'])

    await send(cellFor(container, 'Gord'), AS_ENEMY)
    expect(reading(container)).toEqual(['+0', 'vs their board'])

    await send(cellFor(container, 'Masha'), AS_ENEMY)
    expect(reading(container)).toEqual(['+37', 'vs their board'])

    await send(cellFor(container, 'Natan'), AS_ENEMY)
    expect(reading(container)).toEqual(['-31', 'vs their board'])

    await send(cellFor(container, 'Miya'), AS_ENEMY)
    expect(reading(container)).toEqual(['-31', 'vs their board'])

    await send(cellFor(container, 'Hanabi'), AS_ENEMY)
    expect(reading(container)).toEqual(['-31', 'vs their board'])
  })

  it('keeps an ally it works with off the board card, and names it in the plan', async () => {
    const { container } = render(App)

    await send(cellFor(container, 'Sun'), AS_JUNGLE)
    await send(cellFor(container, 'Masha'), AS_ENEMY)
    const before = reading(container)

    await send(cellFor(container, 'Akai'), AS_ALLY)

    expect(textOf(container, '.live .chip-name')).not.toContain('Akai')
    expect(reading(container)).toEqual(before)

    await fireEvent.click(container.querySelector('.plan')!)
    expect(screen.getByText('WORKS WITH YOU')).toBeTruthy()
    expect(textOf(container, '.sheet .chip-name')).toContain('Akai')
  })

  it('names the counter with its severity as the index falls', async () => {
    const { container } = render(App)
    const taken = () => container.querySelector('.live [data-kind="taken"]')

    await send(cellFor(container, 'Sun'), AS_JUNGLE)

    await send(cellFor(container, 'Gord'), AS_ENEMY)
    expect(taken()).toBeNull()
    expect(screen.getByText('Nothing on their board cuts either way.')).toBeTruthy()

    await send(cellFor(container, 'Masha'), AS_ENEMY)
    expect(textOf(container, '.live [data-kind="beaten"] .chip-name')).toEqual(['Masha'])
    expect(taken()).toBeNull()

    await send(cellFor(container, 'Natan'), AS_ENEMY)
    expect(textOf(container, '.live [data-kind="taken"] .chip-name')).toEqual(['Natan'])
    expect(textOf(container, '.live [data-kind="taken"] .flag')).toEqual(['HIGH'])
    expect(reading(container)).toEqual(['-31', 'vs their board'])
    expect(screen.queryByText('Nothing on their board cuts either way.')).toBeNull()
  })
})

describe('App picking outside the suggestions', () => {
  it('reads the pick from the moment it is marked, before any enemy is revealed', async () => {
    const { container } = render(App)

    await send(cellFor(container, 'Ling'), AS_JUNGLE)

    const read = container.querySelector('.live')!
    expect(read).toBeTruthy()
    expect(read.querySelector('.index')?.textContent).toBe('+0')
    expect(screen.queryByText('Add their team, or take the jungle now')).toBeNull()
  })

  it('writes a blind record when there was no advice on screen to agree with', async () => {
    const { container } = render(App)

    await send(cellFor(container, 'Ling'), AS_JUNGLE)

    const record = matches.pending!
    expect(record.pick.name).toBe('Ling')
    expect(record.rank).toBeNull()
    expect(record.shown).toBe(0)
    expect(record.top).toBeNull()
    expect(record.followedAdvice).toBe(false)
    expect(record.breakdown.base).toBeGreaterThan(0)
    expect(record.build.boots).toBeTruthy()
  })

  it('records a hero taken while advice was on screen as sitting below the list', async () => {
    const { container } = render(App)
    await draft(container, 2)

    const listed = textOf(container, '.row-name')
    const top = container.querySelector('.card .name')?.textContent
    const outside = textOf(container, '.cell-name').find(name => !listed.includes(name))!

    await send(cellFor(container, outside), AS_JUNGLE)

    const record = matches.pending!
    expect(record.pick.name).toBe(outside)
    expect(record.shown).toBe(listed.length)
    expect(record.rank).toBe(record.shown + 1)
    expect(record.followedAdvice).toBe(false)
    expect(record.top!.name).toBe(top)
  })

  it('leaves a pick locked from a suggestion card exactly as it was', async () => {
    const { container } = render(App)
    await draft(container, 2)

    const rows = [...container.querySelectorAll('.row')]
    const shown = rows.length
    const top = container.querySelector('.card .name')?.textContent

    await fireEvent.click(rows[2])
    const taken = container.querySelector('.card .name')?.textContent
    await fireEvent.click(screen.getByRole('button', { name: 'LOCK THIS PICK' }))

    const record = matches.pending!
    expect(record.pick.name).toBe(taken)
    expect(record.rank).toBe(3)
    expect(record.shown).toBe(shown)
    expect(record.followedAdvice).toBe(false)
    expect(record.top!.name).toBe(top)
  })

  it('leaves a locked pick alone when the next tap goes to the enemy team', async () => {
    const { container } = render(App)
    await draft(container, 2)

    await fireEvent.click(screen.getByRole('button', { name: 'LOCK THIS PICK' }))
    const locked = matches.pending!.pick.name

    await send(cells(container)[0], AS_ENEMY)

    expect(matches.pending!.pick.name).toBe(locked)
    expect(container.querySelectorAll('.side')[1].querySelectorAll('.slot.filled')).toHaveLength(3)
  })

  it('marks a pick blind when allies are on the board but no enemy is', async () => {
    const { container } = render(App)
    await send(cells(container)[0], AS_ALLY)

    await send(cellFor(container, 'Ling'), AS_JUNGLE)

    const record = matches.pending!
    expect(record.allies).toHaveLength(1)
    expect(record.rank).toBeNull()
    expect(record.shown).toBe(0)
    expect(record.top).toBeNull()
  })
})

describe('App marking your own hero', () => {
  it('takes a hero from the roster into the jungle slot without touching the enemy team', async () => {
    const { container } = render(App)

    await send(cellFor(container, 'Ling'), AS_JUNGLE)

    expect(screen.getByRole('button', { name: 'Clear your jungle pick' })).toBeTruthy()
    expect(container.querySelectorAll('.slot.filled')).toHaveLength(1)
    expect(screen.getByText('1/10')).toBeTruthy()
  })

  it('leaves the board alone when the sheet is dismissed', async () => {
    const { container } = render(App)

    await fireEvent.click(cellFor(container, 'Ling'))
    await fireEvent.click(screen.getByRole('button', { name: 'CANCEL' }))

    expect(screen.queryByRole('button', { name: 'Clear your jungle pick' })).toBeNull()
    expect(container.querySelectorAll('.slot.filled')).toHaveLength(0)
    expect(screen.getByText('0/10')).toBeTruthy()
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

    const target = cells(container)[0].textContent?.trim()
    await send(cells(container)[0], AS_BAN)

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

    const target = cells(container)[0].textContent?.trim()
    await send(cells(container)[0], AS_BAN)
    await fireEvent.click(container.querySelector('.ban-strip .slot')!)

    expect(container.querySelector('.ban-strip')).toBeNull()
    expect(textOf(container, '.cell-name')).toContain(target)
  })

  it('clears match bans on reset', async () => {
    const { container } = render(App)
    await send(cells(container)[0], AS_BAN)

    await draft(container, 1)
    await fireEvent.click(screen.getByRole('button', { name: 'RESET' }))

    expect(container.querySelector('.ban-strip')).toBeNull()
  })
})

describe('App pool', () => {
  it('keeps a banned hero on the board while dropping it from my suggestions', async () => {
    const { container } = render(App)
    await draft(container, 1)

    const target = shortlist(container)[0]
    expect(target).toBeTruthy()

    bans.toggle(byName(target).id)
    await tick()

    expect(shortlist(container)).not.toContain(target)
    expect(textOf(container, '.cell-name')).toContain(target)
    expect(cellFor(container, target).querySelector('.strike')).toBeTruthy()

    await send(cellFor(container, target), AS_ENEMY)
    expect(screen.getByRole('button', { name: `Remove ${target} from the enemy team` })).toBeTruthy()
  })

  it('lets my own team take a hero I refuse to play myself', async () => {
    const banned = heroes[0]
    bans.toggle(banned.id)

    const { container } = render(App)
    await send(cellFor(container, banned.hero_name), AS_ALLY)

    expect(
      screen.getByRole('button', { name: `Remove ${banned.hero_name} from your team` })
    ).toBeTruthy()
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

  it('opens the ban list from the header and closes it again', async () => {
    bans.toggle(heroes[0].id)
    render(App)

    await fireEvent.click(screen.getByRole('button', { name: 'Your pool, 0 mains and 1 banned' }))
    expect(screen.getByText('Your pool')).toBeTruthy()

    await fireEvent.click(screen.getByRole('button', { name: 'DRAFT' }))
    expect(screen.queryByText('Your pool')).toBeNull()
  })
})
