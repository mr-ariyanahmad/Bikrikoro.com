import { useEffect, useMemo, useState, useCallback } from 'react'
import { Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { chatRequest } from '@/lib/chat'
import { useAuth } from '@/context/AuthContext'
import { Layout } from '@/components/Layout'
import { formatDateTime } from '@/lib/format'
import type { ChatThread } from '@/types/chat'

interface ThreadWithName extends ChatThread {
  otherName: string
}

export default function ChatList() {
  const { user } = useAuth()
  const uid = user!.uid
  const [threads, setThreads] = useState<ThreadWithName[]>([])
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'all' | 'unread'>('all')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const result = await chatRequest<{ threads?: ChatThread[] }>({ action: 'list' })
      const rows = result.threads ?? []
    const otherIds = [...new Set(rows.map((t) => (t.buyer_id === uid ? t.seller_id : t.buyer_id)))]

    const { data: profiles } = otherIds.length
      ? await supabase.from('profiles').select('id, name').in('id', otherIds)
      : { data: [] }
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]))

      setThreads(
        rows.map((t) => ({
          ...t,
          otherName: nameById.get(t.buyer_id === uid ? t.seller_id : t.buyer_id) || 'ব্যবহারকারী',
        }))
      )
    } catch {
      setThreads([])
    } finally {
      setLoading(false)
    }
  }, [uid])

  useEffect(() => {
    void load()
    const poller = window.setInterval(() => {
      void load()
    }, 12000)
    return () => window.clearInterval(poller)
  }, [load])

  const visibleThreads = useMemo(() => threads.filter((thread) => { const unread = thread.buyer_id === uid ? thread.buyer_unread_count : thread.seller_unread_count; return (view === 'all' || unread > 0) && (!query.trim() || thread.otherName.toLowerCase().includes(query.trim().toLowerCase()) || (thread.last_message ?? '').toLowerCase().includes(query.trim().toLowerCase())) }), [query, threads, uid, view])

  return (
    <Layout wide hideFooter fullScreen>
      <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3"><div><h1 className="text-xl font-semibold text-ink-900">চ্যাট</h1><p className="mt-1 text-sm text-ink-500">Buyer ও seller conversation দ্রুত manage করুন।</p></div><span className="rounded-xl bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700">{threads.length}টি conversation</span></div>
      <div className="mt-5 flex shrink-0 flex-col gap-2 sm:flex-row"><label className="relative flex-1"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="নাম বা মেসেজ খুঁজুন..." className="w-full rounded-xl border border-outline py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand-500" /></label><div className="flex rounded-xl border border-outline p-1"><button onClick={() => setView('all')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${view === 'all' ? 'bg-brand-500 text-white' : 'text-ink-600'}`}>সব</button><button onClick={() => setView('unread')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${view === 'unread' ? 'bg-brand-500 text-white' : 'text-ink-600'}`}>Unread</button></div></div>

      <div className="mt-5 min-h-0 flex-1 space-y-2 overflow-y-auto pb-1">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-outline/40" />
          ))
        ) : visibleThreads.length === 0 ? (
          <div className="rounded-2xl border border-outline bg-surface p-8 text-center text-ink-600">
            এখনো কোনো চ্যাট নেই। পণ্যের পেজ থেকে বিক্রেতাকে মেসেজ করুন।
          </div>
        ) : (
          visibleThreads.map((thread) => {
            const unread = thread.buyer_id === uid ? thread.buyer_unread_count : thread.seller_unread_count
            return (
              <Link
                key={thread.id}
                to={`/chat/${thread.id}`}
                className="flex items-center gap-3 rounded-xl border border-outline bg-surface p-3 hover:border-brand-500/40"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700">
                  {thread.otherName.charAt(0) || '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-ink-900">{thread.otherName}</p>
                    <span className="shrink-0 text-xs text-ink-300">{formatDateTime(thread.last_message_at)}</span>
                  </div>
                  <p className="truncate text-xs text-ink-600">{thread.last_message || 'নতুন কথোপকথন'}</p>
                </div>
                {unread > 0 && (
                  <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-500 px-1.5 text-xs font-semibold text-white">
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
