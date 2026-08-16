import { supabase } from '@/lib/supabase'
import type { DisputeReason, PaymentMethod } from '@/types/order'

/** Backed by supabase/migrations/009_tier1_....sql create_order_atomic(). */
export async function createOrder(params: {
  productId: string
  buyerId: string
  deliveryAddress: string
  paymentMethod: PaymentMethod
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_order_atomic', {
    p_product_id: params.productId,
    p_buyer_id: params.buyerId,
    p_delivery_address: params.deliveryAddress,
    p_payment_method: params.paymentMethod,
  })
  if (error) throw error
  return data as string
}

export async function confirmOrderDelivery(orderId: string, buyerId: string) {
  const { error } = await supabase.rpc('confirm_order_delivery', {
    p_order_id: orderId,
    p_buyer_id: buyerId,
  })
  if (error) throw error
}

export async function buyerCancelOrder(orderId: string, buyerId: string) {
  const { error } = await supabase.rpc('buyer_cancel_order', {
    p_order_id: orderId,
    p_buyer_id: buyerId,
  })
  if (error) throw error
}

export async function sellerMarkShipped(orderId: string, sellerId: string) {
  const { error } = await supabase.rpc('seller_mark_shipped', {
    p_order_id: orderId,
    p_seller_id: sellerId,
  })
  if (error) throw error
}

export async function sellerCancelOrder(orderId: string, sellerId: string) {
  const { error } = await supabase.rpc('seller_cancel_order', {
    p_order_id: orderId,
    p_seller_id: sellerId,
  })
  if (error) throw error
}

export async function reportOrderDispute(params: {
  orderId: string
  buyerId: string
  reason: DisputeReason
  description: string
  evidenceUrls: string[]
}): Promise<string> {
  const { data, error } = await supabase.rpc('report_order_dispute', {
    p_order_id: params.orderId,
    p_buyer_id: params.buyerId,
    p_reason: params.reason,
    p_description: params.description,
    p_evidence_urls: params.evidenceUrls,
  })
  if (error) throw error
  return data as string
}

export async function sendDisputeMessage(disputeId: string, senderId: string, message: string) {
  const { error } = await supabase.rpc('send_dispute_message', {
    p_dispute_id: disputeId,
    p_sender_id: senderId,
    p_message: message,
  })
  if (error) throw error
}
