import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase, getVerifiedFirebaseToken, isAuthError } from './_server-auth.js'

const BUCKET = 'seller-verification-docs'
const EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'pdf'])

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); res.status(405).json({ error: 'Method not allowed' }); return }
  try {
    const token = await getVerifiedFirebaseToken(req)
    const body = typeof req.body === 'string' ? JSON.parse(req.body) as { fileName?: string } : (req.body ?? {}) as { fileName?: string }
    const fileName = body.fileName?.trim() || ''
    const extension = fileName.split('.').pop()?.toLowerCase() || ''
    if (!EXTENSIONS.has(extension)) { res.status(400).json({ error: 'শুধু JPG, PNG, WEBP বা PDF ফাইল আপলোড করা যাবে।' }); return }
    const path = `${token.uid}/${crypto.randomUUID()}.${extension}`
    const { data, error } = await getServiceSupabase().storage.from(BUCKET).createSignedUploadUrl(path)
    if (error) throw error
    res.status(200).json({ path, token: data.token })
  } catch (error) {
    if (isAuthError(error)) { res.status(401).json({ error: 'Firebase authentication is required' }); return }
    console.error('Verification upload URL failed:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Secure upload URL তৈরি করা যায়নি।' })
  }
}
