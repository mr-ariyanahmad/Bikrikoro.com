import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
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
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('chat_threads')
      .select('*')
      .or(`buyer_id.eq.${uid},seller_id.eq.${uid}`)
      .order('last_message_at', { ascending: false })

    const rows = data ?? []
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
    setLoading(false)
  }, [uid])

  useEffect(() => {
    load()
    const channel = supabase
      .channel(`chat-threads-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_threads' }, load)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [uid, load])

  return (
    <Layout>
      <h1 className="text-xl font-semibold text-ink-900">চ্যাট</h1>

      <div className="mt-5 space-y-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-outline/40" />
          ))
        ) : threads.length === 0 ? (
          <div className="rounded-2xl border border-outline bg-surface p-8 text-center text-ink-600">
            এখনো কোনো চ্যাট নেই। পণ্যের পেজ থেকে বিক্রেতাকে মেসেজ করুন।
          </div>
        ) : (
          threads.map((thread) => {
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
    </Layout>
  )
}
