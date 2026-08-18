import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase, getVerifiedFirebaseToken, isAuthError } from './_server-auth.js'

function writeError(res: VercelResponse, error: unknown) {
  const message = error instanceof Error ? error.message : 'Profile bootstrap failed'
  if (message === 'AUTH_REQUIRED' || message.includes('Firebase ID token')) {
    res.status(401).json({ error: 'Authentication is required' })
    return
  }
  res.status(500).json({ error: message })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const token = await getVerifiedFirebaseToken(req)
    const supabase = getServiceSupabase()
    const { data: existing, error: readError } = await supabase
      .from('profiles')
      .select('id, email, name, phone, photo_url')
      .eq('id', token.uid)
      .maybeSingle()
    if (readError) throw readError

    if (!existing) {
      const { error: insertError } = await supabase.from('profiles').insert({
        id: token.uid,
        name: token.name ?? '',
        phone: token.phone_number ?? null,
        email: token.email ?? null,
        photo_url: token.picture ?? null,
      })
      if (insertError) throw insertError
    } else if (!existing.email && token.email) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ email: token.email })
        .eq('id', token.uid)
      if (updateError) throw updateError
    }

    res.status(200).json({ ok: true, userId: token.uid, created: !existing })
  } catch (error) {
    if (isAuthError(error)) {
      res.status(401).json({ error: 'Authentication is required' })
      return
    }
    console.error('Profile bootstrap failed', error)
    writeError(res, error)
  }
}

