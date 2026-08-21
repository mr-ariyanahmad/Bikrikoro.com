import type { VercelRequest, VercelResponse } from '@vercel/node'
import adminRpc from '../server/api/admin-rpc.js'
import adminHealth from '../server/api/admin-health.js'
import adminSellerVerifications from '../server/api/admin-seller-verifications.js'
import agentRouter from '../server/api/agent-router.js'
import chat from '../server/api/chat.js'
import notificationEvents from '../server/api/notification-events.js'
import notificationPush from '../server/api/notification-push.js'
import notifications from '../server/api/notifications.js'
import orderAction from '../server/api/order-action.js'
import orderRead from '../server/api/order-read.js'
import pendingOrder from '../server/api/pending-order.js'
import productPreview from '../server/api/product-preview.js'
import productQuestion from '../server/api/product-question.js'
import sellerPreview from '../server/api/seller-preview.js'
import sellerOgImage from '../server/api/seller-og-image.js'
import profileBootstrap from '../server/api/profile-bootstrap.js'
import sellerVerificationStatus from '../server/api/seller-verification-status.js'
import sellerProfile from '../server/api/seller-profile.js'
import sellerDigitalContent from '../server/api/seller-digital-content.js'
import sellerProduct from '../server/api/seller-product.js'
import sellerListingOptions from '../server/api/seller-listing-options.js'
import sitemap from '../server/api/sitemap.xml.js'
import verificationDocument from '../server/api/verification-document.js'
import walletWithdrawal from '../server/api/wallet-withdrawal.js'
import walletBalance from '../server/api/wallet-balance.js'
import userFeatures from '../server/api/user-features.js'

type ApiHandler = (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>

const HANDLERS: Record<string, ApiHandler> = {
  'admin-rpc': adminRpc,
  'admin-health': adminHealth,
  'admin-seller-verifications': adminSellerVerifications,
  'agent-router': agentRouter,
  chat,
  'notification-events': notificationEvents,
  'notification-push': notificationPush,
  notifications,
  'order-action': orderAction,
  'order-read': orderRead,
  'pending-order': pendingOrder,
  'product-preview': productPreview,
  'product-question': productQuestion,
  'seller-preview': sellerPreview,
  'seller-og-image': sellerOgImage,
  'profile-bootstrap': profileBootstrap,
  'seller-verification-status': sellerVerificationStatus,
  'seller-profile': sellerProfile,
  'seller-digital-content': sellerDigitalContent,
  'seller-product': sellerProduct,
  'seller-listing-options': sellerListingOptions,
  'sitemap.xml': sitemap,
  'verification-document': verificationDocument,
  'wallet-withdrawal': walletWithdrawal,
  'wallet-balance': walletBalance,
  'user-features': userFeatures,
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
