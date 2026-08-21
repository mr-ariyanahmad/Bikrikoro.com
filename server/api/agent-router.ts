import type { VercelRequest, VercelResponse } from '@vercel/node'

const allowedMethods = ['POST']
const RATE_LIMIT = 10
const RATE_WINDOW_MS = 60_000
const MAX_BODY_BYTES = 20_000
const MAX_MESSAGES = 20
const MAX_MESSAGE_CHARS = 4_000
const MAX_TOKENS = 600
const REQUEST_TIMEOUT_MS = 15_000
const MAX_RATE_BUCKETS = 10_000

type RateBucket = { windowStart: number; count: number }
const rateBuckets = new Map<string, RateBucket>()

function header(req: VercelRequest, name: string) {
  const value = req.headers[name]
  return Array.isArray(value) ? value[0] : value
}

function clientKey(req: VercelRequest) {
  const forwarded = header(req, 'x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || header(req, 'x-real-ip')?.trim() || req.socket?.remoteAddress || 'unknown-client'
}

function isTrustedOrigin(req: VercelRequest) {
  const origin = header(req, 'origin')?.trim()
  if (!origin) return true
  if (origin === 'null') return false

  try {
    const originUrl = new URL(origin)
    const requestHost = (header(req, 'x-forwarded-host') || header(req, 'host'))?.split(',')[0]?.trim().toLowerCase()
    const configuredSite = (process.env.SITE_URL || process.env.VITE_SITE_URL || '').replace(/\/+$/, '')
    const configuredOrigin = configuredSite ? new URL(configuredSite).origin : ''
    return originUrl.origin === configuredOrigin || (requestHost ? originUrl.host.toLowerCase() === requestHost : false)
  } catch {
    return false
  }
}

function takeRateLimit(key: string) {
  const now = Date.now()
  const existing = rateBuckets.get(key)
  if (!existing || now - existing.windowStart >= RATE_WINDOW_MS) {
    rateBuckets.set(key, { windowStart: now, count: 1 })
    return { allowed: true, remaining: RATE_LIMIT - 1, retryAfter: Math.ceil(RATE_WINDOW_MS / 1000) }
  }

  if (existing.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0, retryAfter: Math.max(1, Math.ceil((RATE_WINDOW_MS - (now - existing.windowStart)) / 1000)) }
  }

  existing.count += 1
  return { allowed: true, remaining: RATE_LIMIT - existing.count, retryAfter: Math.max(1, Math.ceil((RATE_WINDOW_MS - (now - existing.windowStart)) / 1000)) }
}

function pruneRateBuckets() {
  if (rateBuckets.size <= MAX_RATE_BUCKETS) return
  const now = Date.now()
  for (const [key, bucket] of rateBuckets) {
    if (now - bucket.windowStart >= RATE_WINDOW_MS) rateBuckets.delete(key)
    if (rateBuckets.size <= MAX_RATE_BUCKETS) break
  }
}

function jsonBody(req: VercelRequest) {
  if (req.body && typeof req.body === 'object') return req.body as Record<string, unknown>
  return {}
}

function validateMessages(value: unknown) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_MESSAGES) return null
  const messages = value.filter((message): message is { role: string; content: string } => {
    if (!message || typeof message !== 'object') return false
    const candidate = message as Record<string, unknown>
    return ['system', 'user', 'assistant'].includes(String(candidate.role))
      && typeof candidate.content === 'string'
      && candidate.content.trim().length > 0
      && candidate.content.length <= MAX_MESSAGE_CHARS
  })
  return messages.length === value.length ? messages : null
}

function noStore(res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  noStore(res)
  res.setHeader('X-RateLimit-Limit', String(RATE_LIMIT))

  if (!allowedMethods.includes(req.method ?? '')) {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (!isTrustedOrigin(req)) {
    res.status(403).json({ error: 'এই AI সহায়তা request-এর উৎস অনুমোদিত নয়।' })
    return
  }

  const rate = takeRateLimit(clientKey(req))
  pruneRateBuckets()
  res.setHeader('X-RateLimit-Remaining', String(rate.remaining))
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfter))
    res.status(429).json({ error: 'AI সহায়তার request limit সাময়িকভাবে পূর্ণ হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।' })
    return
  }

  const contentLength = Number(header(req, 'content-length') || 0)
  if (contentLength > MAX_BODY_BYTES) {
    res.status(413).json({ error: 'AI request খুব বড় হয়েছে। প্রশ্নটি সংক্ষিপ্ত করে আবার চেষ্টা করুন।' })
    return
  }

  const rawBaseUrl = process.env.AGENT_ROUTER_BASE_URL?.replace(/\/+$/, '')
  const apiKey = process.env.AGENT_ROUTER_API_KEY
  const configuredChatPath = process.env.AGENT_ROUTER_CHAT_PATH || '/v1/chat/completions'
  const chatPath = configuredChatPath.startsWith('http') ? new URL(configuredChatPath).pathname : configuredChatPath
  const model = process.env.AGENT_ROUTER_MODEL
  if (!rawBaseUrl || !apiKey || !model) {
    res.status(503).json({ error: 'Agent Router-এর Base URL, API key বা model server-এ সেট করা নেই।' })
    return
  }

  const body = jsonBody(req)
  const messages = validateMessages(body.messages)
  const serializedBody = JSON.stringify(body)
  if (!messages || Buffer.byteLength(serializedBody, 'utf8') > MAX_BODY_BYTES) {
    res.status(400).json({ error: `messages ১ থেকে ${MAX_MESSAGES}টি valid item এবং প্রতিটি প্রশ্ন সর্বোচ্চ ${MAX_MESSAGE_CHARS} অক্ষরের হতে হবে।` })
    return
  }

  const baseWithoutFullPath = rawBaseUrl.replace(/\/v1\/chat\/completions$/, '').replace(/\/chat\/completions$/, '')
  const normalizedBaseUrl = baseWithoutFullPath.endsWith('/v1') && (chatPath === '/v1' || chatPath.startsWith('/v1/'))
    ? baseWithoutFullPath.slice(0, -3)
    : baseWithoutFullPath
  const normalizedChatPath = chatPath.startsWith('/') ? chatPath : `/${chatPath}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let upstream: Response
  try {
    upstream = await fetch(`${normalizedBaseUrl}${normalizedChatPath}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, temperature: 0.2, max_tokens: MAX_TOKENS }),
      signal: controller.signal,
    })
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError'
    res.status(timedOut ? 504 : 502).json({ error: timedOut ? 'AI সহায়তার response পেতে বেশি সময় লাগছে। আবার চেষ্টা করুন।' : 'Agent Router server-এ পৌঁছানো যায়নি।' })
    return
  } finally {
    clearTimeout(timeout)
  }

  const text = await upstream.text()
  if (!upstream.ok) {
    res.status(502).json({ error: 'AI সহায়তা server এখন request গ্রহণ করেনি। কিছুক্ষণ পরে আবার চেষ্টা করুন।' })
    return
  }

  try {
    const payload = JSON.parse(text) as unknown
    res.status(200).json(payload)
  } catch {
    res.status(502).json({ error: 'AI সহায়তা server থেকে সঠিক response পাওয়া যায়নি।' })
  }
}
