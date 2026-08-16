import { supabase } from '@/lib/supabase'

/**
 * chat_threads has `unique (buyer_id, seller_id)` (001_init.sql) — reuses
 * the same thread across every product two users discuss, matching how
 * the Android app's chat list works (one thread per counterpart, not per
 * product).
 */
export async function findOrCreateThread(
  buyerId: string,
  sellerId: string,
  productId: string | null
): Promise<string> {
  const { data: existing } = await supabase
    .from('chat_threads')
    .select('id')
    .eq('buyer_id', buyerId)
    .eq('seller_id', sellerId)
    .maybeSingle()

  if (existing) return existing.id

  const { data, error } = await supabase
    .from('chat_threads')
    .insert({ buyer_id: buyerId, seller_id: sellerId, product_id: productId })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}
