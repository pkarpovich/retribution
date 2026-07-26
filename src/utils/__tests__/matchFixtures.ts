import type { MatchRecord } from '../../types/match'

const BREAKDOWN = {
  base: 300,
  meta_bonus: 12,
  team_balance: 0,
  damage_type_balance: 0,
  enemy_analysis: 0,
  strong_against: 0,
  cc_chain_synergy: 0,
  counter_penalty: 0,
  counter_threat: 0,
  synergy_bonus: 0,
  early_late_game: 0,
  invade_resistance: 0,
  comfort: 0,
}

export function makeRecord(overrides: Partial<MatchRecord> = {}): MatchRecord {
  const id = overrides.id ?? `m${Math.random().toString(36).slice(2, 8)}`
  return {
    id,
    at: '2026-07-26T18:00:00.000Z',
    dataVersion: '2026-07-20T06:06:44.293Z',
    outcome: 'pending',
    note: '',
    enemies: [{ id: 1, name: 'Estes' }],
    allies: [],
    matchBans: [],
    pick: { id: 10, name: 'Guinevere', tier: 'S' },
    rank: 1,
    shown: 8,
    followedAdvice: true,
    top: { id: 10, name: 'Guinevere' },
    totalScore: 412,
    breakdown: BREAKDOWN,
    warnings: [],
    strengths: [],
    build: { boots: 'Tough Boots', bootsReason: 'High enemy CC', blessing: 'Ice', blessingReason: 'Chase' },
    needs: [],
    ...overrides,
  }
}
