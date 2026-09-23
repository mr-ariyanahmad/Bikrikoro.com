import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { BadgeCheck, Headphones, MessageCircle, Search } from 'lucide-react'
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
  const uid = user?.uid ?? ''
  const [threads, setThreads] = useState<ThreadWithName[]>([])
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'all' | 'unread'>('all')
  const [loading, setLoading] = useState(true)
  const hasCachedThreads = useRef(false)
  const cacheKey = userCacheKey(uid, 'chat-list')

  const load = useCallback(async () => {
    if (!uid) return
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
      const sortedThreads = nextThreads.sort((left, right) => new Date(right.last_message_at || right.created_at).getTime() - new Date(left.last_message_at || left.created_at).getTime())
      setThreads(sortedThreads)
      writeCachedValue(cacheKey, sortedThreads)
    } catch {
      if (!hasCachedThreads.current) setThreads([])
    } finally {
      setLoading(false)
    }
  }, [cacheKey, uid])

  useEffect(() => {
    if (!uid) {
      setLoading(false)
      return
    }
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
  }, [cacheKey, load, uid])

  const visibleThreads = useMemo(() => threads.filter((thread) => { const unread = thread.buyer_id === uid ? thread.buyer_unread_count : thread.seller_unread_count; return (view === 'all' || unread > 0) && (!query.trim() || thread.otherName.toLowerCase().includes(query.trim().toLowerCase()) || (thread.last_message ?? '').toLowerCase().includes(query.trim().toLowerCase())) }), [query, threads, uid, view])
  const unreadMessageCount = useMemo(() => threads.reduce((total, thread) => total + Number(thread.buyer_id === uid ? thread.buyer_unread_count : thread.seller_unread_count), 0), [threads, uid])

  return (
    <Layout wide hideFooter>
      <div className="mx-auto w-full max-w-3xl">
      <div className="flex items-center justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-600">BikriKoro inbox</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-ink-900">চ্যাট</h1></div>{threads.length > 0 && <span className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700">{threads.length}টি চ্যাট</span>}</div>
      <div className="mt-5 rounded-2xl border border-accent-100 bg-accent-100/70 p-3"><div className="flex items-center gap-2.5"><div className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white p-1 shadow-sm"><img src="/icon-512.png" alt="BikriKoro Support" className="h-full w-full rounded-xl object-cover" /><span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-accent-500 text-white shadow-sm"><Headphones size={13} strokeWidth={2.4} /></span></div><div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><p className="text-sm font-bold text-ink-900">BikriKoro Support</p><BadgeCheck size={15} className="text-brand-500" /></div><p className="mt-0.5 truncate text-xs font-semibold text-accent-600">নিরাপদ কেনাকাটায় আমরা পাশে আছি</p></div><Link to="/help" className="rounded-full bg-accent-500 px-2.5 py-1.5 text-[11px] font-bold text-white">সহায়তা</Link></div></div>
      <div className="mt-5 flex shrink-0 flex-col gap-2 sm:flex-row"><label className="relative flex-1"><Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="নাম বা মেসেজ খুঁজুন" className="w-full rounded-2xl border border-outline bg-surface py-3.5 pl-10 pr-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10" /></label><div className="flex rounded-2xl border border-outline bg-surface p-1"><button type="button" aria-pressed={view === 'all'} onClick={() => setView('all')} className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${view === 'all' ? 'bg-brand-500 text-white shadow-sm' : 'text-ink-600'}`}>সব</button><button type="button" aria-pressed={view === 'unread'} onClick={() => setView('unread')} className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${view === 'unread' ? 'bg-brand-500 text-white shadow-sm' : 'text-ink-600'}`}>অপঠিত ({unreadMessageCount})</button></div></div>

      <div className="mt-5 space-y-2 pb-1">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-outline/40" />
          ))
        ) : visibleThreads.length === 0 ? (
          <div className="rounded-[1.35rem] border border-outline bg-surface px-5 py-16 text-center text-ink-600 shadow-sm">
            <MessageCircle size={52} strokeWidth={1.5} className="mx-auto text-ink-300" />
            <p className="mt-4 text-lg font-semibold text-ink-900">এখনো কোনো কথোপকথন নেই</p>
            <p className="mt-1 text-sm">পণ্যের পেজ থেকে বিক্রেতাকে মেসেজ করলে এখানেই দেখা যাবে।</p>
          </div>
        ) : (
          visibleThreads.map((thread) => {
            const unread = thread.buyer_id === uid ? thread.buyer_unread_count : thread.seller_unread_count
            return (
              <Link
                key={thread.id}
                to={`/chat/${thread.id}`}
                className={`flex items-center gap-3 rounded-2xl border border-outline bg-surface p-3.5 transition hover:border-brand-200 hover:bg-brand-50/50 active:scale-[0.995] ${unread > 0 ? 'border-brand-100 bg-brand-50/50' : ''}`}
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
