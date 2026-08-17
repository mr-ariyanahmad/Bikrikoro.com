import type { VercelRequest, VercelResponse } from '@vercel/node'

const allowedMethods = ['POST']

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!allowedMethods.includes(req.method ?? '')) {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const baseUrl = process.env.AGENT_ROUTER_BASE_URL?.replace(/\/$/, '')
  const apiKey = process.env.AGENT_ROUTER_API_KEY
  const chatPath = process.env.AGENT_ROUTER_CHAT_PATH || '/v1/chat/completions'
  if (!baseUrl || !apiKey) {
    res.status(503).json({ error: 'Agent Router is not configured on the server.' })
    return
  }

  const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {}
  const messages = Array.isArray(body.messages) ? body.messages : []
  if (messages.length === 0 || messages.length > 20) {
    res.status(400).json({ error: 'messages must contain between 1 and 20 items.' })
    return
  }

  const upstream = await fetch(`${baseUrl}${chatPath.startsWith('/') ? chatPath : `/${chatPath}`}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: typeof body.model === 'string' ? body.model : process.env.AGENT_ROUTER_MODEL,
      messages,
      temperature: typeof body.temperature === 'number' ? Math.min(Math.max(body.temperature, 0), 1) : 0.2,
      max_tokens: typeof body.max_tokens === 'number' ? Math.min(Math.max(body.max_tokens, 64), 1200) : 600,
    }),
  })

  const text = await upstream.text()
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.status(upstream.status).send(text)
}
