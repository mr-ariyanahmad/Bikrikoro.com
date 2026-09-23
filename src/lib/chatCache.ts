import type { ChatMessage } from '@/types/chat'

const MAX_AGE_MS = 24 * 60 * 60 * 1000
const MAX_MESSAGES = 120
const CACHE_PREFIX = 'bikrikoro:chat-cache:v2:'

function key(userId: string, threadId: string) {
  return `${CACHE_PREFIX}${encodeURIComponent(userId)}:${encodeURIComponent(threadId)}`
}

type Entry = { cachedAt: number; messages: ChatMessage[] }

export function loadCachedChatMessages(userId: string, threadId: string) {
  try {
    const raw = window.localStorage.getItem(key(userId, threadId))
    if (!raw) return []
    const entry = JSON.parse(raw) as Partial<Entry>
    if (!entry.cachedAt || Date.now() - entry.cachedAt > MAX_AGE_MS || !Array.isArray(entry.messages)) return []
    return entry.messages.filter((message): message is ChatMessage => Boolean(message && typeof message.id === 'string' && typeof message.text === 'string')).slice(-MAX_MESSAGES)
  } catch {
    return []
  }
}

export function saveCachedChatMessages(userId: string, threadId: string, messages: ChatMessage[]) {
  try {
    window.localStorage.setItem(key(userId, threadId), JSON.stringify({ cachedAt: Date.now(), messages: messages.slice(-MAX_MESSAGES) } satisfies Entry))
  } catch {
    // Chat must continue working if storage is unavailable or full.
  }
}
