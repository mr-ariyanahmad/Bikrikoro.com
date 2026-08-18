import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase, getVerifiedFirebaseToken, isAuthError } from './_server-auth.js'
import { sendWelcomeEmail } from '../lib/resendEmail.js'

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
      .select('id, email, name, phone, photo_url, welcome_email_status, welcome_email_sent_at')
      .eq('id', token.uid)
      .maybeSingle()
    if (readError) throw readError

    const profileEmail = existing?.email || token.email || ''
    const profileName = existing?.name || token.name || 'প্রিয় ব্যবহারকারী'
    const isNewProfile = !existing
    let welcomeStatus = existing?.welcome_email_status ?? (profileEmail ? 'PENDING' : 'SKIPPED')

    if (isNewProfile) {
      const { error: insertError } = await supabase.from('profiles').insert({
        id: token.uid,
        name: token.name ?? '',
        phone: token.phone_number ?? null,
        email: token.email ?? null,
        photo_url: token.picture ?? null,
        welcome_email_status: welcomeStatus,
      })
      if (insertError) throw insertError
    } else {
      const profilePatch: Record<string, string> = {}
      if (!existing.email && token.email) profilePatch.email = token.email
      if (!existing.name && token.name) profilePatch.name = token.name
      if (!existing.phone && token.phone_number) profilePatch.phone = token.phone_number
      if (!existing.photo_url && token.picture) profilePatch.photo_url = token.picture
      if (!existing.welcome_email_status && profileEmail) profilePatch.welcome_email_status = 'PENDING'
      if (Object.keys(profilePatch).length > 0) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update(profilePatch)
          .eq('id', token.uid)
        if (updateError) throw updateError
        if (profilePatch.welcome_email_status) welcomeStatus = profilePatch.welcome_email_status
      }
    }

    const shouldSendWelcome = Boolean(
      profileEmail &&
      !existing?.welcome_email_sent_at &&
      (isNewProfile || welcomeStatus === 'PENDING')
    )

    if (shouldSendWelcome) {
      try {
        const delivery = await sendWelcomeEmail({ userId: token.uid, to: profileEmail, name: profileName })
        if (delivery.skipped) {
          welcomeStatus = delivery.reason === 'NO_EMAIL' ? 'SKIPPED' : 'PENDING'
        } else {
          welcomeStatus = 'SENT'
          const { error: markerError } = await supabase
            .from('profiles')
            .update({ welcome_email_status: 'SENT', welcome_email_sent_at: new Date().toISOString() })
            .eq('id', token.uid)
            .is('welcome_email_sent_at', null)
          if (markerError) console.error('Welcome email marker update failed:', markerError)
        }
      } catch (error) {
        // Email delivery must not break authentication or profile bootstrap.
        welcomeStatus = 'PENDING'
        console.error('Welcome email delivery failed:', error)
      }
    }

    res.status(200).json({ ok: true, userId: token.uid, created: isNewProfile, welcomeEmail: welcomeStatus })
  } catch (error) {
    if (isAuthError(error)) {
      res.status(401).json({ error: 'Authentication is required' })
      return
    }
    console.error('Profile bootstrap failed', error)
    writeError(res, error)
  }
}
