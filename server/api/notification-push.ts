import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { getFirebaseApp, isInvalidTokenCode, sendWebPushBatch } from '../lib/firebasePush.js'

type PushTarget = { user_id: string; token: string }

type PushRequest = {
  campaignId?: string
  adminId?: string
  title?: string
  body?: string
  link?: string
  tokens?: Array<string | { user_id?: string; userId?: string; token?: string }>
}

function jsonBody(req: VercelRequest): PushRequest {
  if (typeof req.body === 'string') return JSON.parse(req.body) as PushRequest
  return (req.body ?? {}) as PushRequest
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase server configuration is missing')

    const authorization = req.headers.authorization || ''
    const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
    if (!idToken) {
      res.status(401).json({ error: 'Admin authentication is required' })
      return
    }

    const app = await getFirebaseApp()
    const { getAuth } = await import('firebase-admin/auth')
    const decoded = await getAuth(app).verifyIdToken(idToken)
    const input = jsonBody(req)
    const adminId = decoded.uid
    if (input.adminId && input.adminId !== adminId) {
      res.status(403).json({ error: 'Admin identity mismatch' })
      return
    }
    if (!input.campaignId) {
      res.status(400).json({ error: 'campaignId is required' })
      return
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: campaign, error: campaignError } = await supabase
      .from('notification_campaigns')
      .select('id, title, body, link, send_push')
      .eq('id', input.campaignId)
      .maybeSingle()
    if (campaignError) throw campaignError
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' })
      return
    }
    if (!campaign.send_push) {
      res.status(400).json({ error: 'This campaign is not configured for push delivery' })
      return
    }

    const { data: resolvedTargets, error: targetError } = await supabase.rpc('admin_get_campaign_push_targets', {
      p_admin_id: adminId,
      p_campaign_id: input.campaignId,
    })
    if (targetError) throw targetError

    // Never trust tokens supplied by the browser. The permission-checked RPC
    // resolves only tokens belonging to this campaign's approved recipients.
    const targets: PushTarget[] = (resolvedTargets || []).filter((target: PushTarget) => target.token)
    const uniqueTargets = [...new Map(targets.map((target) => [target.token, target])).values()]

    let sent = 0
    let failed = 0
    for (let offset = 0; offset < uniqueTargets.length; offset += 500) {
      const batch = uniqueTargets.slice(offset, offset + 500)
      const title = campaign.title || input.title || 'BikriKoro'
      const body = campaign.body || input.body || ''
      const link = campaign.link || input.link || '/'
      const response = await sendWebPushBatch(app, batch.map((target) => target.token), {
        title,
        body,
        link,
        data: { campaignId: input.campaignId },
      })

      await Promise.all(response.responses.map(async (result, index) => {
        const target = batch[index]
        const errorCode = result.error?.code
        const status = result.success ? 'DELIVERED' : isInvalidTokenCode(errorCode) ? 'DISABLED' : 'FAILED'
        if (result.success) sent += 1
        else failed += 1
        if (!target.user_id) return
        const { error } = await supabase.rpc('admin_record_push_delivery', {
          p_admin_id: adminId,
          p_campaign_id: input.campaignId,
          p_user_id: target.user_id,
          p_token: target.token,
          p_status: status,
          p_provider_message_id: result.messageId || null,
          p_error_message: result.error?.message || null,
        })
        if (error) console.error('Failed to record push delivery', error)
      }))
    }

    const { error: finishError } = await supabase.rpc('admin_finish_notification_campaign', {
      p_admin_id: adminId,
      p_campaign_id: input.campaignId,
    })
    if (finishError) throw finishError

    res.status(200).json({ campaignId: input.campaignId, targeted: uniqueTargets.length, sent, failed })
  } catch (error) {
    console.error('Notification push delivery failed', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Push delivery failed' })
  }
}
