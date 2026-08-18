import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase, getVerifiedFirebaseToken, isAuthError } from './_server-auth'

type Body = { amount?: number; method?: 'BKASH' | 'NAGAD' | 'BANK'; accountDetails?: string }

function bodyOf(req: VercelRequest): Body {
  if (typeof req.body === 'string') return JSON.parse(req.body) as Body
  return (req.body ?? {}) as Body
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  try {
    const token = await getVerifiedFirebaseToken(req)
    const input = bodyOf(req)
    const amount = Number(input.amount)
    if (!Number.isFinite(amount) || amount <= 0 || !input.method || !input.accountDetails?.trim()) throw new Error('উত্তোলনের তথ্য অসম্পূর্ণ।')
    const supabase = getServiceSupabase()
    const { data, error } = await supabase.rpc('request_wallet_withdrawal', { p_user_id: token.uid, p_amount: amount, p_method: input.method, p_account_details: input.accountDetails.trim() })
    if (error) throw error
    res.status(200).json({ requestId: data })
  } catch (error) {
    if (isAuthError(error)) {
      res.status(401).json({ error: 'Firebase authentication is required' })
      return
    }
    console.error('Wallet withdrawal failed:', error)
    res.status(400).json({ error: error instanceof Error ? error.message : 'উত্তোলনের অনুরোধ পাঠানো যায়নি।' })
  }
}
