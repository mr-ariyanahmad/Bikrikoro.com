import { supabase } from '@/lib/supabase'

const VISITOR_KEY = 'bikrikoro:search-visitor:v1'

function visitorKey() {
  try {
    const existing = window.localStorage.getItem(VISITOR_KEY)
    if (existing) return existing
    const next = typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    window.localStorage.setItem(VISITOR_KEY, next)
    return next
  } catch {
    return undefined
  }
}

function normalizeQuery(query: string) {
  return query.trim().replace(/\s+/g, ' ').slice(0, 120)
}

export function recordSearchEvent(query: string, productId?: string) {
  const normalized = normalizeQuery(query)
  if (normalized.length < 2) return
  void supabase.rpc('record_search_event', { p_query: normalized, p_product_id: productId ?? null, p_visitor_key: visitorKey() }).then(({ error }) => {
    if (error) console.warn('Search analytics unavailable:', error)
  })
}

export async function loadPopularSearches(limit = 8) {
  const { data, error } = await supabase.rpc('get_popular_searches', { p_limit: limit })
  if (error) {
    console.warn('Popular searches unavailable:', error)
    return []
  }
  return ((data ?? []) as Array<{ query?: string }>).map((row) => row.query?.trim() ?? '').filter(Boolean)
}

export async function loadSearchProductScores(query: string) {
  const normalized = normalizeQuery(query)
  if (normalized.length < 2) return new Map<string, number>()
  const { data, error } = await supabase.rpc('get_search_product_scores', { p_query: normalized })
  if (error) {
    console.warn('Search product scores unavailable:', error)
    return new Map<string, number>()
  }
  return new Map(((data ?? []) as Array<{ product_id?: string; click_count?: number }>).filter((row) => row.product_id).map((row) => [row.product_id as string, Number(row.click_count ?? 0)]))
}
