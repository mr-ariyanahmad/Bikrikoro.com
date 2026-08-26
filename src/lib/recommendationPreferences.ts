import type { Product } from '@/types/product'

const STORAGE_KEY = 'bikrikoro:category-interest:v1'
const MAX_CATEGORIES = 12
const MAX_SCORE = 40
const INTEREST_HALF_LIFE_MS = 21 * 24 * 60 * 60 * 1000

const INTERACTION_WEIGHT = {
  view: 1,
  click: 2,
  favorite: 5,
} as const

export type CategoryInteraction = keyof typeof INTERACTION_WEIGHT

type InterestEntry = {
  score: number
  updatedAt: number
}

type InterestStore = Record<string, InterestEntry>

function readInterestStore(): InterestStore {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed as InterestStore : {}
  } catch {
    return {}
  }
}

function decayScore(entry: InterestEntry, now = Date.now()) {
  const age = Math.max(0, now - Number(entry.updatedAt || now))
  return Number(entry.score || 0) * Math.pow(0.5, age / INTEREST_HALF_LIFE_MS)
}

function writeInterestStore(store: InterestStore) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
    window.dispatchEvent(new Event('bikrikoro:recommendations-changed'))
  } catch {
    // Recommendation preferences are an optional local enhancement.
  }
}

export function trackCategoryInterest(categoryId: string | null | undefined, interaction: CategoryInteraction) {
  if (!categoryId) return
  const now = Date.now()
  const store = readInterestStore()
  const existing = store[categoryId]
  store[categoryId] = {
    score: Math.min(MAX_SCORE, (existing ? decayScore(existing, now) : 0) + INTERACTION_WEIGHT[interaction]),
    updatedAt: now,
  }
  const compactEntries = Object.entries(store)
    .map(([id, entry]) => [id, { score: decayScore(entry, now), updatedAt: Number(entry.updatedAt) || now }] as const)
    .filter(([, entry]) => entry.score >= 0.15)
    .sort(([, left], [, right]) => right.score - left.score)
    .slice(0, MAX_CATEGORIES)
  writeInterestStore(Object.fromEntries(compactEntries))
}

export function getCategoryInterestScores() {
  const now = Date.now()
  return Object.fromEntries(
    Object.entries(readInterestStore())
      .map(([id, entry]) => [id, decayScore(entry, now)] as const)
      .filter(([, score]) => score >= 0.15)
      .sort(([, left], [, right]) => right - left),
  ) as Record<string, number>
}

export function getPreferredCategoryIds() {
  return Object.keys(getCategoryInterestScores())
}

export function isTestDemoProduct(product: Pick<Product, 'title'>) {
  return product.title.startsWith('TEST / Demo only —')
}

export function rankProductsByCategoryInterest(products: Product[]) {
  const categoryScores = getCategoryInterestScores()
  return products.filter((product) => !isTestDemoProduct(product)).sort((left, right) => {
    const interestDifference = (categoryScores[right.category_id] ?? 0) - (categoryScores[left.category_id] ?? 0)
    if (interestDifference !== 0) return interestDifference
    const popularityDifference = Number(right.view_count ?? 0) - Number(left.view_count ?? 0)
    if (popularityDifference !== 0) return popularityDifference
    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  })
}
