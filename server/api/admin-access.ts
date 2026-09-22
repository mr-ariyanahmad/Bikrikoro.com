import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase, getVerifiedFirebaseToken, isAuthError } from './_server-auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  try {
    const token = await getVerifiedFirebaseToken(req)
    const { data, error } = await getServiceSupabase().rpc('admin_access', { p_user_id: token.uid })
    if (error) throw error
    const access = Array.isArray(data) ? data[0] ?? null : data ?? null
    res.setHeader('Cache-Control', 'private, no-store')
    res.status(200).json({ data: access })
  } catch (error) {
    if (isAuthError(error)) {
      res.status(401).json({ error: 'Firebase authentication is required' })
      return
    }
    console.error('Admin access discovery failed:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Admin access check failed' })
  }
}
