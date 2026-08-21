import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase, getVerifiedFirebaseToken, isAuthError } from './_server-auth.js'

type SupabaseErrorLike = { message?: unknown; details?: unknown; hint?: unknown }

function errorMessage(error: unknown) {
  if (error && typeof error === 'object') {
    const value = error as SupabaseErrorLike
    return [value.message, value.details, value.hint].filter((part): part is string => typeof part === 'string' && part.trim().length > 0).join(' ')
  }
  return error instanceof Error ? error.message : ''
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  try {
    const token = await getVerifiedFirebaseToken(req)
    const supabase = getServiceSupabase()
    const { data, error } = await supabase.rpc('user_wallet_balance', { p_user_id: token.uid })
    if (error) throw error
    const balance = Array.isArray(data) ? data[0] : data
    res.status(200).json({ available_balance: Number(balance?.available_balance ?? 0) })
  } catch (error) {
    if (isAuthError(error)) {
      res.status(401).json({ error: 'Firebase authentication is required' })
      return
    }
    console.error('Wallet balance read failed:', error)
    res.status(400).json({ error: errorMessage(error) || 'Wallet balance পাওয়া যায়নি।' })
  }
}
