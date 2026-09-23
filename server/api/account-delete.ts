import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getFirebaseApp, getServiceSupabase, getVerifiedFirebaseToken, isAuthError } from './_server-auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const token = await getVerifiedFirebaseToken(req)
    const body = typeof req.body === 'string' ? JSON.parse(req.body) as { confirmation?: string } : req.body as { confirmation?: string } | undefined
    if (body?.confirmation !== 'DELETE') {
      res.status(400).json({ error: 'Confirmation is required' })
      return
    }

    const supabase = getServiceSupabase()
    const { data: activeOrders, error: orderError } = await supabase
      .from('orders')
      .select('id, status')
      .or(`buyer_id.eq.${token.uid},seller_id.eq.${token.uid}`)
      .not('status', 'in', '(COMPLETED,CANCELLED,REFUNDED)')
      .limit(1)
    if (orderError) throw orderError
    if (activeOrders && activeOrders.length > 0) {
      res.status(409).json({ error: 'আপনার একটি চলমান order আছে। আগে order সম্পন্ন বা বাতিল করুন, অথবা Support Center-এ যোগাযোগ করুন।' })
      return
    }

    const { getAuth } = await import('firebase-admin/auth')
    await getAuth(await getFirebaseApp()).deleteUser(token.uid)

    const { error: profileError } = await supabase.from('profiles').delete().eq('id', token.uid)
    if (profileError) console.error('Account profile cleanup failed after auth deletion:', profileError)

    res.status(200).json({ ok: true })
  } catch (error) {
    if (isAuthError(error)) {
      res.status(401).json({ error: 'Authentication is required' })
      return
    }
    console.error('Account deletion failed:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Account deletion failed' })
  }
}
