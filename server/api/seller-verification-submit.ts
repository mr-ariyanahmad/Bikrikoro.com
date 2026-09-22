import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase, getVerifiedFirebaseToken, isAuthError } from './_server-auth.js'

type Body = {
  listingMode?: string; businessType?: string; sector?: string; fullName?: string; phone?: string
  nidOrBusinessNumber?: string; businessName?: string | null; shopName?: string; shopUsername?: string
  address?: string; documents?: Array<{ document_type: string; document_path: string }>
}

function bodyOf(req: VercelRequest): Body {
  if (typeof req.body === 'string') return JSON.parse(req.body) as Body
  return (req.body ?? {}) as Body
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); res.status(405).json({ error: 'Method not allowed' }); return }
  try {
    const token = await getVerifiedFirebaseToken(req)
    const input = bodyOf(req)
    if (!input.listingMode || !input.businessType || !input.sector || !input.fullName?.trim() || !input.phone?.trim() || !input.nidOrBusinessNumber?.trim() || !input.shopName?.trim() || !input.shopUsername?.trim() || !input.address?.trim() || !Array.isArray(input.documents) || input.documents.length === 0) {
      res.status(400).json({ error: 'সব প্রয়োজনীয় seller information ও documents দিতে হবে।' })
      return
    }
    const documents = input.documents.filter((document) => document && typeof document.document_type === 'string' && typeof document.document_path === 'string').map((document) => ({ document_type: document.document_type.trim(), document_path: document.document_path.trim() }))
    if (!documents.length || documents.some((document) => !document.document_type || !document.document_path || document.document_path.includes('..') || !document.document_path.startsWith(`${token.uid}/`))) {
      res.status(400).json({ error: 'Verification document path invalid' })
      return
    }
    const { data, error } = await getServiceSupabase().rpc('submit_seller_registration_v3', {
      p_user_id: token.uid,
      p_listing_mode: input.listingMode,
      p_business_type: input.businessType,
      p_sector: input.sector,
      p_full_name: input.fullName.trim(),
      p_phone: input.phone.trim(),
      p_nid_or_business_number: input.nidOrBusinessNumber.trim(),
      p_business_name: input.businessName?.trim() || null,
      p_shop_name: input.shopName.trim(),
      p_shop_username: input.shopUsername.trim(),
      p_address: input.address.trim(),
      p_documents: documents,
    })
    if (error) throw error
    res.status(200).json({ registrationId: data })
  } catch (error) {
    if (isAuthError(error)) { res.status(401).json({ error: 'Firebase authentication is required' }); return }
    console.error('Seller verification submission failed:', error)
    res.status(400).json({ error: error instanceof Error ? error.message : 'Seller verification submission failed' })
  }
}
