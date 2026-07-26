import { describe, it, expect, beforeEach } from 'vitest'
import { tick } from 'svelte'
import { render, screen, fireEvent } from '@testing-library/svelte'
import App from '../App.svelte'
import { bans } from '../lib/bans.svelte'
import { heroes, textOf } from '../components/__tests__/fixtures'

const cells = (root: ParentNode) => [...root.querySelectorAll('.cell')] as HTMLButtonElement[]

async function draft(root: ParentNode, times: number) {
  for (let i = 0; i < times; i++) await fireEvent.click(cells(root)[0])
}

beforeEach(() => {
  bans.clear()
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

describe('App bans', () => {
  it('hides banned heroes from the roster and accounts for them', () => {
    bans.toggle(heroes[0].id)
    bans.toggle(heroes[1].id)

    const { container } = render(App)
    const listed = textOf(container, '.cell-name')

    expect(listed).not.toContain(heroes[0].hero_name)
    expect(listed).not.toContain(heroes[1].hero_name)
    expect(screen.getByRole('button', { name: '2 heroes hidden by bans' })).toBeTruthy()
  })

  it('reads the ban count out on the header button instead of leaving a bare badge', async () => {
    render(App)
    expect(screen.getByRole('button', { name: 'Banned heroes' })).toBeTruthy()

    bans.toggle(heroes[0].id)
    await tick()
    expect(screen.getByRole('button', { name: 'Banned heroes, 1 banned' })).toBeTruthy()
  })

  it('opens the ban list from the roster note and closes it again', async () => {
    bans.toggle(heroes[0].id)
    render(App)

    await fireEvent.click(screen.getByRole('button', { name: '1 hero hidden by bans' }))
    expect(screen.getByText('Banned heroes')).toBeTruthy()

    await fireEvent.click(screen.getByRole('button', { name: 'DRAFT' }))
    expect(screen.queryByText('Banned heroes')).toBeNull()
  })
})
