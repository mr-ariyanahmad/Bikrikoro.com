type FirebaseApp = import('firebase-admin/app').App

export type WebPushMessage = {
  title: string
  body: string
  link: string
  data?: Record<string, string>
}

export async function getFirebaseApp(): Promise<FirebaseApp> {
  const { cert, getApps, initializeApp } = await import('firebase-admin/app')
  const existing = getApps()[0]
  if (existing) return existing

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (json) {
    const parsed = JSON.parse(json) as { project_id?: string; client_email?: string; private_key?: string }
    return initializeApp({
      credential: cert({
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        privateKey: parsed.private_key?.replace(/\\n/g, '\n'),
      }),
    })
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, '\n')
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase service-account configuration is missing')
  }
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
}

export function getPublicPushAssets() {
  const siteUrl = (process.env.SITE_URL || 'https://bikrikoro.com').replace(/\/$/, '')
  return {
    icon: `${siteUrl}/icon-192.png`,
    badge: `${siteUrl}/notification-badge.png`,
    siteUrl,
  }
}

function absolutePushLink(link: string, siteUrl: string) {
  if (/^https?:\/\//i.test(link)) return link
  return `${siteUrl}/${link.replace(/^\/+/, '')}`
}

export function isInvalidTokenCode(code?: string) {
  return code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token'
}

export async function sendWebPushBatch(app: FirebaseApp, tokens: string[], message: WebPushMessage) {
  const { getMessaging } = await import('firebase-admin/messaging')
  const assets = getPublicPushAssets()
  const absoluteLink = absolutePushLink(message.link, assets.siteUrl)
  return getMessaging(app).sendEachForMulticast({
    tokens,
    notification: {
      title: message.title,
      body: message.body,
    },
    data: {
      title: message.title,
      body: message.body,
      link: message.link,
      ...message.data,
    },
    webpush: {
      notification: {
        icon: assets.icon,
        badge: assets.badge,
      },
      fcmOptions: { link: absoluteLink },
    },
  })
}
