import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); res.status(405).json({ ok: false, error: 'Method not allowed' }); return }
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({ ok: true, service: 'bikrikoro-web', commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null })
}
