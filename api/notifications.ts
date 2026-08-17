import { getServiceSupabase, isAuthError, verifyFirebaseRequest } from './_server-auth'

type NotificationRequest = {
  action?: 'list' | 'count' | 'read' | 'mark_all' | 'register_token' | 'disable_token' | 'admin_campaigns' | 'create_campaign'
  notificationId?: string
  token?: string
  platform?: string
  browser?: string
  targetType?: 'ALL' | 'CUSTOMERS' | 'SELLERS' | 'USER_LIST'
  targetUserIds?: string[]
  title?: string
  body?: string
  link?: string | null
  sendPush?: boolean
}

function parseBody(req: VercelRequest): NotificationRequest {
  if (typeof req.body === 'string') return JSON.parse(req.body) as NotificationRequest
  return (req.body ?? {}) as NotificationRequest
}

function writeError(res: VercelResponse, error: unknown) {
  const message = error instanceof Error ? error.message : 'Notification request failed'
  if (message === 'AUTH_REQUIRED' || message.includes('Firebase ID token')) {
    res.status(401).json({ error: 'Authentication is required' })
    return
  }
  res.status(500).json({ error: message })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const userId = await verifyFirebaseRequest(req)
    const input = req.method === 'GET' ? { action: typeof req.query.action === 'string' ? req.query.action : 'list' } : parseBody(req)
    const supabase = getServiceSupabase()

    if (input.action === 'list') {
      const { data, error } = await supabase.rpc('get_my_notifications', { p_user_id: userId, p_limit: 60 })
      if (error) throw error
      res.status(200).json({ data: data ?? [] })
      return
    }

    if (input.action === 'count') {
      const { data, error } = await supabase.rpc('get_my_unread_notification_count', { p_user_id: userId })
      if (error) throw error
      res.status(200).json({ count: Number(data ?? 0) })
      return
    }

    if (input.action === 'register_token') {
      if (!input.token) {
        res.status(400).json({ error: 'token is required' })
        return
      }
      const { error } = await supabase.rpc('register_notification_push_token', { p_user_id: userId, p_token: input.token, p_platform: input.platform || 'WEB', p_browser: input.browser || '' })
      if (error) throw error
      res.status(200).json({ ok: true })
      return
    }

    if (input.action === 'disable_token') {
      if (!input.token) {
        res.status(400).json({ error: 'token is required' })
        return
      }
      const { error } = await supabase.rpc('disable_notification_push_token', { p_user_id: userId, p_token: input.token })
      if (error) throw error
      res.status(200).json({ ok: true })
      return
    }

    if (input.action === 'read') {
      if (!input.notificationId) {
        res.status(400).json({ error: 'notificationId is required' })
        return
      }
      const { error } = await supabase.rpc('mark_notification_read', { p_notification_id: input.notificationId, p_user_id: userId })
      if (error) throw error
      res.status(200).json({ ok: true })
      return
    }

    if (input.action === 'mark_all') {
      const { data, error } = await supabase.rpc('mark_all_notifications_read', { p_user_id: userId })
      if (error) throw error
      res.status(200).json({ count: Number(data ?? 0) })
      return
    }

    if (input.action === 'admin_campaigns') {
      const { data, error } = await supabase.rpc('admin_list_notification_campaigns', { p_admin_id: userId })
      if (error) throw error
      res.status(200).json({ data: data ?? [] })
      return
    }

    if (input.action === 'create_campaign') {
      const targetType = input.targetType
      const title = input.title?.trim() || ''
      const body = input.body?.trim() || ''
      const targetUserIds = Array.isArray(input.targetUserIds) ? input.targetUserIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0).map((value) => value.trim()) : []
      if (!targetType || !title || !body) {
        res.status(400).json({ error: 'Target, title, and body are required' })
        return
      }
      const { data, error } = await supabase.rpc('admin_create_notification_campaign', {
        p_admin_id: userId,
        p_target_type: targetType,
        p_target_user_ids: targetUserIds,
        p_title: title,
        p_body: body,
        p_link: input.link?.trim() || null,
        p_send_push: Boolean(input.sendPush),
      })
      if (error) throw error
      const campaign = Array.isArray(data) ? data[0] : data
      res.status(200).json({ campaign })
      return
    }

    res.status(400).json({ error: 'Unknown notification action' })
  } catch (error) {
    if (isAuthError(error)) {
      res.status(401).json({ error: 'Authentication is required' })
      return
    }
    console.error('Notification API failed', error)
    writeError(res, error)
  }
}
