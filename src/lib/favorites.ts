import { supabase } from '@/lib/supabase'

export async function isFavorited(userId: string, productId: string): Promise<boolean> {
  const { data } = await supabase
    .from('favorites')
    .select('product_id')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .maybeSingle()
  return Boolean(data)
}

export async function addFavorite(userId: string, productId: string) {
  const { error } = await supabase.from('favorites').insert({ user_id: userId, product_id: productId })
  if (error) throw error
}

export async function removeFavorite(userId: string, productId: string) {
  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('user_id', userId)
    .eq('product_id', productId)
  if (error) throw error
}
