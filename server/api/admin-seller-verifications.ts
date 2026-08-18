import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase, getVerifiedFirebaseToken, isAuthError } from './_server-auth.js'

const BUCKET = 'seller-verification-docs'

type DocumentRow = {
  id: string
  registration_id: string
  document_type: string
  document_path: string
  status: string
  admin_note: string
  reviewed_by: string | null
  reviewed_at: string | null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const token = await getVerifiedFirebaseToken(req)
    const adminId = token.uid
    const supabase = getServiceSupabase()
    const { data: access, error: accessError } = await supabase.rpc('admin_access', { p_user_id: adminId })
    if (accessError) throw accessError
    if (!Array.isArray(access) || !access.some((row: { is_admin?: boolean }) => row.is_admin === true)) {
      res.status(403).json({ error: 'Admin permission is required' })
      return
    }

    const { data: registrations, error: registrationError } = await supabase
      .from('seller_registrations')
      .select('*')
      .eq('status', 'PENDING')
      .order('submitted_at', { ascending: true })
      .range(0, 49)
    if (registrationError) throw registrationError

    const registrationIds = (registrations ?? []).map((registration) => registration.id)
    const { data: documents, error: documentError } = registrationIds.length
      ? await supabase.from('seller_verification_documents').select('*').in('registration_id', registrationIds)
      : { data: [], error: null }
    if (documentError) throw documentError

    const urls: Record<string, string> = {}
    await Promise.all(((documents ?? []) as DocumentRow[]).map(async (document) => {
      const { data: signed, error: signedError } = await supabase.storage.from(BUCKET).createSignedUrl(document.document_path, 10 * 60)
      if (!signedError && signed?.signedUrl) urls[document.id] = signed.signedUrl
    }))

    const { data: history, error: historyError } = await supabase.rpc('admin_list_recent_seller_verification_history', { p_admin_id: adminId, p_limit: 50 })
    if (historyError) throw historyError

    res.setHeader('Cache-Control', 'private, no-store')
    res.status(200).json({
      registrations: (registrations ?? []).map((registration) => ({
        ...registration,
        documents: ((documents ?? []) as DocumentRow[]).filter((document) => document.registration_id === registration.id).map((document) => ({
          ...document,
          document_url: urls[document.id] ?? null,
        })),
      })),
      history: history ?? [],
    })
  } catch (error) {
    if (isAuthError(error)) {
      res.status(401).json({ error: 'Firebase authentication is required' })
      return
    }
    console.error('Admin seller verification load failed:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Seller verification data লোড করা যায়নি।' })
  }
}
