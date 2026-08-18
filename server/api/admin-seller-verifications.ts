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

type ProfileRow = { id: string; name: string | null; photo_url: string | null; shop_name: string | null; shop_description: string | null }

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

    const registrationRows = registrations ?? []
    const registrationIds = registrationRows.map((registration) => registration.id)
    const profileIds = registrationRows.map((registration) => registration.user_id)
    let profiles: ProfileRow[] = []
    if (profileIds.length) {
      const profileResult = await supabase.from('profiles').select('id, name, photo_url, shop_name, shop_description').in('id', profileIds)
      if (profileResult.error && isMissingShopProfileColumns(profileResult.error)) {
        const legacyProfileResult = await supabase.from('profiles').select('id, name, photo_url').in('id', profileIds)
        if (legacyProfileResult.error) throw legacyProfileResult.error
        profiles = ((legacyProfileResult.data ?? []) as Array<{ id: string; name: string | null; photo_url: string | null }>).map((profile) => ({ ...profile, shop_name: null, shop_description: null }))
      } else {
        if (profileResult.error) throw profileResult.error
        profiles = (profileResult.data ?? []) as ProfileRow[]
      }
    }
    const profilesById = Object.fromEntries(profiles.map((profile) => [profile.id, profile]))
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
      registrations: registrationRows.map((registration) => ({
        ...registration,
        seller_profile: profilesById[registration.user_id] ?? null,
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
    res.status(500).json({ error: getSupabaseErrorMessage(error) })
  }
}

function isMissingShopProfileColumns(error: unknown) {
  const text = getSupabaseErrorMessage(error).toLowerCase()
  return (text.includes('shop_name') || text.includes('shop_description')) && (text.includes('column') || text.includes('schema cache') || text.includes('does not exist'))
}

function getSupabaseErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === 'object') {
    const value = error as { message?: unknown; details?: unknown; hint?: unknown }
    const parts = [value.message, value.details, value.hint].filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    if (parts.length > 0) return parts.join(' ')
  }
  return 'Seller verification data লোড করা যায়নি।'
}
