const STORAGE_KEY = 'retribution.bans'

function load(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(id => typeof id === 'number')
  } catch {
    return []
  }
}

function persist(ids: number[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // storage unavailable (private mode, quota) — bans stay in memory only
  }
}

function createBans() {
  let ids = $state<number[]>(load())

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
    toggle(id: number) {
      ids = ids.includes(id) ? ids.filter(banned => banned !== id) : [...ids, id]
      persist(ids)
    },
    clear() {
      ids = []
      persist(ids)
    },
  }
}

export const bans = createBans()
