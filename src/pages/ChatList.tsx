import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { BadgeCheck, MessageCircle, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { chatRequest } from '@/lib/chat'
import { useAuth } from '@/context/AuthContext'
import { Layout } from '@/components/Layout'
import { formatDateTime } from '@/lib/format'
import { displayShopName, displayUserName } from '@/lib/shopProfile'
import { readCachedValue, userCacheKey, writeCachedValue } from '@/lib/clientCache'
import type { ChatThread } from '@/types/chat'

interface ThreadWithName extends ChatThread {
  otherName: string
  otherPhotoUrl: string | null
  isSellerConversation: boolean
  otherVerified: boolean
}

const CHAT_LIST_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000

export default function ChatList() {
  const { user } = useAuth()
  const uid = user!.uid
  const [threads, setThreads] = useState<ThreadWithName[]>([])
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'all' | 'unread'>('all')
  const [loading, setLoading] = useState(true)
  const hasCachedThreads = useRef(false)
  const cacheKey = userCacheKey(uid, 'chat-list')

  const load = useCallback(async () => {
    try {
      const result = await chatRequest<{ threads?: ChatThread[] }>({ action: 'list' })
      const rows = result.threads ?? []
    const otherIds = [...new Set(rows.map((t) => (t.buyer_id === uid ? t.seller_id : t.buyer_id)))]

    const { data: profiles } = otherIds.length
      ? await supabase.from('profiles').select('id, name, photo_url, shop_name, is_verified').in('id', otherIds)
      : { data: [] }
    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]))

      const nextThreads = rows.map((t) => {
          const isSellerConversation = t.buyer_id === uid
          const otherId = isSellerConversation ? t.seller_id : t.buyer_id
          const profile = profileById.get(otherId)
          return {
            ...t,
            otherName: isSellerConversation ? displayShopName(profile?.shop_name, profile?.name) : displayUserName(profile?.name),
            otherPhotoUrl: profile?.photo_url ?? null,
            otherVerified: Boolean(profile?.is_verified),
            isSellerConversation,
          }
        })
      setThreads(nextThreads)
      writeCachedValue(cacheKey, nextThreads)
    } catch {
      if (!hasCachedThreads.current) setThreads([])
    } finally {
      setLoading(false)
    }
  }, [cacheKey, uid])

  useEffect(() => {
    const cachedThreads = readCachedValue<ThreadWithName[]>(cacheKey, CHAT_LIST_CACHE_MAX_AGE_MS)
    if (cachedThreads) {
      hasCachedThreads.current = true
      setThreads(cachedThreads.value)
      setLoading(false)
    } else {
      hasCachedThreads.current = false
      setLoading(true)
    }
    void load()
    const poller = window.setInterval(() => {
      void load()
    }, 12000)
    return () => window.clearInterval(poller)
  }, [cacheKey, load])

  const visibleThreads = useMemo(() => threads.filter((thread) => { const unread = thread.buyer_id === uid ? thread.buyer_unread_count : thread.seller_unread_count; return (view === 'all' || unread > 0) && (!query.trim() || thread.otherName.toLowerCase().includes(query.trim().toLowerCase()) || (thread.last_message ?? '').toLowerCase().includes(query.trim().toLowerCase())) }), [query, threads, uid, view])
  const unreadMessageCount = useMemo(() => threads.reduce((total, thread) => total + Number(thread.buyer_id === uid ? thread.buyer_unread_count : thread.seller_unread_count), 0), [threads, uid])

  return (
    <Layout wide hideFooter fullScreen>
      <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3 border-b border-outline pb-4"><div><h1 className="text-2xl font-bold tracking-tight text-ink-900">চ্যাট</h1><p className="mt-1 text-sm text-ink-500">শপ ও ক্রেতার সঙ্গে আপনার সব কথোপকথন।</p></div>{threads.length > 0 && <span className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700">{threads.length}টি চ্যাট{unreadMessageCount > 0 ? ` · ${unreadMessageCount}টি অপঠিত` : ''}</span>}</div>
      <div className="mt-4 flex shrink-0 flex-col gap-2 sm:flex-row"><label className="relative flex-1"><Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="নাম বা মেসেজ খুঁজুন" className="w-full rounded-xl border border-outline bg-surface py-3 pl-10 pr-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10" /></label><div className="flex rounded-xl border border-outline bg-surface p-1"><button type="button" aria-pressed={view === 'all'} onClick={() => setView('all')} className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${view === 'all' ? 'bg-brand-500 text-white shadow-sm' : 'text-ink-600'}`}>সব</button><button type="button" aria-pressed={view === 'unread'} onClick={() => setView('unread')} className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${view === 'unread' ? 'bg-brand-500 text-white shadow-sm' : 'text-ink-600'}`}>অপঠিত ({unreadMessageCount})</button></div></div>

      <div className="mt-5 min-h-0 flex-1 space-y-2 overflow-y-auto pb-1">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-outline/40" />
          ))
        ) : visibleThreads.length === 0 ? (
          <div className="rounded-2xl border border-outline bg-surface p-8 text-center text-ink-600">
            <MessageCircle size={30} className="mx-auto text-brand-500" />
            <p className="mt-3 font-semibold text-ink-900">এখনো কোনো চ্যাট নেই</p>
            <p className="mt-1 text-sm">পণ্যের পেজ থেকে বিক্রেতাকে মেসেজ করুন।</p>
          </div>
        ) : (
          visibleThreads.map((thread) => {
            const unread = thread.buyer_id === uid ? thread.buyer_unread_count : thread.seller_unread_count
            return (
              <Link
                key={thread.id}
                to={`/chat/${thread.id}`}
                className={`flex items-center gap-3 border-b border-outline bg-surface p-3.5 transition last:border-b-0 hover:bg-brand-50/50 active:scale-[0.995] ${unread > 0 ? 'bg-brand-50/40' : ''}`}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-lg font-bold text-brand-700">
                  {thread.otherPhotoUrl ? <img src={thread.otherPhotoUrl} alt="" className="h-full w-full object-cover" /> : (thread.otherName.charAt(0) || '?')}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`flex min-w-0 items-center gap-1 truncate text-sm ${unread > 0 ? 'font-bold' : 'font-semibold'} text-ink-900`}>{thread.otherName}{thread.otherVerified && <BadgeCheck size={14} className="shrink-0 text-brand-600" />}</p>
                    <span className={`shrink-0 text-xs ${unread > 0 ? 'font-semibold text-brand-700' : 'text-ink-400'}`}>{formatDateTime(thread.last_message_at)}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-ink-600">{thread.last_message || (thread.isSellerConversation ? 'নতুন শপ কথোপকথন' : 'নতুন কথোপকথন')}</p>
                </div>
                {unread > 0 && (
                  <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-500 px-1.5 text-[11px] font-bold text-white">
                    {unread}
                  </span>
                )}
              </Link>
            )
          })
        )}
      </div>
      </div>
    </Layout>
  )
}
