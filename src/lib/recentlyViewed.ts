const STORAGE_KEY = 'bikrikoro:recently-viewed'
const MAX_ITEMS = 12

export function trackProductView(productId: string) {
  const ids = getRecentlyViewedIds().filter((id) => id !== productId)
  ids.unshift(productId)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(0, MAX_ITEMS)))
}

export function getRecentlyViewedIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}
