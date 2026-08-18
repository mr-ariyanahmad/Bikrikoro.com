import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase, getVerifiedFirebaseToken, isAuthError } from './_server-auth'

const BUCKET = 'seller-verification-docs'

function queryPath(req: VercelRequest) {
  return typeof req.query.path === 'string' ? req.query.path.trim() : ''
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const path = queryPath(req)
  if (!path || path.includes('..') || path.startsWith('/')) {
    res.status(400).json({ error: 'A valid document path is required' })
    return
  }

  try {
    const token = await getVerifiedFirebaseToken(req)
    const userId = token.uid
    const supabase = getServiceSupabase()

    const { data: document, error: documentError } = await supabase
      .from('seller_verification_documents')
      .select('registration_id, document_path')
      .eq('document_path', path)
      .maybeSingle()
    if (documentError) throw documentError

    let ownerId: string | null = null
    if (document?.registration_id) {
      const { data: registration, error: registrationError } = await supabase
        .from('seller_registrations')
        .select('user_id')
        .eq('id', document.registration_id)
        .maybeSingle()
      if (registrationError) throw registrationError
      ownerId = registration?.user_id ?? null
    } else {
      const { data: legacyRegistration, error: legacyError } = await supabase
        .from('seller_registrations')
        .select('user_id')
        .eq('document_path', path)
        .maybeSingle()
      if (legacyError) throw legacyError
      ownerId = legacyRegistration?.user_id ?? null
    }

    const { data: access, error: accessError } = await supabase.rpc('admin_access', { p_user_id: userId })
    if (accessError) throw accessError
    const isAdmin = Array.isArray(access) && access.some((row: { is_admin?: boolean }) => row.is_admin === true)
    if (!ownerId || (ownerId !== userId && !isAdmin)) {
      res.status(403).json({ error: 'আপনার এই document দেখার অনুমতি নেই।' })
      return
    }

    const { data: signed, error: signedError } = await supabase.storage.from(BUCKET).createSignedUrl(path, 10 * 60)
    if (signedError) throw signedError
    res.setHeader('Cache-Control', 'private, no-store')
    res.status(200).json({ signedUrl: signed.signedUrl })
  } catch (error) {
    if (isAuthError(error)) {
      res.status(401).json({ error: 'Firebase authentication is required' })
      return
    }
    console.error('Verification document URL failed:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Document URL তৈরি করা যায়নি।' })
  }
}
