import { describe, it, expect } from 'vitest'
import heroData from '../../data/heroes.json'
import draftData from '../../data/pro-drafts.json'

// vitest.config.ts aliases the live data files to the frozen snapshots for the
// whole test run. That alias is the only thing standing between this suite and
// a build that goes red because the meta moved, and it is invisible at the
// import site: every test above reads '../../data/heroes.json' and silently
// gets a snapshot instead.
//
// So it gets checked here. Drop the alias and this fails by name, rather than
// as a wall of shifted numbers in the benchmark a week later.
//
// The assertion is on a marker rather than on the contents. Right after a
// snapshot is refreshed the live file and the fixture are byte-identical, and a
// check that compared data would pass whether the alias worked or not.

// Deliberately hardcoded. Refreshing a snapshot is a decision, and it should
// have to be made here too, in the same commit, with a reason.
const SNAPSHOT_TAKEN = '2026-07-30T06:20:47.541Z'
const SNAPSHOT_GAMES = 74

describe('test isolation', () => {
  it('reads hero data from the frozen snapshot, not the live file', () => {
    expect((heroData as { frozenFixture?: string }).frozenFixture).toBe('heroes.snapshot.json')
  })

  it('reads the pro corpus from the frozen snapshot', () => {
    expect((draftData as { frozenFixture?: string }).frozenFixture).toBe('pro-drafts.snapshot.json')
  })

  it('is pinned to the snapshot it was written against', () => {
    expect(heroData.lastUpdated).toBe(SNAPSHOT_TAKEN)
    expect(draftData.games.length).toBe(SNAPSHOT_GAMES)
  })

  it('still gets a whole roster through the alias', () => {
    expect(heroData.heroes.length).toBeGreaterThan(100)
  })
})
