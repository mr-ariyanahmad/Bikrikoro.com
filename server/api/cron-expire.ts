import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase } from './_server-auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); res.status(405).json({ error: 'Method not allowed' }); return }
  const configuredSecret = process.env.CRON_SECRET
  const authorization = req.headers.authorization
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!configuredSecret || token !== configuredSecret) { res.status(401).json({ error: 'Unauthorized' }); return }
  try {
    const supabase = getServiceSupabase()
    const { data, error } = await supabase.rpc('expire_pending_payment_orders', { p_limit: 500 })
    if (error) throw error
    res.status(200).json({ ok: true, expired: data ?? 0 })
  } catch (error) {
    console.error('Pending payment expiry cron failed:', error)
    res.status(500).json({ error: 'Expiry cleanup failed' })
  }
}
