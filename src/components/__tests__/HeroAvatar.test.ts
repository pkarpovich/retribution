import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/svelte'
import HeroAvatar from '../HeroAvatar.svelte'
import { heroes } from './fixtures'

const [hero] = heroes

describe('HeroAvatar', () => {
  it('names the hero for anyone not looking at the picture', () => {
    render(HeroAvatar, { hero })
    const image = screen.getByRole('img', { name: hero.hero_name })

    expect(image.getAttribute('src')).toBe(hero.img_src)
    expect(image.getAttribute('loading')).toBe('lazy')
  })

  it('takes a size either as pixels or as whatever the layout is using', () => {
    const { container, rerender } = render(HeroAvatar, { hero, size: 44 })
    expect(container.querySelector('.avatar')?.getAttribute('style')).toBe('--size: 44px;')

    rerender({ hero, size: 'var(--slot)' })
    expect(container.querySelector('.avatar')?.getAttribute('style')).toBe('--size: var(--slot);')
  })

  it('strikes a hero out only when asked', () => {
    const { container, rerender } = render(HeroAvatar, { hero })
    expect(container.querySelector('.strike')).toBeNull()

    rerender({ hero, struck: true })
    expect(container.querySelector('.strike')).toBeTruthy()
  })
})
