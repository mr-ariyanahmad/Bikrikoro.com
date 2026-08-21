import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase, getVerifiedFirebaseToken, isAuthError } from './_server-auth.js'

type Action = 'status' | 'toggle_alert' | 'toggle_follow'
type AlertType = 'PRICE_DROP' | 'BACK_IN_STOCK'
type Body = {
  action?: Action
  productId?: string
  sellerId?: string
  alertType?: AlertType
}
type SupabaseErrorLike = { message?: unknown; details?: unknown; hint?: unknown }

function bodyOf(req: VercelRequest): Body {
  if (typeof req.body === 'string') return JSON.parse(req.body) as Body
  return (req.body ?? {}) as Body
}

function requiredText(value: unknown, field: string) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${field} is required`)
  return value.trim()
}

function alertTypeOf(value: unknown): AlertType {
  if (value !== 'PRICE_DROP' && value !== 'BACK_IN_STOCK') throw new Error('Invalid alert type')
  return value
}

function errorMessage(error: unknown) {
  if (error && typeof error === 'object') {
    const value = error as SupabaseErrorLike
    return [value.message, value.details, value.hint]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
      .join(' ')
  }
  return error instanceof Error ? error.message : ''
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const token = await getVerifiedFirebaseToken(req)
    const input = bodyOf(req)
    const action = input.action
    if (!action) throw new Error('User feature action is required')

    const supabase = getServiceSupabase()

    if (action === 'status') {
      const productId = input.productId?.trim() || null
      const sellerId = input.sellerId?.trim() || null
      const alertType = input.alertType ? alertTypeOf(input.alertType) : null
      const [{ data: alert, error: alertError }, { data: follow, error: followError }] = await Promise.all([
        productId && alertType
          ? supabase.from('product_alerts').select('product_id').eq('user_id', token.uid).eq('product_id', productId).eq('alert_type', alertType).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        sellerId
          ? supabase.from('seller_follows').select('seller_id').eq('user_id', token.uid).eq('seller_id', sellerId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ])
      if (alertError) throw alertError
      if (followError) throw followError
      res.status(200).json({ alertEnabled: Boolean(alert), following: Boolean(follow) })
      return
    }

    if (action === 'toggle_alert') {
      const productId = requiredText(input.productId, 'Product ID')
      const alertType = alertTypeOf(input.alertType)
      const { data, error } = await supabase.rpc('toggle_product_alert', {
        p_user_id: token.uid,
        p_product_id: productId,
        p_alert_type: alertType,
      })
      if (error) throw error
      res.status(200).json({ enabled: Boolean(data) })
      return
    }

    if (action === 'toggle_follow') {
      const sellerId = requiredText(input.sellerId, 'Seller ID')
      if (sellerId === token.uid) throw new Error('নিজের শপ অনুসরণ করা যাবে না।')
      const { data, error } = await supabase.rpc('toggle_seller_follow', {
        p_user_id: token.uid,
        p_seller_id: sellerId,
      })
      if (error) throw error
      res.status(200).json({ following: Boolean(data) })
      return
    }

    throw new Error('Unsupported user feature action')
  } catch (error) {
    if (isAuthError(error)) {
      res.status(401).json({ error: 'Firebase authentication is required' })
      return
    }
    console.error('User feature request failed:', error)
    res.status(400).json({ error: errorMessage(error) || 'এই কাজটি সম্পন্ন করা যায়নি।' })
  }
}
