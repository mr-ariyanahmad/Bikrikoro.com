import { supabase } from '@/lib/supabase'
import { auth } from '@/lib/firebase'

export interface CouponPreview {
  valid: boolean
  normalized_code: string
  discount_amount: number
  final_price: number
  message: string
}

export interface DigitalLibraryItem {
  order_id: string
  product_id: string | null
  product_title: string
  product_image: string
  price: number
  order_status: string
  delivery_type: 'INSTRUCTIONS' | 'LICENSE_KEY' | 'DOWNLOAD_LINK'
  delivery_text: string
  delivery_status: 'PENDING' | 'READY' | 'REVOKED'
  delivered_at: string | null
  purchased_at: string
}

export async function validateCoupon(code: string, productId: string, buyerId: string): Promise<CouponPreview> {
  const { data, error } = await supabase.rpc('validate_coupon', {
    p_code: code.trim(),
    p_product_id: productId,
    p_buyer_id: buyerId,
  })
  if (error || !data?.[0]) {
    return {
      valid: false,
      normalized_code: code.trim().toUpperCase(),
      discount_amount: 0,
      final_price: 0,
      message: 'এই মুহূর্তে কুপন যাচাই করা যাচ্ছে না।',
    }
  }
  return data[0] as CouponPreview
}

export async function loadDigitalLibrary(userId: string): Promise<DigitalLibraryItem[]> {
  if (auth.currentUser?.uid !== userId) throw new Error('আপনার digital library session পাওয়া যায়নি।')
  const idToken = await auth.currentUser.getIdToken()
  const response = await fetch('/api/order-read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ action: 'digital_library' }),
  })
  const payload = await response.json().catch(() => ({})) as { library?: DigitalLibraryItem[]; error?: string }
  if (!response.ok) throw new Error(payload.error || `Digital library load failed (HTTP ${response.status})`)
  return payload.library ?? []
}

async function notificationApi(userId: string, payload: Record<string, unknown>) {
  if (auth.currentUser?.uid !== userId) throw new Error('আপনার notification session পাওয়া যায়নি। আবার login করুন।')
  const idToken = await auth.currentUser.getIdToken()
  const response = await fetch('/api/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(payload),
  })
  const raw = await response.text()
  let result: { data?: unknown[]; count?: number; error?: string } = {}
  try {
    result = raw ? JSON.parse(raw) as typeof result : {}
  } catch {
    result = {}
  }
  if (!response.ok) {
    const detail = result.error || raw.trim() || `HTTP ${response.status}`
    throw new Error(`${detail} (HTTP ${response.status})`)
  }
  return result
}

export async function loadNotifications(userId: string) {
  const result = await notificationApi(userId, { action: 'list' })
  return result.data ?? []
}

export async function markNotificationRead(notificationId: string, userId: string) {
  await notificationApi(userId, { action: 'read', notificationId })
}

export async function markAllNotificationsRead(userId: string) {
  const result = await notificationApi(userId, { action: 'mark_all' })
  return Number(result.count ?? 0)
}

export async function loadUnreadNotificationCount(userId: string) {
  const result = await notificationApi(userId, { action: 'count' })
  return Number(result.count ?? 0)
}
