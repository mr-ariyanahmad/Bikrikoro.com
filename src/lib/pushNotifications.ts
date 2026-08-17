import { getMessaging, getToken, isSupported } from 'firebase/messaging'
import { app, auth } from '@/lib/firebase'

export type PushRegistrationResult =
  | { status: 'registered'; token: string }
  | { status: 'unsupported' | 'denied' | 'missing-config' | 'unavailable' }

export async function registerPushToken(userId: string): Promise<PushRegistrationResult> {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return { status: 'unsupported' }
  }

  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY
  if (!vapidKey) {
    console.info('VITE_FIREBASE_VAPID_KEY is not configured; browser push is disabled.')
    return { status: 'missing-config' }
  }

  try {
    if (!(await isSupported())) return { status: 'unsupported' }
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
    if (permission !== 'granted') return { status: 'denied' }

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
    const messaging = getMessaging(app)
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration })
    if (!token) return { status: 'unavailable' }

    if (auth.currentUser?.uid !== userId) return { status: 'unavailable' }
    const idToken = await auth.currentUser.getIdToken()
    const response = await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ action: 'register_token', token, platform: 'WEB', browser: navigator.userAgent.slice(0, 240) }),
    })
    if (!response.ok) throw new Error('Push token registration failed')
    return { status: 'registered', token }
  } catch (error) {
    console.warn('Browser push registration skipped:', error)
    return { status: 'unavailable' }
  }
}
