import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase, getVerifiedFirebaseToken, isAuthError } from './_server-auth.js'

type Body = { action?: 'list' | 'detail' | 'payment_state' | 'dispute' | 'wallet'; orderId?: string; disputeId?: string }

function bodyOf(req: VercelRequest): Body {
  if (typeof req.body === 'string') return JSON.parse(req.body) as Body
  return (req.body ?? {}) as Body
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
    const supabase = getServiceSupabase()
    if (input.action === 'list') {
      const { data: orders, error: ordersError } = await supabase.rpc('buyer_list_orders', { p_user_id: token.uid })
      if (ordersError) throw ordersError
      const [{ data: reviews, error: reviewsError }, { data: disputes, error: disputesError }] = await Promise.all([
        supabase.from('reviews').select('order_id').eq('buyer_id', token.uid),
        supabase.from('order_disputes').select('id, order_id').eq('buyer_id', token.uid),
      ])
      if (reviewsError) throw reviewsError
      if (disputesError) throw disputesError
      res.status(200).json({ orders: orders ?? [], reviewedOrderIds: (reviews ?? []).map((row) => row.order_id), disputes: disputes ?? [] })
      return
    }
    if (input.action === 'detail') {
      if (!input.orderId) throw new Error('Order ID is required')
      const [{ data: order, error: orderError }, { data: reviewed, error: reviewError }] = await Promise.all([
        supabase.rpc('buyer_get_order', { p_user_id: token.uid, p_order_id: input.orderId }),
        supabase.rpc('buyer_has_order_review', { p_buyer_id: token.uid, p_order_id: input.orderId }),
      ])
      if (orderError) throw orderError
      if (reviewError) throw reviewError
      res.status(200).json({ order, reviewed: reviewed === true })
      return
    }
    if (input.action === 'payment_state') {
      if (!input.orderId) throw new Error('Order ID is required')
      const { data, error } = await supabase.rpc('buyer_get_payment_state', { p_buyer_id: token.uid, p_order_id: input.orderId })
      if (error) throw error
      res.status(200).json({ status: data })
      return
    }
    if (input.action === 'dispute') {
      if (!input.disputeId) throw new Error('Dispute ID is required')
      const { data: dispute, error: disputeError } = await supabase.from('order_disputes').select('*').eq('id', input.disputeId).maybeSingle()
      if (disputeError) throw disputeError
      if (!dispute) throw new Error('Dispute not found')
      const { data: order, error: orderError } = await supabase.from('orders').select('buyer_id, seller_id').eq('id', dispute.order_id).maybeSingle()
      if (orderError) throw orderError
      if (!order || ![String(order.buyer_id), String(order.seller_id)].includes(token.uid)) throw new Error('Not authorized')
      const { data: messages, error: messagesError } = await supabase.from('dispute_messages').select('*').eq('dispute_id', input.disputeId).order('created_at', { ascending: true })
      if (messagesError) throw messagesError
      res.status(200).json({ dispute, messages: messages ?? [] })
      return
    }
    if (input.action === 'wallet') {
      const [{ data: balance, error: balanceError }, { data: ledger, error: ledgerError }, { data: withdrawalSummary, error: withdrawalError }, { data: withdrawals, error: historyError }] = await Promise.all([
        supabase.rpc('user_wallet_balance', { p_user_id: token.uid }),
        supabase.rpc('user_wallet_ledger', { p_user_id: token.uid, p_limit: 50 }),
        supabase.rpc('user_wallet_withdrawal_summary', { p_user_id: token.uid }),
        supabase.rpc('user_wallet_withdrawal_history', { p_user_id: token.uid, p_limit: 50 }),
      ])
      if (balanceError) throw balanceError
      const warnings = [
        ledgerError ? 'লেনদেনের হিস্ট্রি' : '',
        withdrawalError || historyError ? 'উইথড্রয়াল হিস্ট্রি' : '',
      ].filter(Boolean)
      res.status(200).json({
        balance,
        ledger: ledgerError ? [] : ledger ?? [],
        withdrawalSummary: withdrawalError ? null : withdrawalSummary?.[0] ?? null,
        withdrawals: historyError ? [] : withdrawals ?? [],
        warning: warnings.length > 0 ? `${warnings.join(' ও ')} এখন দেখানো যাচ্ছে না। Balance ঠিকভাবে লোড হয়েছে।` : null,
      })
      return
    }
    throw new Error('Unsupported order read action')
  } catch (error) {
    if (isAuthError(error)) {
      res.status(401).json({ error: 'Firebase authentication is required' })
      return
    }
    console.error('Order read failed:', error)
    res.status(400).json({ error: error instanceof Error ? error.message : 'Order data লোড করা যায়নি।' })
  }
}
