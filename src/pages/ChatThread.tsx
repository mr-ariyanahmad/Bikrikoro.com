import { useEffect, useState, useRef, useCallback } from 'react'
import { ArrowLeft, Package, Send } from 'lucide-react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Layout } from '@/components/Layout'
import { formatDateTime } from '@/lib/format'
import type { ChatThread, ChatMessage } from '@/types/chat'

export default function ChatThreadPage() {
  const { threadId } = useParams<{ threadId: string }>()
  const { user } = useAuth()
  const uid = user!.uid

  const [thread, setThread] = useState<ChatThread | null>(null)
  const [otherName, setOtherName] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [productTitle, setProductTitle] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadMessages = useCallback(async () => {
    if (!threadId) return
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
    setMessages(data ?? [])
  }, [threadId])

  useEffect(() => {
    if (!threadId) return

    async function init() {
      const { data: threadData, error: threadError } = await supabase.from('chat_threads').select('*').eq('id', threadId).maybeSingle()
      if (threadError || !threadData) { setError('এই chat thread পাওয়া যায়নি।'); setLoading(false); return }
      if (threadData.buyer_id !== uid && threadData.seller_id !== uid) { setError('এই chat দেখার অনুমতি আপনার নেই।'); setLoading(false); return }
      setThread(threadData)
      setLoading(false)

      if (threadData.product_id) {
        const { data: productData } = await supabase.from('products').select('title').eq('id', threadData.product_id).maybeSingle()
        setProductTitle(productData?.title ?? '')
      }

      const otherId = threadData.buyer_id === uid ? threadData.seller_id : threadData.buyer_id
      const { data: profile } = await supabase.from('profiles').select('name').eq('id', otherId).maybeSingle()
      setOtherName(profile?.name || 'ব্যবহারকারী')

      // clear my side's unread count on open
      const unreadField = threadData.buyer_id === uid ? 'buyer_unread_count' : 'seller_unread_count'
      await supabase.from('chat_threads').update({ [unreadField]: 0 }).eq('id', threadId)

      await loadMessages()
    }
    init().catch((initError) => { console.error('chat thread load failed:', initError); setError('Chat লোড করা যায়নি। আবার চেষ্টা করুন।'); setLoading(false) })

    const channel = supabase
      .channel(`chat-${threadId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `thread_id=eq.${threadId}` },
        loadMessages
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [threadId, uid, loadMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || !thread || sending) return
    setSending(true)
    const text = input.trim()
    setInput('')

    const otherIsSeller = thread.buyer_id === uid
    const unreadField = otherIsSeller ? 'seller_unread_count' : 'buyer_unread_count'

    const { error: messageError } = await supabase.from('chat_messages').insert({ thread_id: thread.id, sender_id: uid, text })
    if (messageError) { setInput(text); setSending(false); setError('মেসেজ পাঠানো যায়নি। Supabase chat migration ও participant permission দেখুন।'); return }
    const { error: threadUpdateError } = await supabase
      .from('chat_threads')
      .update({
        last_message: text,
        last_message_at: new Date().toISOString(),
        [unreadField]: (otherIsSeller ? thread.seller_unread_count : thread.buyer_unread_count) + 1,
      })
      .eq('id', thread.id)
    if (threadUpdateError) setError('মেসেজ গেছে, কিন্তু unread count আপডেট হয়নি।')

    setSending(false)
  }

  return (
    <Layout wide>
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Link to="/chat" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-outline text-ink-600 hover:border-brand-500 hover:text-brand-700" aria-label="চ্যাট তালিকায় ফিরুন"><ArrowLeft size={17} /></Link><div><h1 className="text-lg font-semibold text-ink-900">{otherName || 'চ্যাট'}</h1>{productTitle && <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-400"><Package size={12} />{productTitle}</p>}</div></div><Link to="/settings" className="text-xs font-semibold text-brand-600">সাহায্য</Link></div>
      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading ? <div className="mt-4 h-[60vh] animate-pulse rounded-2xl bg-outline/40" /> : <div className="mt-4 flex h-[60vh] flex-col rounded-2xl border border-outline bg-surface">
        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {messages.map((msg) => {
            const isMine = msg.sender_id === uid
            return (
              <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                    isMine ? 'bg-brand-500 text-white' : 'bg-bg text-ink-900'
                  }`}
                >
                  <p>{msg.text}</p>
                  <p className={`mt-1 text-[10px] ${isMine ? 'text-brand-50/70' : 'text-ink-300'}`}>
                    {formatDateTime(msg.created_at)}
                  </p>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        <div className="flex items-center gap-2 border-t border-outline p-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="মেসেজ লিখুন..."
            className="flex-1 rounded-full border border-outline px-4 py-2 text-sm outline-none focus:border-brand-500"
          />
          <button onClick={handleSend} disabled={!input.trim() || sending} className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Send size={15} />পাঠান</button>
        </div>
      </div>}
    </Layout>
  )
}
