import { createClient } from '@supabase/supabase-js'
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getMessaging } from 'firebase-admin/messaging'

type PushTarget = { user_id: string; token: string }

type PushRequest = {
  campaignId?: string
  adminId?: string
  title?: string
  body?: string
  link?: string
  tokens?: Array<string | { user_id?: string; userId?: string; token?: string }>
}

function getFirebaseApp(): App {
  const existing = getApps()[0]
  if (existing) return existing

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (json) {
    const parsed = JSON.parse(json) as { project_id?: string; client_email?: string; private_key?: string }
    return initializeApp({
      credential: cert({
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        privateKey: parsed.private_key?.replace(/\\n/g, '\n'),
      }),
    })
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, '\n')
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase service-account configuration is missing')
  }
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
}

function jsonBody(req: VercelRequest): PushRequest {
  if (typeof req.body === 'string') return JSON.parse(req.body) as PushRequest
  return (req.body ?? {}) as PushRequest
}

function isInvalidTokenCode(code?: string) {
  return code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token'
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

    const app = getFirebaseApp()
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
    const messaging = getMessaging(app)
    for (let offset = 0; offset < uniqueTargets.length; offset += 500) {
      const batch = uniqueTargets.slice(offset, offset + 500)
      const response = await messaging.sendEachForMulticast({
        tokens: batch.map((target) => target.token),
        notification: { title: campaign.title || input.title || 'BikriKoro', body: campaign.body || input.body || '' },
        data: {
          campaignId: input.campaignId,
          link: campaign.link || input.link || '/',
          title: campaign.title || input.title || 'BikriKoro',
          body: campaign.body || input.body || '',
        },
        webpush: {
          fcmOptions: { link: campaign.link || input.link || '/' },
        },
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
