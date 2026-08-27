import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/product'

export type SearchShop = Pick<Profile, 'id' | 'name' | 'photo_url' | 'shop_name' | 'shop_username' | 'is_verified' | 'rating' | 'review_count'>

const PUBLIC_SHOP_FIELDS = 'id, name, photo_url, shop_name, shop_username, is_verified, rating, review_count'

/** Fetches only public seller-summary fields for a shop-name search. */
export async function searchPublicShops(term: string, limit = 4): Promise<SearchShop[]> {
  const normalized = term.trim()
  if (normalized.length < 2) return []
  const { data, error } = await supabase
    .from('profiles')
    .select(PUBLIC_SHOP_FIELDS)
    .not('shop_name', 'is', null)
    .ilike('shop_name', `%${normalized}%`)
    .order('is_verified', { ascending: false })
    .order('review_count', { ascending: false })
    .limit(limit)
  if (error) {
    console.warn('Shop search failed:', error)
    return []
  }
  return (data ?? []) as SearchShop[]
}
