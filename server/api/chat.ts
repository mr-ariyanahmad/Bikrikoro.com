import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase, getVerifiedFirebaseToken, isAuthError } from './_server-auth.js'

type Action = 'create' | 'list' | 'thread' | 'messages' | 'mark_read' | 'send'

type Body = {
  action?: Action
  sellerId?: string
  productId?: string | null
  threadId?: string
  text?: string
}

type SupabaseErrorLike = { message?: unknown; details?: unknown; hint?: unknown }

function bodyOf(req: VercelRequest): Body {
  if (typeof req.body === 'string') return JSON.parse(req.body) as Body
  return (req.body ?? {}) as Body
}

function errorMessage(error: unknown) {
  if (error && typeof error === 'object') {
    const value = error as SupabaseErrorLike
    return [value.message, value.details, value.hint]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
      .join(' ')
  }
  return error instanceof Error ? error.message : ''
}

function requiredText(value: unknown, field: string) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${field} is required`)
  return value.trim()
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const token = await getVerifiedFirebaseToken(req)
    const input = bodyOf(req)
    const action = input.action
    if (!action) throw new Error('Chat action is required')

    const supabase = getServiceSupabase()

    if (action === 'create') {
      const sellerId = requiredText(input.sellerId, 'Seller ID')
      if (sellerId === token.uid) throw new Error('নিজের listing-এ chat করা যাবে না।')
      const productId = typeof input.productId === 'string' && input.productId.trim().length > 0 ? input.productId.trim() : null
      const { data, error } = await supabase.rpc('find_or_create_chat_thread', {
        p_buyer_id: token.uid,
        p_seller_id: sellerId,
        p_product_id: productId,
      })
      if (error) throw error
      res.status(200).json({ threadId: data })
      return
    }

    if (action === 'list') {
      const { data, error } = await supabase.rpc('list_my_chat_threads', { p_user_id: token.uid })
      if (error) throw error
      res.status(200).json({ threads: data ?? [] })
      return
    }

    if (action === 'thread') {
      const threadId = requiredText(input.threadId, 'Thread ID')
      const { data, error } = await supabase.rpc('get_my_chat_thread', { p_user_id: token.uid, p_thread_id: threadId })
      if (error) throw error
      res.status(200).json({ thread: data })
      return
    }

    if (action === 'messages') {
      const threadId = requiredText(input.threadId, 'Thread ID')
      const { data, error } = await supabase.rpc('list_my_chat_messages', { p_user_id: token.uid, p_thread_id: threadId })
      if (error) throw error
      res.status(200).json({ messages: data ?? [] })
      return
    }

    if (action === 'mark_read') {
      const threadId = requiredText(input.threadId, 'Thread ID')
      const { error } = await supabase.rpc('mark_my_chat_thread_read', { p_user_id: token.uid, p_thread_id: threadId })
      if (error) throw error
      res.status(200).json({ ok: true })
      return
    }

    if (action === 'send') {
      const threadId = requiredText(input.threadId, 'Thread ID')
      const text = requiredText(input.text, 'Message')
      if (text.length > 5000) throw new Error('Message must be 5000 characters or fewer')
      const { data, error } = await supabase.rpc('send_chat_message', {
        p_sender_id: token.uid,
        p_thread_id: threadId,
        p_text: text,
      })
      if (error) throw error
      res.status(200).json({ messageId: data })
      return
    }

    throw new Error('Unsupported chat action')
  } catch (error) {
    if (isAuthError(error)) {
      res.status(401).json({ error: 'Firebase authentication is required' })
      return
    }
    console.error('Chat request failed:', error)
    res.status(400).json({ error: errorMessage(error) || 'Chat অনুরোধ সম্পন্ন করা যায়নি।' })
  }
}
