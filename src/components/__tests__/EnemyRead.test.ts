import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'
import EnemyRead from '../EnemyRead.svelte'
import { enemyRuleReadout, getCCScore } from '../../utils/heroUtils'
import { chosen, suggested } from '../../utils/presentation'
import { drySlow, heroes, junglers, suggestionFor, sustainers, textOf } from './fixtures'

const healers = sustainers.slice(0, 5)
const lockers = heroes.filter(hero => getCCScore(hero) >= 4).slice(0, 5)
const antiHealJungler = junglers.find(hero => hero.capabilities?.antiHeal)!

const base = { pool: junglers, responders: suggested([]) }

describe('EnemyRead', () => {
  it('stays out of the way until an enemy is revealed', () => {
    const { container } = render(EnemyRead, { ...base, enemies: [] })
    expect(container.textContent).toBe('')
  })

  it('opens from the peek and folds back', async () => {
    const { container } = render(EnemyRead, { ...base, enemies: healers })

    expect(container.querySelector('.peek')).toBeTruthy()
    expect(container.querySelector('.full')).toBeNull()

    await fireEvent.click(container.querySelector('.peek')!)
    expect(container.querySelector('.full')).toBeTruthy()

    await fireEvent.click(screen.getByRole('button', { name: 'Collapse enemy read-out' }))
    expect(container.querySelector('.peek')).toBeTruthy()
  })

  it('reads a healing team as healing', () => {
    const read = enemyRuleReadout(healers)!
    expect(read.sustainCount).toBe(healers.length)

    const { container } = render(EnemyRead, { ...base, enemies: healers })
    expect(container.querySelector('.line em')?.textContent).toMatch(/^They heal[.,]/)
  })

  it('flags the anti-heal nobody in the list can supply', async () => {
    const { container } = render(EnemyRead, { ...base, enemies: healers })

    expect(container.querySelector('.peek-points')?.textContent).toMatch(/^\+\d+$/)
    expect(screen.getByText('buy anti-heal')).toBeTruthy()

    await fireEvent.click(container.querySelector('.peek')!)
    expect(container.querySelector('.gap-note')?.textContent).toContain('This is an item, not a pick.')
    expect(textOf(container, '.flag')).toContain('UNCLAIMED')
  })

  it('drops the flag as soon as a suggestion carries anti-heal', async () => {
    const { container } = render(EnemyRead, {
      ...base,
      enemies: healers,
      responders: suggested([suggestionFor(antiHealJungler, 100, 10)]),
    })

    expect(container.querySelector('.peek-points')).toBeNull()
    expect(screen.queryByText('buy anti-heal')).toBeNull()

    await fireEvent.click(container.querySelector('.peek')!)
    expect(container.querySelector('.gap-note')).toBeNull()
    expect(textOf(container, '.flag')).not.toContain('UNCLAIMED')
  })

  it('marks a rule that this draft cannot pay for', async () => {
    const read = enemyRuleReadout(drySlow.slice(0, 5))!
    expect(read.catchPoints).toBeLessThan(3)

    const { container } = render(EnemyRead, { ...base, enemies: drySlow.slice(0, 5) })
    await fireEvent.click(container.querySelector('.peek')!)

    expect(textOf(container, '.flag')).toContain('SWITCHED OFF')
    expect(container.textContent).toContain('the rule runs and returns almost nothing')
  })

  // The advice used to fire on 86% of drafts because "one of them heals" is
  // almost always true. Nothing here heals at all, so it must not appear.
  it('stays quiet about anti-heal when nobody over there heals', async () => {
    const quiet = drySlow.slice(0, 5)
    expect(enemyRuleReadout(quiet)!.sustainCount).toBe(0)

    const { container } = render(EnemyRead, { ...base, enemies: quiet })
    expect(container.querySelector('.line em')?.textContent).not.toMatch(/heal/i)
    expect(screen.queryByText('buy anti-heal')).toBeNull()

    await fireEvent.click(container.querySelector('.peek')!)
    expect(textOf(container, '.lever-name')).not.toContain('Anti-heal')
    expect(container.querySelector('.gap-note')).toBeNull()
  })

  it('writes an unpriced rule as an open question rather than a zero', async () => {
    const read = enemyRuleReadout(lockers)!
    expect(read.heavyCcCount / read.revealed).toBeGreaterThanOrEqual(0.6)

    const { container } = render(EnemyRead, { ...base, enemies: lockers })
    await fireEvent.click(container.querySelector('.peek')!)

    expect(container.querySelector('.statement')?.textContent).toContain('they will lock you down')
    expect(textOf(container, '.points')).toContain('+?')
  })

  // Once a pick is locked the suggestions are heroes this player can no longer
  // take and can no longer see, so the supply lines have to switch to the team.
  it('counts the team rather than the suggestions once a pick is committed', async () => {
    const { container } = render(EnemyRead, {
      ...base,
      enemies: healers,
      responders: chosen([antiHealJungler]),
    })

    await fireEvent.click(container.querySelector('.peek')!)
    expect(container.textContent).toContain('1 of the 1 pick carry it')
    expect(container.textContent).not.toContain('suggestions')
    expect(container.querySelector('.gap-note')).toBeNull()
  })

  it('calls an unanswered rule an item problem once the side is chosen', async () => {
    const bare = junglers.find(hero => !hero.capabilities?.antiHeal)!
    const { container } = render(EnemyRead, {
      ...base,
      enemies: healers,
      responders: chosen([bare]),
    })

    await fireEvent.click(container.querySelector('.peek')!)
    expect(container.querySelector('.gap-note')?.textContent)
      .toContain('None of your 1 carries anti-heal.')
    expect(container.textContent).not.toContain('junglers carry it')
  })

  it('keeps the raw numbers behind a toggle', async () => {
    const { container } = render(EnemyRead, { ...base, enemies: healers })
    await fireEvent.click(container.querySelector('.peek')!)

    expect(container.querySelector('.tally')).toBeNull()

    await fireEvent.click(screen.getByRole('button', { name: /THEIR NUMBERS/ }))
    expect(textOf(container, '.tally dt')).toEqual([
      'sustain',
      'crowd control',
      'heavy control',
      'control immunity',
      'mobility',
      'damage mitigation',
      'squishy',
      'tanks',
    ])

    await fireEvent.click(screen.getByRole('button', { name: 'HIDE THEIR NUMBERS' }))
    expect(container.querySelector('.tally')).toBeNull()
  })
})
