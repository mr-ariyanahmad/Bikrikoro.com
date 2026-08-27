import type { ChatMessage } from '@/types/chat'
import { readCachedValue, userCacheKey, writeCachedValue } from '@/lib/clientCache'

const MAX_AGE_MS = 24 * 60 * 60 * 1000
const MAX_MESSAGES = 120

export function loadCachedChatMessages(userId: string, threadId: string) {
  return readCachedValue<ChatMessage[]>(userCacheKey(userId, 'chat-thread', threadId), MAX_AGE_MS)?.value.slice(-MAX_MESSAGES) ?? []
}

export function saveCachedChatMessages(userId: string, threadId: string, messages: ChatMessage[]) {
  writeCachedValue(userCacheKey(userId, 'chat-thread', threadId), messages.slice(-MAX_MESSAGES))
}
