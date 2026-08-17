import { useCallback, useEffect, useState } from 'react'
import { CheckCheck, Filter } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { useAuth } from '@/context/AuthContext'
import { loadNotifications, markAllNotificationsRead, markNotificationRead } from '@/lib/marketplace'

interface NotificationItem {
  id: string
  type: string
  title: string
  body: string
  link: string | null
  is_read: boolean
  created_at: string
}

export default function Notifications() {
  const { user } = useAuth()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'unread' | 'ORDER' | 'SYSTEM'>('all')

  const load = useCallback(() => {
    if (!user) return
    setLoading(true)
    loadNotifications(user.uid)
      .then((data) => setItems(data as NotificationItem[]))
      .catch((err) => {
        console.error('notifications load failed:', err)
        setError('নোটিফিকেশন লোড করা যায়নি। নতুন migration প্রয়োগ করা হয়েছে কি না যাচাই করুন।')
      })
      .finally(() => setLoading(false))
  }, [user])

  useEffect(() => {
    load()
    // Polling is intentionally conservative: it keeps the feature useful on
    // deployments where Supabase Realtime is not enabled for this table.
    const timer = window.setInterval(load, 30000)
    return () => window.clearInterval(timer)
  }, [load])

  const markAll = async () => { if (!user) return; try { await markAllNotificationsRead(user.uid); setItems((current) => current.map((item) => ({ ...item, is_read: true }))) } catch { setError('সব নোটিফিকেশন read করা যায়নি।') } }
  const visibleItems = items.filter((item) => filter === 'all' || (filter === 'unread' ? !item.is_read : item.type === filter))

  const read = async (item: NotificationItem) => {
    if (!user || item.is_read) return
    try {
      await markNotificationRead(item.id, user.uid)
      setItems((current) => current.map((value) => (value.id === item.id ? { ...value, is_read: true } : value)))
    } catch (err) {
      console.error('mark notification read failed:', err)
    }
  }

  return (
    <Layout wide>
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-xl font-semibold text-ink-900">নোটিফিকেশন</h1><p className="mt-1 text-sm text-ink-600">অর্ডার, পেমেন্ট, রিভিউ ও অ্যাকাউন্ট আপডেট এক জায়গায়।</p></div><div className="flex items-center gap-2"><button onClick={markAll} disabled={!items.some((item) => !item.is_read)} className="inline-flex items-center gap-1.5 rounded-lg border border-outline px-3 py-2 text-sm font-medium text-ink-600 hover:border-brand-500 hover:text-brand-600 disabled:opacity-40"><CheckCheck size={15} />সব read</button><button onClick={load} className="rounded-lg border border-outline px-3 py-2 text-sm font-medium text-ink-600 hover:border-brand-500 hover:text-brand-600">রিফ্রেশ</button></div></div>
      <div className="mt-5 flex flex-wrap items-center gap-2"><Filter size={15} className="text-ink-400" />{([['all', 'সব'], ['unread', `Unread (${items.filter((item) => !item.is_read).length})`], ['ORDER', 'অর্ডার'], ['SYSTEM', 'সিস্টেম']] as const).map(([value, label]) => <button key={value} onClick={() => setFilter(value)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter === value ? 'bg-brand-500 text-white' : 'border border-outline text-ink-600'}`}>{label}</button>)}</div>

      {error && <p className="mt-5 rounded-xl bg-error/10 p-4 text-sm text-error">{error}</p>}
      {loading ? (
        <div className="mt-6 space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-20 animate-pulse rounded-xl bg-outline/40" />)}</div>
      ) : visibleItems.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-outline bg-surface p-10 text-center text-sm text-ink-600">
          নতুন কোনো নোটিফিকেশন নেই।
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {visibleItems.map((item) => {
            const content = (
              <div className={`rounded-xl border p-4 transition ${item.is_read ? 'border-outline bg-surface' : 'border-brand-200 bg-brand-50/60'}`}>
                <div className="flex gap-3">
                  <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.is_read ? 'bg-outline' : 'bg-brand-500'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink-900">{item.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-600">{item.body}</p>
                    <p className="mt-2 text-xs text-ink-300">{new Date(item.created_at).toLocaleString('bn-BD')}</p>
                  </div>
                </div>
              </div>
            )
            return item.link ? (
              <Link key={item.id} to={item.link} onClick={() => read(item)}>
                {content}
              </Link>
            ) : (
              <button key={item.id} onClick={() => read(item)} className="block w-full text-left">
                {content}
              </button>
            )
          })}
        </div>
      )}
    </Layout>
  )
}
