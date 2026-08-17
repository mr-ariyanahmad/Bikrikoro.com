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
  if (!buyerId || !sellerId || buyerId === sellerId) throw new Error('নিজের listing-এ chat করা যাবে না।')

  const findExisting = async () => supabase
    .from('chat_threads')
    .select('id, product_id')
    .eq('buyer_id', buyerId)
    .eq('seller_id', sellerId)
    .maybeSingle()

  const { data: existing, error: lookupError } = await findExisting()
  if (lookupError) throw lookupError
  if (existing) {
    if (!existing.product_id && productId) await supabase.from('chat_threads').update({ product_id: productId }).eq('id', existing.id)
    return existing.id
  }

  const { data, error } = await supabase
    .from('chat_threads')
    .insert({ buyer_id: buyerId, seller_id: sellerId, product_id: productId })
    .select('id')
    .maybeSingle()

  if (!error && data) return data.id
  if (error?.code === '23505') {
    const { data: raced, error: raceError } = await findExisting()
    if (!raceError && raced) return raced.id
  }
  throw error ?? new Error('Chat thread তৈরি করা যায়নি।')
}
