import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'
import PlanSheet from '../PlanSheet.svelte'
import { recommendBoots } from '../../utils/heroUtils'
import { teamNeeds } from '../../utils/presentation'
import { byName, sustainers, textOf } from './fixtures'

const pick = byName('Ling')
const angela = byName('Angela')
const hungry = sustainers.slice(0, 5)

const build = recommendBoots(pick, hungry)
const needs = teamNeeds([pick], hungry)

const props = {
  build,
  needs,
  picksLeft: 2,
  worksWith: [angela],
  onClose: () => {},
}

describe('PlanSheet', () => {
  it('answers what to build', () => {
    const { container } = render(PlanSheet, props)

    expect(screen.getByText('WHAT TO BUY')).toBeTruthy()
    expect(textOf(container, '.item-name')).toEqual([build.boots, `${build.blessing} Retribution`])
    expect(textOf(container, '.item-why')).toContain(build.bootsReason)
  })

  it('tells the team what the draft still needs, and how many picks are left', () => {
    const { container } = render(PlanSheet, props)

    expect(needs.length).toBeGreaterThan(0)
    expect(screen.getByText('TELL YOUR TEAM')).toBeTruthy()
    expect(screen.getByText('2 ally picks left')).toBeTruthy()
    expect(textOf(container, '.need-name')).toContain(needs[0].name)
  })

  it('calls a gap an item problem when there is nobody left to pick', () => {
    render(PlanSheet, { ...props, picksLeft: 0 })

    expect(screen.getByText('items only now')).toBeTruthy()
  })

  it('says nothing about the team when the draft leaves nothing to say', () => {
    render(PlanSheet, { ...props, needs: [] })

    expect(screen.queryByText('TELL YOUR TEAM')).toBeNull()
  })

  it('keeps the allies the pick works with here, off the board figure', () => {
    const { container } = render(PlanSheet, props)

    expect(screen.getByText('WORKS WITH YOU')).toBeTruthy()
    expect(textOf(container, '.chip-name')).toEqual(['Angela'])
    expect(screen.getByText('not on the board figure')).toBeTruthy()
  })

  it('leaves the partner group out when no ally pairs with the pick', () => {
    render(PlanSheet, { ...props, worksWith: [] })

    expect(screen.queryByText('WORKS WITH YOU')).toBeNull()
  })

  it('closes from the button, the scrim and the escape key', async () => {
    const onClose = vi.fn()
    const { unmount } = render(PlanSheet, { ...props, onClose })

    await fireEvent.click(screen.getByRole('button', { name: 'DONE' }))
    await fireEvent.click(screen.getByRole('button', { name: 'Close your plan' }))
    await fireEvent.keyDown(window, { key: 'Escape' })
    unmount()

    expect(onClose).toHaveBeenCalledTimes(3)
  })
})
