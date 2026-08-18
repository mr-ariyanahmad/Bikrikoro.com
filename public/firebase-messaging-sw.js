/* BikriKoro web push service worker. The server sends a notification payload, so this worker can stay small and framework-independent. */
self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload = {}
  try {
    payload = event.data.json()
  } catch {
    payload = { data: { body: event.data.text() } }
  }

  const notification = payload.notification || payload.data || {}
  const title = notification.title || 'BikriKoro'
  const body = notification.body || 'আপনার জন্য নতুন আপডেট আছে।'
  const link = notification.click_action || notification.link || payload.data?.link || payload.fcmOptions?.link || '/notifications'
  const options = {
    body,
    icon: notification.icon || '/icon-192.png',
    badge: notification.badge || '/notification-badge.png',
    data: { link },
    tag: payload.data?.notificationId || payload.data?.campaignId || 'bikrikoro-notification',
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = event.notification.data?.link || '/notifications'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(link)
          return client.focus()
        }
      }
      return self.clients.openWindow(link)
    }),
  )
})
