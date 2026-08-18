import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase, getVerifiedFirebaseToken, isAuthError } from './_server-auth'

type AdminRpcRequest = { rpc?: string; args?: Record<string, unknown> }

const ALLOWED_ADMIN_RPCS = new Set([
  'admin_adjust_customer_wallet',
  'admin_assign_member',
  'admin_count_pending_seller_verifications',
  'admin_find_user_profile',
  'admin_get_dashboard_overview',
  'admin_get_system_status',
  'admin_delete_banner',
  'admin_finalize_seller_verification',
  'admin_get_customer_overview',
  'admin_get_settings',
  'admin_list_banners',
  'admin_list_categories',
  'admin_list_chat_threads',
  'admin_list_content',
  'admin_list_coupons',
  'admin_list_customers',
  'admin_list_digital_deliveries',
  'admin_list_members',
  'admin_list_orders',
  'admin_list_pending_disputes',
  'admin_list_product_approval_history',
  'admin_list_products',
  'admin_list_reviews',
  'admin_list_roles',
  'admin_list_withdrawals',
  'admin_moderate_product',
  'admin_moderate_review',
  'admin_resolve_dispute',
  'admin_review_product',
  'admin_review_seller_registration',
  'admin_review_verification_document',
  'admin_review_withdrawal',
  'admin_send_notification',
  'admin_set_content_status',
  'admin_set_coupon_active',
  'admin_set_customer_blocked',
  'admin_set_customer_note',
  'admin_set_member_active',
  'admin_update_order_status',
  'admin_update_product',
  'admin_upsert_banner',
  'admin_upsert_category',
  'admin_upsert_content',
  'admin_upsert_coupon',
  'admin_upsert_role',
  'admin_upsert_setting',
])

function bodyOf(req: VercelRequest): AdminRpcRequest {
  if (typeof req.body === 'string') return JSON.parse(req.body) as AdminRpcRequest
  return (req.body ?? {}) as AdminRpcRequest
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const token = await getVerifiedFirebaseToken(req)
    const input = bodyOf(req)
    const rpc = input.rpc?.trim() || ''
    if (!ALLOWED_ADMIN_RPCS.has(rpc)) {
      res.status(400).json({ error: 'Unsupported admin operation' })
      return
    }

    const args: Record<string, unknown> = { ...(input.args ?? {}), p_admin_id: token.uid }
    const supabase = getServiceSupabase()
    const { data, error } = await supabase.rpc(rpc, args)
    if (error) throw error
    res.status(200).json({ data })
  } catch (error) {
    if (isAuthError(error)) {
      res.status(401).json({ error: 'Firebase authentication is required' })
      return
    }
    console.error('Admin RPC failed:', error)
    const message = error instanceof Error ? error.message : 'Admin operation failed'
    const status = /not authorized|permission|admin/i.test(message) ? 403 : /required|invalid|not found|unsupported/i.test(message) ? 400 : 500
    res.status(status).json({ error: message })
  }
}
