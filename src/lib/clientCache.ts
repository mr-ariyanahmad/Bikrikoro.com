const CACHE_PREFIX = 'bikrikoro:cache:v1:'

type CacheEntry<T> = {
  cachedAt: number
  value: T
}

export type CachedValue<T> = {
  value: T
  cachedAt: number
  isStale: boolean
}

export function publicCacheKey(scope: string, identifier = 'default') {
  return `${CACHE_PREFIX}public:${encodeURIComponent(scope)}:${encodeURIComponent(identifier)}`
}

export function userCacheKey(userId: string, scope: string, identifier = 'default') {
  return `${CACHE_PREFIX}user:${encodeURIComponent(userId)}:${encodeURIComponent(scope)}:${encodeURIComponent(identifier)}`
}

export function readCachedValue<T>(key: string, maxStaleMs: number): CachedValue<T> | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const entry = JSON.parse(raw) as CacheEntry<T>
    if (!entry || typeof entry.cachedAt !== 'number' || !('value' in entry) || Date.now() - entry.cachedAt > maxStaleMs) {
      window.localStorage.removeItem(key)
      return null
    }
    return { value: entry.value, cachedAt: entry.cachedAt, isStale: false }
  } catch {
    return null
  }
}

export function writeCachedValue<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(key, JSON.stringify({ cachedAt: Date.now(), value } satisfies CacheEntry<T>))
  } catch {
    // Storage restrictions must never prevent the current network response from rendering.
  }
}

export function clearUserCachedData(userId: string) {
  try {
    const prefix = `${CACHE_PREFIX}user:${encodeURIComponent(userId)}:`
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index)
      if (key?.startsWith(prefix)) window.localStorage.removeItem(key)
    }
  } catch {
    // Firebase sign-out must still succeed if browser storage is unavailable.
  }
}
