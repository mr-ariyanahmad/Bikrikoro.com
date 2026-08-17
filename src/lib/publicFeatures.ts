import { supabase } from '@/lib/supabase'

export type ProductQuestion = { id: string; product_id: string; asker_id: string; question: string; answer: string | null; created_at: string; answered_at: string | null }

export async function toggleProductAlert(userId: string, productId: string, alertType: 'PRICE_DROP' | 'BACK_IN_STOCK') {
  const { data, error } = await supabase.rpc('toggle_product_alert', { p_user_id: userId, p_product_id: productId, p_alert_type: alertType })
  if (error) throw error
  return Boolean(data)
}

export async function toggleSellerFollow(userId: string, sellerId: string) {
  const { data, error } = await supabase.rpc('toggle_seller_follow', { p_user_id: userId, p_seller_id: sellerId })
  if (error) throw error
  return Boolean(data)
}

export async function listProductQuestions(productId: string) {
  const { data, error } = await supabase.rpc('list_product_questions', { p_product_id: productId })
  if (error) throw error
  return (data ?? []) as ProductQuestion[]
}

export async function askProductQuestion(askerId: string, productId: string, question: string) {
  const { error } = await supabase.rpc('ask_product_question', { p_asker_id: askerId, p_product_id: productId, p_question: question })
  if (error) throw error
}

export async function reportProduct(reporterId: string, productId: string, reason: string, details: string) {
  const { error } = await supabase.rpc('report_product', { p_reporter_id: reporterId, p_product_id: productId, p_reason: reason, p_details: details })
  if (error) throw error
}
