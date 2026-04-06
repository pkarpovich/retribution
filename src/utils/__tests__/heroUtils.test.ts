import { describe, it, expect } from 'vitest'
import { getJunglers } from '../heroUtils'

describe('heroUtils', () => {
  it('returns empty array when no heroes have Jungle lane', () => {
    expect(getJunglers([])).toEqual([])
  })
})
