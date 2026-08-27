import { useEffect, useState, useRef, useCallback } from 'react'
import { ArrowLeft, BadgeCheck, Check, CheckCheck, Package, Send, Store } from 'lucide-react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { chatRequest } from '@/lib/chat'
import { loadCachedChatMessages, saveCachedChatMessages } from '@/lib/chatCache'
import { PUBLIC_PRODUCT_TABLE } from '@/lib/publicProductFields'
import { useAuth } from '@/context/AuthContext'
import { Layout } from '@/components/Layout'
import { formatDateTime } from '@/lib/format'
import { displayShopName, displayUserName, shopUrl } from '@/lib/shopProfile'
import type { ChatThread, ChatMessage } from '@/types/chat'

type ProductContext = { id: string; title: string; images: string[] | null; price: number }
type ParticipantProfile = { name: string | null; shop_name: string | null; shop_username: string | null; photo_url: string | null; is_verified: boolean }

export default function ChatThreadPage() {
  const { threadId } = useParams<{ threadId: string }>()
  const { user } = useAuth()
  const uid = user?.uid ?? ''
  const [thread, setThread] = useState<ChatThread | null>(null)
  const [otherName, setOtherName] = useState('')
  const [otherProfile, setOtherProfile] = useState<ParticipantProfile | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [pendingMessageIds, setPendingMessageIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [productContext, setProductContext] = useState<ProductContext | null>(null)
  const messagesRef = useRef<HTMLDivElement>(null)

  const storeMessages = useCallback((nextMessages: ChatMessage[]) => {
    setMessages(nextMessages)
    if (threadId) saveCachedChatMessages(threadId, nextMessages)
  }, [threadId])

  const loadMessages = useCallback(async () => {
    if (!threadId || !uid) return []
    const result = await chatRequest<{ messages?: ChatMessage[] }>({ action: 'messages', threadId })
    const nextMessages = result.messages ?? []
    storeMessages(nextMessages)
    return nextMessages
  }, [storeMessages, threadId, uid])

  useEffect(() => {
    if (!threadId || !uid) {
      setLoading(false)
      return
    }
    let active = true
    const cached = loadCachedChatMessages(threadId)
    if (cached.length > 0) {
      setMessages(cached)
      setLoading(false)
    } else {
      setMessages([])
      setLoading(true)
    }
    setError(null)

    async function init() {
      try {
        const threadPromise = chatRequest<{ thread?: ChatThread }>({ action: 'thread', threadId })
        const messagePromise = chatRequest<{ messages?: ChatMessage[] }>({ action: 'messages', threadId })
        void messagePromise.then((messageResult) => {
          if (!active) return
          storeMessages(messageResult.messages ?? [])
          setLoading(false)
        }).catch((messageError) => console.warn('Initial chat messages load failed:', messageError))
        const threadResult = await threadPromise
        const threadData = threadResult.thread ?? null
        if (!threadData) throw new Error('এই chat thread পাওয়া যায়নি।')
        if (!active) return
        setThread(threadData)

        const otherId = threadData.buyer_id === uid ? threadData.seller_id : threadData.buyer_id
        const isSellerConversation = threadData.buyer_id === uid
        void supabase.from('profiles').select('name, shop_name, shop_username, photo_url, is_verified').eq('id', otherId).maybeSingle().then(({ data, error: profileError }) => {
          if (profileError) console.warn('Chat participant profile load failed:', profileError)
          if (!active) return
          const profile = data as ParticipantProfile | null
          setOtherProfile(profile)
          setOtherName(isSellerConversation ? displayShopName(profile?.shop_name, profile?.name) : displayUserName(profile?.name))
        })

        if (threadData.product_id) {
          void supabase.from(PUBLIC_PRODUCT_TABLE).select('id, title, images, price').eq('id', threadData.product_id).maybeSingle().then(({ data, error: productError }) => {
            if (productError) console.warn('Chat product context load failed:', productError)
            if (active) setProductContext(data as ProductContext | null)
          })
        } else if (active) setProductContext(null)

        void chatRequest({ action: 'mark_read', threadId }).then(() => {
          if (!active) return
          setThread((current) => {
            if (!current) return current
            const now = new Date().toISOString()
            return current.buyer_id === uid ? { ...current, buyer_unread_count: 0, buyer_last_read_at: now } : { ...current, seller_unread_count: 0, seller_last_read_at: now }
          })
        }).catch((readError) => console.warn('Chat unread count update failed:', readError))
      } catch (initError) {
        if (!active) return
        setError(initError instanceof Error ? initError.message : 'Chat লোড করা যায়নি। আবার চেষ্টা করুন।')
        setLoading(false)
      }
    }
    void init()
    const poller = window.setInterval(() => {
      void Promise.all([
        loadMessages(),
        chatRequest<{ thread?: ChatThread }>({ action: 'thread', threadId }),
      ]).then(([, threadResult]) => {
        if (active && threadResult.thread) setThread(threadResult.thread)
      }).catch((pollError) => console.warn('Chat polling failed:', pollError))
    }, 8000)
    return () => { active = false; window.clearInterval(poller) }
  }, [loadMessages, storeMessages, threadId, uid])

  useEffect(() => {
    const messagePanel = messagesRef.current
    if (messagePanel) messagePanel.scrollTo({ top: messagePanel.scrollHeight, behavior: messages.length > 0 ? 'smooth' : 'auto' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || !thread || !uid || sending) return
    const text = input.trim()
    const optimisticId = `pending-${Date.now()}`
    const optimisticMessage: ChatMessage = { id: optimisticId, thread_id: thread.id, sender_id: uid, text, created_at: new Date().toISOString() }
    setSending(true)
    setInput('')
    setError(null)
    setPendingMessageIds((current) => new Set(current).add(optimisticId))
    storeMessages([...messages, optimisticMessage])
    try {
      const result = await chatRequest<{ messageId?: string }>({ action: 'send', threadId: thread.id, text })
      const messageId = result.messageId ?? optimisticId
      setPendingMessageIds((current) => { const next = new Set(current); next.delete(optimisticId); return next })
      setMessages((current) => {
        const nextMessages = current.map((message) => message.id === optimisticId ? { ...message, id: messageId } : message)
        saveCachedChatMessages(thread.id, nextMessages)
        return nextMessages
      })
      void loadMessages().catch(() => undefined)
    } catch (sendError) {
      setInput(text)
      setPendingMessageIds((current) => { const next = new Set(current); next.delete(optimisticId); return next })
      setMessages((current) => {
        const nextMessages = current.filter((message) => message.id !== optimisticId)
        saveCachedChatMessages(thread.id, nextMessages)
        return nextMessages
      })
      setError(sendError instanceof Error ? sendError.message : 'মেসেজ পাঠানো যায়নি।')
    } finally {
      setSending(false)
    }
  }

  const sellerProfileUrl = thread && thread.buyer_id === uid && otherProfile ? shopUrl(otherProfile.shop_username, thread.seller_id) : null
  const recipientReadAt = thread ? (thread.buyer_id === uid ? thread.seller_last_read_at : thread.buyer_last_read_at) : null

  return (
    <Layout wide hideFooter fullScreen backFallback="/chat" backLabel="চ্যাট তালিকায় ফিরুন">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-3 border-b border-outline bg-surface pb-3">
          <Link to="/chat" aria-label="চ্যাট তালিকায় ফিরুন" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-700 transition hover:bg-brand-50 hover:text-brand-700"><ArrowLeft size={21} /></Link>
          {sellerProfileUrl ? <Link to={sellerProfileUrl} className="flex min-w-0 flex-1 items-center gap-3" aria-label={`${otherName || 'শপ'} খুলুন`}>{participantHeader()}</Link> : <div className="flex min-w-0 flex-1 items-center gap-3">{participantHeader()}</div>}
          <Link to="/settings" className="shrink-0 text-xs font-semibold text-brand-600">সহায়তা</Link>
        </div>
        {error && <p className="mt-3 shrink-0 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {loading ? <div className="mt-3 flex min-h-0 flex-1 flex-col gap-4 overflow-hidden rounded-2xl border border-outline bg-bg p-4" aria-label="আগের মেসেজ লোড হচ্ছে"><div className="h-4 w-28 animate-pulse self-center rounded-full bg-outline" /><div className="h-14 w-3/5 animate-pulse rounded-2xl rounded-bl-md bg-outline/70" /><div className="h-10 w-2/5 animate-pulse self-end rounded-2xl rounded-br-md bg-brand-100" /><div className="h-16 w-4/5 animate-pulse rounded-2xl rounded-bl-md bg-outline/70" /></div> : <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-outline bg-surface">
          <div ref={messagesRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-bg p-3 sm:p-4">
            {productContext && <Link to={`/products/${productContext.id}`} className="mx-auto flex max-w-md items-center gap-3 rounded-xl border border-outline bg-surface p-2.5 shadow-sm transition hover:border-brand-300"><div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-brand-50">{productContext.images?.[0] && <img src={productContext.images[0]} alt="" className="h-full w-full object-cover" />}</div><div className="min-w-0 flex-1"><p className="line-clamp-2 text-xs font-semibold text-ink-900">{productContext.title}</p><p className="mt-1 text-sm font-bold text-brand-700">৳{Number(productContext.price).toLocaleString('bn-BD')}</p></div><Package size={18} className="shrink-0 text-brand-600" /></Link>}
            <p className="mx-auto w-fit rounded-full bg-surface px-3 py-1 text-[11px] text-ink-400">এই কথোপকথনটি BikriKoro-তে সুরক্ষিতভাবে পরিচালিত হচ্ছে</p>
            {messages.map((message) => {
              const isMine = message.sender_id === uid
              const pending = pendingMessageIds.has(message.id)
              const read = Boolean(isMine && !pending && recipientReadAt && new Date(message.created_at).getTime() <= new Date(recipientReadAt).getTime())
              return <div key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm ${isMine ? 'rounded-br-md bg-brand-500 text-white shadow-sm' : 'rounded-bl-md bg-surface text-ink-900 shadow-sm'}`}><p>{message.text}</p><p className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${isMine ? 'text-brand-50/80' : 'text-ink-300'}`}><span>{formatDateTime(message.created_at)}</span>{isMine && <><span>{pending ? 'পাঠানো হচ্ছে' : read ? 'পড়া হয়েছে' : 'পাঠানো'}</span>{read ? <CheckCheck size={13} aria-label="পড়া হয়েছে" /> : <Check size={13} aria-label={pending ? 'পাঠানো হচ্ছে' : 'পাঠানো হয়েছে'} />}</>}</p></div></div>
            })}
            <div />
          </div>
          <div className="flex items-center gap-2 border-t border-outline bg-surface p-3"><input type="text" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && handleSend()} placeholder="মেসেজ লিখুন..." className="flex-1 rounded-full border border-outline bg-bg px-4 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10" /><button type="button" onClick={handleSend} disabled={!input.trim() || sending} className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand-500 text-white transition hover:bg-brand-600 disabled:opacity-50" aria-label="মেসেজ পাঠান"><Send size={17} /></button></div>
        </div>}
      </div>
    </Layout>
  )

  function participantHeader() {
    return <><div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-lg font-bold text-brand-700">{otherProfile?.photo_url ? <img src={otherProfile.photo_url} alt="" className="h-full w-full object-cover" /> : (otherName.charAt(0) || '?')}</div><div className="min-w-0"><div className="flex items-center gap-1"><h1 className="truncate text-base font-bold text-ink-900">{otherName || 'চ্যাট'}</h1>{otherProfile?.is_verified && <BadgeCheck size={15} className="shrink-0 text-brand-600" />}</div><p className="mt-0.5 flex items-center gap-1 text-xs text-ink-500"><Store size={12} />{sellerProfileUrl ? 'শপ দেখতে চাপুন' : 'নিরাপদ BikriKoro চ্যাট'}</p></div></>
  }
}
