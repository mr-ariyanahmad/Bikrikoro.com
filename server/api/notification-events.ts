import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { getFirebaseApp, isInvalidTokenCode, sendWebPushBatch } from '../lib/firebasePush.js'
import { isResendConfigured, sendNewOrderEmail } from '../lib/resendEmail.js'

type NotificationRecord = {
  id?: string
  user_id?: string
  type?: string
  title?: string
  body?: string
  link?: string | null
  campaign_id?: string | null
  metadata?: Record<string, unknown> | null
}

type WebhookPayload = {
  type?: string
  table?: string
  schema?: string
  record?: NotificationRecord | null
}

type QueuedDelivery = {
  delivery_id: string
  user_id: string
  token: string
}

type ProfileEmail = {
  name?: string | null
  email?: string | null
}

type OrderEmailRecord = {
  id: string
  product_title: string
  price: number | string
  status: string
  buyer_id: string
  seller_id: string
  buyer?: ProfileEmail | ProfileEmail[] | null
  seller?: ProfileEmail | ProfileEmail[] | null
}

function parseBody(req: VercelRequest): WebhookPayload {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body) as WebhookPayload
    } catch {
      throw new Error('Invalid webhook JSON')
    }
  }
  return (req.body ?? {}) as WebhookPayload
}

function getHeader(req: VercelRequest, name: string) {
  const value = req.headers[name]
  return Array.isArray(value) ? value[0] : value
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) return String(error.message)
  return 'Notification event delivery failed'
}

function oneProfile(value: ProfileEmail | ProfileEmail[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? {} : value ?? {}
}

async function sendOrderEmailIfNeeded(
  supabase: ReturnType<typeof createClient>,
  notification: NotificationRecord,
) {
  const metadata = notification.metadata ?? {}
  if (metadata.event !== 'ORDER_CREATED') return { status: 'NOT_ORDER' as const }
  if (!isResendConfigured()) return { status: 'SKIPPED' as const, reason: 'RESEND_NOT_CONFIGURED' }

  const orderId = typeof metadata.order_id === 'string' ? metadata.order_id.trim() : ''
  const role = metadata.recipient_role === 'SELLER' ? 'SELLER' as const : metadata.recipient_role === 'CUSTOMER' ? 'CUSTOMER' as const : null
  if (!orderId || !role) return { status: 'SKIPPED' as const, reason: 'ORDER_METADATA_INCOMPLETE' }

  const { data: order, error } = await supabase
    .from('orders')
    .select('id, product_title, price, status, buyer_id, seller_id, buyer:profiles!orders_buyer_id_fkey(name,email), seller:profiles!orders_seller_id_fkey(name,email)')
    .eq('id', orderId)
    .maybeSingle()
  if (error) throw error
  if (!order) return { status: 'SKIPPED' as const, reason: 'ORDER_NOT_FOUND' }

  const typedOrder = order as OrderEmailRecord
  const customer = oneProfile(typedOrder.buyer)
  const seller = oneProfile(typedOrder.seller)
  const recipient = role === 'CUSTOMER' ? customer : seller
  const recipientEmail = recipient.email?.trim()
  if (!recipientEmail) return { status: 'SKIPPED' as const, reason: `${role}_EMAIL_MISSING` }

  const siteUrl = (process.env.SITE_URL || 'https://bikrikoro.com').replace(/\/$/, '')
  const result = await sendNewOrderEmail({
    orderId: typedOrder.id,
    role,
    to: recipientEmail,
    productTitle: typedOrder.product_title,
    price: typedOrder.price,
    status: typedOrder.status,
    customerName: customer.name?.trim() || 'Customer',
    sellerName: seller.name?.trim() || 'Seller',
    orderLink: `${siteUrl}/orders/${typedOrder.id}`,
  })
  return result.skipped ? { status: 'SKIPPED' as const, reason: result.reason } : { status: 'SENT' as const, id: result.id }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const expectedSecret = process.env.NOTIFICATION_WEBHOOK_SECRET?.trim()
    if (!expectedSecret) {
      res.status(503).json({ error: 'Notification webhook is not configured' })
      return
    }
    if (getHeader(req, 'x-bikrikoro-webhook-secret') !== expectedSecret) {
      res.status(401).json({ error: 'Invalid notification webhook secret' })
      return
    }

    const payload = parseBody(req)
    if (payload.type && payload.type !== 'INSERT') {
      res.status(200).json({ ignored: true, reason: 'Only INSERT events are delivered' })
      return
    }
    if (payload.table && payload.table !== 'notifications') {
      res.status(200).json({ ignored: true, reason: 'Unexpected table' })
      return
    }

    const notification = payload.record
    const notificationId = notification?.id?.trim()
    if (!notificationId) {
      res.status(400).json({ error: 'Notification id is required' })
      return
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase server configuration is missing')
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

    let emailStatus: 'NOT_ORDER' | 'SKIPPED' | 'SENT' | 'FAILED' = 'NOT_ORDER'
    let emailReason: string | undefined
    try {
      const emailResult = await sendOrderEmailIfNeeded(supabase, notification ?? {})
      emailStatus = emailResult.status
      if ('reason' in emailResult) emailReason = emailResult.reason
    } catch (error) {
      emailStatus = 'FAILED'
      emailReason = getErrorMessage(error)
      console.error('New order email delivery failed', error)
    }

    const { data: queued, error: queueError } = await supabase.rpc('queue_notification_push_deliveries', {
      p_notification_id: notificationId,
    })
    if (queueError) throw queueError

    const targets = (queued ?? []) as QueuedDelivery[]
    if (targets.length === 0) {
      res.status(200).json({ notificationId, targeted: 0, sent: 0, failed: 0, emailStatus, emailReason })
      return
    }

    const app = await getFirebaseApp()
    const title = notification?.title?.trim() || 'BikriKoro'
    const body = notification?.body?.trim() || 'আপনার জন্য নতুন আপডেট আছে।'
    const link = notification?.link?.trim() || '/notifications'
    let sent = 0
    let failed = 0

    for (let offset = 0; offset < targets.length; offset += 500) {
      const batch = targets.slice(offset, offset + 500)
      const response = await sendWebPushBatch(app, batch.map((target) => target.token), {
        title,
        body,
        link,
        data: { notificationId, notificationType: notification?.type || 'SYSTEM' },
      })

      await Promise.all(response.responses.map(async (result, index) => {
        const target = batch[index]
        const invalidToken = isInvalidTokenCode(result.error?.code)
        const status = result.success ? 'DELIVERED' : invalidToken ? 'DISABLED' : 'FAILED'
        if (result.success) sent += 1
        else failed += 1

        const { error: updateError } = await supabase
          .from('notification_deliveries')
          .update({
            status,
            provider_message_id: result.messageId || null,
            error_message: result.error?.message || null,
            delivered_at: result.success ? new Date().toISOString() : null,
          })
          .eq('id', target.delivery_id)
        if (updateError) console.error('Failed to record notification event delivery', updateError)

        if (invalidToken) {
          const { error: disableError } = await supabase
            .from('notification_push_tokens')
            .update({ enabled: false, last_seen_at: new Date().toISOString() })
            .eq('user_id', target.user_id)
            .eq('token', target.token)
          if (disableError) console.error('Failed to disable invalid push token', disableError)
        }
      }))
    }

    res.status(200).json({ notificationId, targeted: targets.length, sent, failed, emailStatus, emailReason })
  } catch (error) {
    console.error('Notification event delivery failed', error)
    res.status(500).json({ error: getErrorMessage(error) })
  }
}
