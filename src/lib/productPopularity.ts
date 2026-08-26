import { supabase } from '@/lib/supabase'

const VISITOR_TOKEN_KEY = 'bikrikoro:public-view-token:v1'
const VIEWED_TODAY_KEY = 'bikrikoro:public-product-views:v1'

function getVisitorToken() {
  const existing = window.localStorage.getItem(VISITOR_TOKEN_KEY)
  if (existing) return existing
  const token = window.crypto?.randomUUID?.()
  if (!token) return null
  window.localStorage.setItem(VISITOR_TOKEN_KEY, token)
  return token
}

function todayKey() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date())
}

export async function recordPublicProductView(productId: string) {
  try {
    const token = getVisitorToken()
    if (!token) return false
    const today = todayKey()
    const stored = JSON.parse(window.localStorage.getItem(VIEWED_TODAY_KEY) ?? '{}') as Record<string, string>
    if (stored[productId] === today) return false
    const { data, error } = await supabase.rpc('record_public_product_view', {
      p_product_id: productId,
      p_visitor_token: token,
    })
    if (error) throw error
    stored[productId] = today
    const compact = Object.fromEntries(Object.entries(stored).filter(([, date]) => date === today))
    window.localStorage.setItem(VIEWED_TODAY_KEY, JSON.stringify(compact))
    return Boolean(data)
  } catch {
    return false
  }
}
