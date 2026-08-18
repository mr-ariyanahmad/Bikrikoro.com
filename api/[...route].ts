import type { VercelRequest, VercelResponse } from '@vercel/node'
import adminRpc from '../server/api/admin-rpc.js'
import adminSellerVerifications from '../server/api/admin-seller-verifications.js'
import agentRouter from '../server/api/agent-router.js'
import notificationEvents from '../server/api/notification-events.js'
import notificationPush from '../server/api/notification-push.js'
import notifications from '../server/api/notifications.js'
import orderAction from '../server/api/order-action.js'
import orderRead from '../server/api/order-read.js'
import pendingOrder from '../server/api/pending-order.js'
import productPreview from '../server/api/product-preview.js'
import profileBootstrap from '../server/api/profile-bootstrap.js'
import sellerVerificationStatus from '../server/api/seller-verification-status.js'
import sitemap from '../server/api/sitemap.xml.js'
import verificationDocument from '../server/api/verification-document.js'
import walletWithdrawal from '../server/api/wallet-withdrawal.js'

type ApiHandler = (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>

const HANDLERS: Record<string, ApiHandler> = {
  'admin-rpc': adminRpc,
  'admin-seller-verifications': adminSellerVerifications,
  'agent-router': agentRouter,
  'notification-events': notificationEvents,
  'notification-push': notificationPush,
  notifications,
  'order-action': orderAction,
  'order-read': orderRead,
  'pending-order': pendingOrder,
  'product-preview': productPreview,
  'profile-bootstrap': profileBootstrap,
  'seller-verification-status': sellerVerificationStatus,
  'sitemap.xml': sitemap,
  'verification-document': verificationDocument,
  'wallet-withdrawal': walletWithdrawal,
}

function asPath(value: unknown) {
  const raw = Array.isArray(value) ? value.join('/') : typeof value === 'string' ? value : ''
  if (!raw) return ''
  try {
    return decodeURIComponent(raw).split('?')[0].replace(/^\/+|\/+$/g, '').replace(/^api\//, '')
  } catch {
    return raw.split('?')[0].replace(/^\/+|\/+$/g, '').replace(/^api\//, '')
  }
}

function routeCandidates(req: VercelRequest) {
  const query = req.query ?? {}
  const candidates: unknown[] = [query.route, query['...route'], query['[...route]'], query.path, query.slug]
  for (const [key, value] of Object.entries(query)) {
    if (key.toLowerCase().includes('route')) candidates.push(value)
  }
  candidates.push(req.url)
  const forwarded = req.headers['x-vercel-original-url'] ?? req.headers['x-forwarded-uri']
  candidates.push(forwarded)
  return candidates.map(asPath).filter(Boolean)
}

function routeName(req: VercelRequest) {
  const candidates = routeCandidates(req)
  return candidates.find((candidate) => Boolean(HANDLERS[candidate])) ?? candidates[0] ?? ''
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const name = routeName(req)
  const target = HANDLERS[name]
  if (!target) {
    res.status(404).json({ error: 'API route not found', route: name || null })
    return
  }
  return target(req, res)
}
