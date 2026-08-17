import { supabase } from '@/lib/supabase'

/** Backed by create_order_pending_payment() (010_uddoktapay_payments.sql) — website-only order path. */
export async function createPendingOrder(params: {
  productId: string
  buyerId: string
  deliveryAddress: string
  couponCode?: string
}): Promise<string> {
  const couponCode = params.couponCode?.trim()
  const { data, error } = couponCode
    ? await supabase.rpc('create_order_pending_payment_with_coupon', {
        p_product_id: params.productId,
        p_buyer_id: params.buyerId,
        p_delivery_address: params.deliveryAddress,
        p_coupon_code: couponCode,
      })
    : await supabase.rpc('create_order_pending_payment', {
        p_product_id: params.productId,
        p_buyer_id: params.buyerId,
        p_delivery_address: params.deliveryAddress,
      })
  if (error) throw error
  return data as string
}

/** Asks the uddoktapay-create-charge Edge Function for a hosted payment URL, then the caller redirects there. */
export async function startUddoktaPayCheckout(orderId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ payment_url?: string; error?: string }>(
    'uddoktapay-create-charge',
    { body: { orderId } }
  )
  if (error || !data?.payment_url) {
    throw new Error(data?.error || error?.message || 'Payment could not be started')
  }
  return data.payment_url
}

export async function cancelPendingOrder(orderId: string, buyerId: string) {
  const { error } = await supabase.rpc('buyer_cancel_pending_order', {
    p_order_id: orderId,
    p_buyer_id: buyerId,
  })
  if (error) throw error
}
