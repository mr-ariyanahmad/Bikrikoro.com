const STORAGE_KEY = 'bikrikoro:compare'
const MAX_COMPARE = 3

function readIds(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

function writeIds(ids: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(0, MAX_COMPARE)))
  window.dispatchEvent(new Event('bikrikoro:compare-changed'))
}

export function getComparedProductIds(): string[] {
  return readIds()
}

export function isCompared(productId: string): boolean {
  return readIds().includes(productId)
}

export function toggleCompared(productId: string): { selected: boolean; limitReached: boolean } {
  const current = readIds()
  if (current.includes(productId)) {
    writeIds(current.filter((id) => id !== productId))
    return { selected: false, limitReached: false }
  }
  if (current.length >= MAX_COMPARE) return { selected: false, limitReached: true }
  writeIds([...current, productId])
  return { selected: true, limitReached: false }
}

export function removeCompared(productId: string) {
  writeIds(readIds().filter((id) => id !== productId))
}

export const MAX_COMPARE_PRODUCTS = MAX_COMPARE
