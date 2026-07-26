import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'
import MatchBanStrip from '../MatchBanStrip.svelte'
import { heroes } from './fixtures'

const [first, second] = heroes

describe('MatchBanStrip', () => {
  it('takes no room while nothing is banned', () => {
    const { container } = render(MatchBanStrip, { bans: [], onRemove: () => {} })
    expect(container.textContent).toBe('')
  })

  it('shows every ban and counts them', () => {
    const { container } = render(MatchBanStrip, { bans: [first, second], onRemove: () => {} })

    expect(container.querySelectorAll('.slot')).toHaveLength(2)
    expect(container.querySelector('.tally')?.textContent).toBe('2')
  })

  it('lifts a ban that was entered by mistake', async () => {
    const onRemove = vi.fn()
    render(MatchBanStrip, { bans: [first], onRemove })

    await fireEvent.click(screen.getByRole('button', { name: `Unban ${first.hero_name}` }))
    expect(onRemove).toHaveBeenCalledWith(first)
  })
})
