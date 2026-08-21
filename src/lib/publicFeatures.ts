import { supabase } from '@/lib/supabase'
import { auth } from '@/lib/firebase'

export type ProductQuestion = { id: string; product_id: string; asker_id: string; question: string; answer: string | null; created_at: string; answered_at: string | null }
export type UserFeatureStatus = { alertEnabled: boolean; following: boolean }

type UserFeaturePayload = {
  action: 'status' | 'toggle_alert' | 'toggle_follow'
  productId?: string
  sellerId?: string
  alertType?: 'PRICE_DROP' | 'BACK_IN_STOCK'
}

type UserFeatureResponse = Partial<UserFeatureStatus> & { enabled?: boolean; error?: string }

async function userFeatureRequest<T extends UserFeatureResponse = UserFeatureResponse>(payload: UserFeaturePayload): Promise<T> {
  const currentUser = auth.currentUser
  if (!currentUser) throw new Error('এই কাজটি করতে আগে login করুন।')
  const idToken = await currentUser.getIdToken()
  const response = await fetch('/api/user-features', {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const result = await response.json().catch(() => ({})) as UserFeatureResponse
  if (!response.ok) throw new Error(result.error || `অনুরোধ ব্যর্থ হয়েছে (HTTP ${response.status})`)
  return result as T
}

export async function getUserFeatureStatus(productId: string | null, sellerId: string | null, alertType: 'PRICE_DROP' | 'BACK_IN_STOCK' | null) {
  return userFeatureRequest<UserFeatureStatus>({ action: 'status', productId: productId ?? undefined, sellerId: sellerId ?? undefined, alertType: alertType ?? undefined })
}

export async function toggleProductAlert(productId: string, alertType: 'PRICE_DROP' | 'BACK_IN_STOCK') {
  const result = await userFeatureRequest<{ enabled?: boolean }>({ action: 'toggle_alert', productId, alertType })
  return Boolean(result.enabled)
}

export async function toggleSellerFollow(sellerId: string) {
  const result = await userFeatureRequest<{ following?: boolean }>({ action: 'toggle_follow', sellerId })
  return Boolean(result.following)
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

export async function answerProductQuestion(questionId: string, answer: string) {
  const idToken = await auth.currentUser?.getIdToken()
  if (!idToken) throw new Error('উত্তর দিতে লগইন করা প্রয়োজন।')
  const response = await fetch('/api/product-question', {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionId, answer }),
  })
  const payload = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) throw new Error(payload.error || 'উত্তর সংরক্ষণ করা যায়নি।')
}
