import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase, getVerifiedFirebaseToken, isAuthError } from './_server-auth.js'

type Body = { action?: 'list' | 'detail' | 'payment_state' | 'digital_library' | 'dispute' | 'wallet'; orderId?: string; disputeId?: string }

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
      const orderIds = (orders ?? []).map((row) => row.id)
      const productIds = [...new Set((orders ?? []).map((row) => row.product_id).filter((productId): productId is string => Boolean(productId)))]
      const [{ data: reviews, error: reviewsError }, { data: disputes, error: disputesError }, { data: deliveries, error: deliveriesError }, { data: digitalOptions, error: digitalOptionsError }] = await Promise.all([
        supabase.from('reviews').select('order_id').eq('buyer_id', token.uid),
        supabase.from('order_disputes').select('id, order_id').eq('buyer_id', token.uid),
        orderIds.length > 0
          ? supabase.from('digital_deliveries').select('order_id, delivery_type, delivery_text, status, delivered_at, updated_at').in('order_id', orderIds)
          : Promise.resolve({ data: [], error: null }),
        productIds.length > 0
          ? supabase.from('product_digital_specs').select('product_id, auto_delivery_enabled').in('product_id', productIds)
          : Promise.resolve({ data: [], error: null }),
      ])
      if (reviewsError) throw reviewsError
      if (disputesError) throw disputesError
      if (deliveriesError) throw deliveriesError
      if (digitalOptionsError) throw digitalOptionsError
      const autoDeliveryByProduct = new Map((digitalOptions ?? []).map((option) => [option.product_id, option.auto_delivery_enabled !== false]))
      const ordersWithDeliveryMode = (orders ?? []).map((order) => ({
        ...order,
        auto_delivery_enabled: order.product_id ? (autoDeliveryByProduct.get(order.product_id) ?? true) : true,
      }))
      res.status(200).json({ orders: ordersWithDeliveryMode, deliveries: deliveries ?? [], reviewedOrderIds: (reviews ?? []).map((row) => row.order_id), disputes: disputes ?? [] })
      return
    }
    if (input.action === 'detail') {
      if (!input.orderId) throw new Error('Order ID is required')
      const [{ data: order, error: orderError }, { data: reviewed, error: reviewError }, { data: delivery, error: deliveryError }] = await Promise.all([
        supabase.rpc('buyer_get_order', { p_user_id: token.uid, p_order_id: input.orderId }),
        supabase.rpc('buyer_has_order_review', { p_buyer_id: token.uid, p_order_id: input.orderId }),
        supabase.from('digital_deliveries').select('order_id, delivery_type, delivery_text, status, delivered_at, updated_at').eq('order_id', input.orderId).maybeSingle(),
      ])
      if (orderError) throw orderError
      if (reviewError) throw reviewError
      if (deliveryError) throw deliveryError
      const { data: digitalOption, error: digitalOptionError } = order?.product_id
        ? await supabase.from('product_digital_specs').select('auto_delivery_enabled').eq('product_id', order.product_id).maybeSingle()
        : { data: null, error: null }
      if (digitalOptionError) throw digitalOptionError
      const orderWithDeliveryMode = order
        ? { ...order, auto_delivery_enabled: digitalOption?.auto_delivery_enabled !== false }
        : order
      res.status(200).json({ order: orderWithDeliveryMode, delivery: delivery ?? null, reviewed: reviewed === true })
      return
    }
    if (input.action === 'digital_library') {
      const { data, error } = await supabase.rpc('get_digital_library', { p_buyer_id: token.uid })
      if (error) throw error
      const library = data ?? []
      const productIds = [...new Set(library.map((row) => row.product_id).filter((productId): productId is string => Boolean(productId)))]
      const { data: digitalOptions, error: digitalOptionsError } = productIds.length > 0
        ? await supabase.from('product_digital_specs').select('product_id, auto_delivery_enabled').in('product_id', productIds)
        : { data: [], error: null }
      if (digitalOptionsError) throw digitalOptionsError
      const autoDeliveryByProduct = new Map((digitalOptions ?? []).map((option) => [option.product_id, option.auto_delivery_enabled !== false]))
      const libraryWithDeliveryMode = library.map((item) => ({
        ...item,
        auto_delivery_enabled: item.product_id ? (autoDeliveryByProduct.get(item.product_id) ?? true) : true,
      }))
      res.status(200).json({ library: libraryWithDeliveryMode })
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
