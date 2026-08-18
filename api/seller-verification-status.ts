import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase, getVerifiedFirebaseToken, isAuthError } from './_server-auth'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const token = await getVerifiedFirebaseToken(req)
    const supabase = getServiceSupabase()
    const { data: registration, error } = await supabase
      .from('seller_registrations')
      .select('id, status, listing_mode, business_type, sector, full_name, phone, nid_or_business_number, business_name, address, document_path, admin_note, submitted_at, reviewed_at')
      .eq('user_id', token.uid)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error

    res.setHeader('Cache-Control', 'private, no-store')
    res.status(200).json({
      registration: registration ?? null,
      isSeller: registration?.status === 'APPROVED',
      digitalVerified: registration?.status === 'APPROVED' && registration.listing_mode === 'DIGITAL',
    })
  } catch (error) {
    if (isAuthError(error)) {
      res.status(401).json({ error: 'Firebase authentication is required' })
      return
    }
    console.error('Seller verification status failed:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Seller verification status লোড করা যায়নি।' })
  }
}
