import type { ChatMessage } from '@/types/chat'

const CACHE_PREFIX = 'bikrikoro:chat-session:v1:'
const MAX_AGE_MS = 30 * 60 * 1000
const MAX_MESSAGES = 120

type CachedThreadMessages = { savedAt: number; messages: ChatMessage[] }

export function loadCachedChatMessages(threadId: string) {
  try {
    const raw = sessionStorage.getItem(`${CACHE_PREFIX}${threadId}`)
    if (!raw) return []
    const cached = JSON.parse(raw) as CachedThreadMessages
    if (!cached || Date.now() - cached.savedAt > MAX_AGE_MS || !Array.isArray(cached.messages)) {
      sessionStorage.removeItem(`${CACHE_PREFIX}${threadId}`)
      return []
    }
    return cached.messages.slice(-MAX_MESSAGES)
  } catch {
    return []
  }
}

export function saveCachedChatMessages(threadId: string, messages: ChatMessage[]) {
  try {
    sessionStorage.setItem(`${CACHE_PREFIX}${threadId}`, JSON.stringify({ savedAt: Date.now(), messages: messages.slice(-MAX_MESSAGES) }))
  } catch {
    // Chat history remains available from the protected server path if storage is unavailable.
  }
}
