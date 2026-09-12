import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase, getVerifiedFirebaseToken, isAuthError } from './_server-auth.js'

type Body = { name?: string; shopName?: string; shopDescription?: string }

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === 'object') {
    const value = error as { message?: unknown; details?: unknown; hint?: unknown }
    const parts = [value.message, value.details, value.hint].filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    if (parts.length > 0) return parts.join(' ')
  }
  return 'Basic Seller setup failed'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); res.status(405).json({ error: 'Method not allowed' }); return }
  try {
    const token = await getVerifiedFirebaseToken(req)
    if (token.email_verified !== true) {
      res.status(409).json({ error: 'প্রথমে আপনার email verify করুন।' })
      return
    }
    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {}) as Body
    const name = body.name?.trim() || token.name?.trim() || ''
    if (name.length < 2) throw new Error('আপনার নাম দিন।')
    const supabase = getServiceSupabase()
    const { error: verifiedAtError } = await supabase.from('profiles').update({ seller_email_verified_at: new Date().toISOString() }).eq('id', token.uid)
    if (verifiedAtError) throw verifiedAtError
    const { data, error } = await supabase.rpc('start_basic_seller', {
      p_user_id: token.uid,
      p_name: name,
      p_shop_name: body.shopName?.trim() || null,
      p_shop_description: body.shopDescription?.trim() || null,
    })
    if (error) throw error
    res.setHeader('Cache-Control', 'private, no-store')
    res.status(200).json({ profile: data, sellerLevel: 'BASIC' })
  } catch (error) {
    if (isAuthError(error)) { res.status(401).json({ error: 'Firebase authentication is required' }); return }
    console.error('Basic seller onboarding failed:', error)
    res.status(400).json({ error: errorMessage(error) })
  }
}
