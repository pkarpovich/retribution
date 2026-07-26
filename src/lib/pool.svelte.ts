// Two personal lists over the same shape, with opposite meanings and opposite
// mechanisms. A ban removes a hero from the candidates and never touches a
// score. A signature leaves every candidate in place and nudges one of them.
// They are mutually exclusive, which the pool screen enforces at the tap.

function load(key: string): number[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(id => typeof id === 'number')
  } catch {
    return []
  }
}

function persist(key: string, ids: number[]) {
  try {
    localStorage.setItem(key, JSON.stringify(ids))
  } catch {
    // storage unavailable (private mode, quota) - the list stays in memory only
  }
}

function createHeroSet(key: string) {
  let ids = $state<number[]>(load(key))

  return {
    get ids() {
      return ids
    },
    get size() {
      return ids.length
    },
    has(id: number) {
      return ids.includes(id)
    },
    add(id: number) {
      if (ids.includes(id)) return
      ids = [...ids, id]
      persist(key, ids)
    },
    remove(id: number) {
      if (!ids.includes(id)) return
      ids = ids.filter(kept => kept !== id)
      persist(key, ids)
    },
    toggle(id: number) {
      ids = ids.includes(id) ? ids.filter(kept => kept !== id) : [...ids, id]
      persist(key, ids)
    },
    clear() {
      ids = []
      persist(key, ids)
    },
  }
}

export const bans = createHeroSet('retribution.bans')
export const signatures = createHeroSet('retribution.signatures')

export type PoolStance = 'neutral' | 'signature' | 'banned'

export function stanceOf(id: number): PoolStance {
  if (bans.has(id)) return 'banned'
  if (signatures.has(id)) return 'signature'
  return 'neutral'
}

// One state at a time: a hero you main is not a hero you refuse to play.
export function setStance(id: number, stance: PoolStance) {
  if (stance === 'banned') {
    signatures.remove(id)
    return bans.add(id)
  }
  if (stance === 'signature') {
    bans.remove(id)
    return signatures.add(id)
  }
  bans.remove(id)
  signatures.remove(id)
}
