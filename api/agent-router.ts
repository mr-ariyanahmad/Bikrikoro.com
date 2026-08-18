import type { VercelRequest, VercelResponse } from '@vercel/node'

const allowedMethods = ['POST']

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!allowedMethods.includes(req.method ?? '')) {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const rawBaseUrl = process.env.AGENT_ROUTER_BASE_URL?.replace(/\/+$/, '')
  const apiKey = process.env.AGENT_ROUTER_API_KEY
  const chatPath = process.env.AGENT_ROUTER_CHAT_PATH || '/v1/chat/completions'
  const model = process.env.AGENT_ROUTER_MODEL
  if (!rawBaseUrl || !apiKey || !model) {
    res.status(503).json({ error: 'Agent Router-এর Base URL, API key বা model server-এ সেট করা নেই।' })
    return
  }
  const normalizedBaseUrl = rawBaseUrl.endsWith('/v1') && (chatPath === '/v1' || chatPath.startsWith('/v1/'))
    ? rawBaseUrl.slice(0, -3)
    : rawBaseUrl
  const normalizedChatPath = chatPath.startsWith('/') ? chatPath : `/${chatPath}`

  const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {}
  const messages = Array.isArray(body.messages) ? body.messages : []
  if (messages.length === 0 || messages.length > 20) {
    res.status(400).json({ error: 'messages must contain between 1 and 20 items.' })
    return
  }

  let upstream: Response
  try {
    upstream = await fetch(`${normalizedBaseUrl}${normalizedChatPath}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: typeof body.model === 'string' && body.model.trim() ? body.model : model,
        messages,
        temperature: typeof body.temperature === 'number' ? Math.min(Math.max(body.temperature, 0), 1) : 0.2,
        max_tokens: typeof body.max_tokens === 'number' ? Math.min(Math.max(body.max_tokens, 64), 1200) : 600,
      }),
    })
  } catch {
    res.status(502).json({ error: 'Agent Router server-এ পৌঁছানো যায়নি। Base URL এবং network settings যাচাই করুন।' })
    return
  }

  const text = await upstream.text()
  res.setHeader('Cache-Control', 'no-store')
  try {
    const payload = JSON.parse(text) as unknown
    res.status(upstream.status).json(payload)
  } catch {
    res.status(upstream.ok ? 502 : upstream.status).json({ error: `Agent Router upstream থেকে JSON response আসেনি (HTTP ${upstream.status})। Base URL, path এবং model যাচাই করুন।` })
  }
}
