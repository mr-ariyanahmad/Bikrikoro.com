import { auth } from '@/lib/firebase'
import type { DisputeReason } from '@/types/order'

async function callOrderAction(action: string, payload: Record<string, unknown>) {
  if (!auth.currentUser) throw new Error('আপনার Firebase session পাওয়া যায়নি। আবার login করুন।')
  const idToken = await auth.currentUser.getIdToken()
  const response = await fetch('/api/order-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ action, ...payload }),
  })
  const result = await response.json().catch(() => ({})) as { error?: string; data?: unknown }
  if (!response.ok) throw new Error(result.error || `Order action failed (HTTP ${response.status})`)
  return result.data
}

export async function confirmOrderDelivery(orderId: string, _buyerId: string) {
  await callOrderAction('confirm_delivery', { orderId })
}

export async function confirmDigitalDelivery(orderId: string, _buyerId: string) {
  await callOrderAction('buyer_confirm_digital', { orderId })
}

export async function sellerDeliverDigital(orderId: string, _sellerId: string) {
  await callOrderAction('digital_deliver', { orderId })
}

export async function buyerCancelOrder(orderId: string, _buyerId: string) {
  await callOrderAction('buyer_cancel', { orderId })
}

export async function sellerMarkPreparing(orderId: string, _sellerId: string) {
  await callOrderAction('seller_prepare', { orderId })
}

export async function sellerMarkShipped(orderId: string, _sellerId: string) {
  await callOrderAction('seller_ship', { orderId })
}

export async function sellerMarkDelivered(orderId: string, _sellerId: string) {
  await callOrderAction('seller_deliver', { orderId })
}

export async function sellerCancelOrder(orderId: string, _sellerId: string) {
  await callOrderAction('seller_cancel', { orderId })
}

export async function reportOrderDispute(params: {
  orderId: string
  buyerId: string
  reason: DisputeReason
  description: string
  evidenceUrls: string[]
}): Promise<string> {
  const data = await callOrderAction('report_dispute', {
    orderId: params.orderId,
    reason: params.reason,
    description: params.description,
    evidenceUrls: params.evidenceUrls,
  })
  return data as string
}

export async function sendDisputeMessage(disputeId: string, _senderId: string, message: string) {
  await callOrderAction('send_dispute_message', { disputeId, message })
}
