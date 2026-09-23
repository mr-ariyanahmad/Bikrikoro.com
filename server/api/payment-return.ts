import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase } from './_server-auth.js'

function queryValue(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); res.status(405).send('Method not allowed'); return }
  const invoiceId = queryValue(req.query.invoice_id) || queryValue(req.query.invoice)
  const requestedOrderId = queryValue(req.query.order_id) || ''
  const siteUrl = (process.env.SITE_URL || 'https://bikrikoro.com').replace(/\/$/, '')
  const callback = (orderId: string, invoice: string, error = false) => {
    const params = new URLSearchParams({ order_id: orderId })
    if (invoice) params.set('invoice_id', invoice)
    if (error) params.set('reconcile_error', '1')
    return `${siteUrl}/orders/payment-callback?${params.toString()}`
  }

  if (!invoiceId) { res.redirect(302, callback(requestedOrderId, '')); return }
  try {
    const supabase = getServiceSupabase()
    const { data, error } = await supabase.functions.invoke<{ status?: string; error?: string }>('uddoktapay-reconcile-payment', {
      body: { orderId: requestedOrderId, invoiceId },
    })
    if (error) throw error
    const status = data?.status ?? ''
    res.redirect(302, callback(requestedOrderId, invoiceId, Boolean(data?.error && status !== 'ESCROW_HELD' && status !== 'DIGITAL_DELIVERED' && status !== 'COMPLETED')))
  } catch (error) {
    console.error('UddoktaPay return reconciliation failed:', error)
    res.redirect(302, callback(requestedOrderId, invoiceId, true))
  }
}
