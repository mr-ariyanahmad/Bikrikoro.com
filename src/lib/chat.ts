import { auth } from '@/lib/firebase'

export type ChatApiPayload = {
  action: 'create' | 'list' | 'thread' | 'messages' | 'mark_read' | 'send'
  sellerId?: string
  productId?: string | null
  threadId?: string
  text?: string
}

type ChatApiResponse = {
  threadId?: string
  threads?: unknown[]
  thread?: unknown
  messages?: unknown[]
  messageId?: string
  ok?: boolean
  error?: string
}

export async function chatRequest<T extends ChatApiResponse = ChatApiResponse>(payload: ChatApiPayload): Promise<T> {
  const currentUser = auth.currentUser
  if (!currentUser) throw new Error('Chat ব্যবহার করতে আগে login করুন।')

  const idToken = await currentUser.getIdToken()
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(payload),
  })
  const result = await response.json().catch(() => ({})) as ChatApiResponse
  if (!response.ok) throw new Error(result.error || `Chat অনুরোধ ব্যর্থ হয়েছে (HTTP ${response.status})`)
  return result as T
}

/**
 * Creates or reuses one secure chat thread per buyer/seller pair.
 * The browser supplies only the seller/product context. The gateway derives
 * the buyer UID from the verified Firebase ID token.
 */
export async function findOrCreateThread(sellerId: string, productId: string | null): Promise<string> {
  const currentUser = auth.currentUser
  if (!currentUser) throw new Error('Chat ব্যবহার করতে আগে login করুন।')
  if (!sellerId || sellerId === currentUser.uid) throw new Error('নিজের listing-এ chat করা যাবে না।')

  const result = await chatRequest<{ threadId?: string; error?: string }>({
    action: 'create',
    sellerId,
    productId,
  })
  if (!result.threadId) throw new Error('Chat thread তৈরি করা যায়নি।')
  return result.threadId
}
