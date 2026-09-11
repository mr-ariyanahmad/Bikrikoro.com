import { sendSimilarProductEmail } from './resendEmail.js'

export async function notifySimilarProductInterest(supabase: any, productId: string) {
  const { data: product, error: productError } = await supabase.from('products').select('id, title, price, category_id, seller_id').eq('id', productId).maybeSingle()
  if (productError || !product?.category_id) return
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  const { data: interests } = await supabase.from('product_category_interests').select('user_id, score').eq('category_id', product.category_id).eq('email_alerts_enabled', true).gte('score', 1.5).or(`last_alert_at.is.null,last_alert_at.lt.${cutoff}`).neq('user_id', product.seller_id).limit(200)
  const ids = [...new Set((interests ?? []).map((row: { user_id: string }) => row.user_id))]
  if (!ids.length) return
  const { data: profiles } = await supabase.from('profiles').select('id, name, email').in('id', ids)
  await Promise.allSettled((profiles ?? []).filter((profile: { email?: string | null }) => profile.email).map(async (profile: { id: string; name: string | null; email: string }) => {
    await sendSimilarProductEmail({ to: profile.email, recipientName: profile.name ?? 'প্রিয় ব্যবহারকারী', productTitle: product.title, price: product.price, productLink: `https://www.bikrikoro.com/products/${product.id}` })
    await supabase.from('product_category_interests').update({ last_alert_at: new Date().toISOString() }).eq('user_id', profile.id).eq('category_id', product.category_id)
  }))
}
