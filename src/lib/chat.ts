import { supabase } from '@/lib/supabase'

/**
 * Creates or reuses one secure chat thread per buyer/seller pair.
 * Firebase UIDs are passed to a security-definer RPC; the client never writes
 * directly to chat_threads.
 */
export async function findOrCreateThread(
  buyerId: string,
  sellerId: string,
  productId: string | null
): Promise<string> {
  if (!buyerId || !sellerId || buyerId === sellerId) throw new Error('নিজের listing-এ chat করা যাবে না।')

  const { data, error } = await supabase.rpc('find_or_create_chat_thread', {
    p_buyer_id: buyerId,
    p_seller_id: sellerId,
    p_product_id: productId,
  })
  if (error || !data) throw error ?? new Error('Chat thread তৈরি করা যায়নি।')
  return data as string
}
