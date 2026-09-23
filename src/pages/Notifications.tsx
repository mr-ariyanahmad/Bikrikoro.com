import { useCallback, useEffect, useState } from 'react'
import { Bell, BellRing, CheckCheck, CreditCard, Megaphone, MessageCircle, Package, RefreshCw, ShieldCheck, WalletCards } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { BrandedDialog, DialogButton } from '@/components/BrandedDialog'
import { useAuth } from '@/context/AuthContext'
import { loadNotifications, markAllNotificationsRead, markNotificationRead } from '@/lib/marketplace'
import { registerPushToken, type PushRegistrationResult } from '@/lib/pushNotifications'
import { supabase } from '@/lib/supabase'

interface NotificationItem {
  id: string
  type: string
  title: string
  body: string
  link: string | null
  is_read: boolean
  created_at: string
}

type NotificationFilter = 'all' | 'unread'

function notifyHeader(unreadCount: number) {
  window.dispatchEvent(new CustomEvent('bikrikoro-notifications-changed', { detail: { unreadCount } }))
}

export default function Notifications() {
  const { user } = useAuth()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<NotificationFilter>('all')
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [pushState, setPushState] = useState<'idle' | 'loading' | 'registered' | 'denied' | 'unsupported' | 'missing-config' | 'unavailable'>('idle')
  const [pushMessage, setPushMessage] = useState<string | null>(null)
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false)

  useEffect(() => {
    let active = true
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPushPermission('unsupported')
      setPushState('unsupported')
      return () => { active = false }
    }
    const permission = Notification.permission
    setPushPermission(permission)
    if (permission === 'denied') {
      setPushState('denied')
      setPushMessage('নোটিফিকেশন আগে বন্ধ করা হয়েছে। আবার চালু করতে browser settings থেকে এই সাইটের notification permission পরিবর্তন করুন।')
      return () => { active = false }
    }
    if (permission === 'granted' && user) {
      setPushState('loading')
      void registerPushToken(user.uid).then((result: PushRegistrationResult) => {
        if (!active) return
        if (result.status === 'registered') {
          setPushState('registered')
          setPushMessage(null)
        } else {
          setPushState(result.status)
        }
      })
    } else {
      setPushState('idle')
      setPushMessage(null)
    }
    return () => { active = false }
  }, [user])

  const load = useCallback(async () => {
    if (!user) return
    try {
      const data = (await loadNotifications(user.uid)) as NotificationItem[]
      setItems(data)
      notifyHeader(data.filter((item) => !item.is_read).length)
      setError(null)
    } catch (err) {
      console.error('notifications load failed:', err)
      setError(`নোটিফিকেশন লোড করা যায়নি: ${err instanceof Error ? err.message : 'অজানা server সমস্যা'}`)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    setItems([])
    setLoading(true)
    void load()
    const channel = supabase
      .channel(`notifications-${user.uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.uid}` }, () => {
        void load()
      })
      .subscribe()
    const onVisible = () => { if (document.visibilityState === 'visible') void load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      void supabase.removeChannel(channel)
    }
  }, [load, user])

  const enablePushNotifications = async () => {
    if (!user || pushState === 'loading') return
    setPushState('loading')
    setPushMessage(null)
    const result = await registerPushToken(user.uid, { requestPermission: true })
    if (typeof window !== 'undefined' && 'Notification' in window) setPushPermission(Notification.permission)
    if (result.status === 'registered') {
      setPushState('registered')
      setPushMessage('নোটিফিকেশন চালু হয়েছে। নতুন order, payment, chat ও wallet update এখন জানানো হবে।')
      return
    }
    if (result.status === 'denied') {
      setPushState('denied')
      setPushMessage('নোটিফিকেশন অনুমতি দেওয়া হয়নি। আবার চালু করতে browser settings থেকে এই সাইটের notification permission পরিবর্তন করুন।')
      return
    }
    setPushState(result.status)
    setPushMessage(result.status === 'missing-config' ? 'এই সাইটে push notification setup এখনো সম্পূর্ণ হয়নি।' : result.status === 'unsupported' ? 'আপনার browser push notification support করছে না।' : 'নোটিফিকেশন চালু করা যায়নি। কিছুক্ষণ পর আবার চেষ্টা করুন।')
  }

  const markAll = async () => {
    if (!user) return
    try {
      await markAllNotificationsRead(user.uid)
      setItems((current) => current.map((item) => ({ ...item, is_read: true })))
      notifyHeader(0)
    } catch (err) {
      console.error('mark all notifications failed:', err)
      setError(`সব নোটিফিকেশন read করা যায়নি: ${err instanceof Error ? err.message : 'অজানা server সমস্যা'}`)
    }
  }

  const read = async (item: NotificationItem) => {
    if (!user || item.is_read) return
    try {
      await markNotificationRead(item.id, user.uid)
      setItems((current) => {
        const next = current.map((value) => (value.id === item.id ? { ...value, is_read: true } : value))
        notifyHeader(next.filter((value) => !value.is_read).length)
        return next
      })
    } catch (err) {
      console.error('mark notification read failed:', err)
      setError(`নোটিফিকেশন read করা যায়নি: ${err instanceof Error ? err.message : 'অজানা server সমস্যা'}`)
    }
  }

  const unreadCount = items.filter((item) => !item.is_read).length
  const visibleItems = items.filter((item) => filter === 'all' || !item.is_read)

  const notificationMeta = (type: string) => {
    if (type === 'ORDER') return { label: 'অর্ডার', icon: Package, tone: 'bg-blue-50 text-blue-700' }
    if (type === 'PAYMENT') return { label: 'পেমেন্ট', icon: CreditCard, tone: 'bg-emerald-50 text-emerald-700' }
    if (type === 'VERIFICATION') return { label: 'ভেরিফিকেশন', icon: ShieldCheck, tone: 'bg-violet-50 text-violet-700' }
    if (type === 'CHAT') return { label: 'চ্যাট', icon: MessageCircle, tone: 'bg-cyan-50 text-cyan-700' }
    if (type === 'WALLET') return { label: 'ওয়ালেট', icon: WalletCards, tone: 'bg-amber-50 text-amber-700' }
    if (type === 'CAMPAIGN') return { label: 'ঘোষণা', icon: Megaphone, tone: 'bg-orange-50 text-orange-700' }
    return { label: 'সিস্টেম', icon: Bell, tone: 'bg-slate-100 text-slate-700' }
  }

  return (
    <Layout wide>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Bell size={21} /></span><div className="min-w-0"><h1 className="text-xl font-bold text-ink-900">নোটিফিকেশন</h1><p className="mt-0.5 truncate text-sm text-ink-500">আপনার গুরুত্বপূর্ণ আপডেটগুলো এখানে</p></div></div>
        <div className="flex shrink-0 items-center gap-1"><button type="button" onClick={() => void load()} aria-label="রিফ্রেশ" className="grid h-10 w-10 place-items-center rounded-xl text-ink-500 transition hover:bg-brand-50 hover:text-brand-700"><RefreshCw size={17} /></button><button type="button" onClick={markAll} disabled={!unreadCount} className="hidden items-center gap-1.5 rounded-xl border border-outline px-3 py-2 text-xs font-bold text-ink-600 transition hover:border-brand-500 hover:text-brand-600 disabled:opacity-40 sm:inline-flex"><CheckCheck size={15} />সব read</button></div>
      </div>
      {pushPermission !== 'granted' && pushState !== 'registered' && pushState !== 'denied' && pushState !== 'unsupported' && pushState !== 'missing-config' && pushState !== 'unavailable' && (
        <section className="mt-5 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-4 text-white shadow-sm sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15"><BellRing size={22} /></span>
            <div className="min-w-0 flex-1"><h2 className="font-bold">সকল তথ্য পেতে নোটিফিকেশন চালু করুন</h2><p className="mt-1 text-sm leading-6 text-brand-50/90">অর্ডার, পেমেন্ট, যাচাই, চ্যাট ও ওয়ালেটের আপডেট সময়মতো পেতে ব্রাউজার নোটিফিকেশন চালু করুন।</p><button type="button" onClick={() => setPermissionDialogOpen(true)} disabled={pushState === 'loading'} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-brand-700 transition hover:bg-brand-50 disabled:cursor-wait disabled:opacity-70"><Bell size={16} />{pushState === 'loading' ? 'অনুমতি নেওয়া হচ্ছে…' : 'নোটিফিকেশন চালু করুন'}</button></div>
          </div>
        </section>
      )}
      {pushState === 'denied' && pushMessage && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">{pushMessage}</p>}
      {pushState === 'missing-config' && pushMessage && <p className="mt-4 rounded-xl border border-outline bg-bg p-3 text-sm leading-6 text-ink-600">{pushMessage}</p>}
      {pushMessage && pushState === 'registered' && <p className="mt-4 rounded-xl bg-brand-50 p-3 text-sm leading-6 text-brand-700">{pushMessage}</p>}
      <BrandedDialog open={permissionDialogOpen} title="নোটিফিকেশন চালু করবেন?" onClose={() => setPermissionDialogOpen(false)} actions={<><DialogButton variant="outline" onClick={() => setPermissionDialogOpen(false)}>এখন নয়</DialogButton><DialogButton onClick={() => { setPermissionDialogOpen(false); void enablePushNotifications() }}>চালু করুন</DialogButton></>}><p>অর্ডার, পেমেন্ট, বিক্রেতার যাচাই, চ্যাট এবং ওয়ালেটের গুরুত্বপূর্ণ আপডেট সময়মতো পেতে নোটিফিকেশন চালু করুন। পরের ধাপে আপনার ব্রাউজারের অনুমতির বার্তা আসবে; সেখানে <strong>অনুমতি দিন</strong> নির্বাচন করলেই সেটআপ সম্পূর্ণ হবে।</p></BrandedDialog>

      <div className="mt-6 flex items-center justify-between border-b border-outline pb-3"><div className="flex items-center gap-1 rounded-xl bg-bg p-1"><button type="button" onClick={() => setFilter('all')} className={`rounded-lg px-3.5 py-2 text-xs font-bold transition ${filter === 'all' ? 'bg-surface text-brand-700 shadow-sm' : 'text-ink-500'}`}>সব</button><button type="button" onClick={() => setFilter('unread')} className={`rounded-lg px-3.5 py-2 text-xs font-bold transition ${filter === 'unread' ? 'bg-surface text-brand-700 shadow-sm' : 'text-ink-500'}`}>অপঠিত</button></div><span className="text-xs font-semibold text-ink-400">{unreadCount ? `${unreadCount}টি নতুন` : 'সব দেখা হয়েছে'}</span></div>

      {error && <p className="mt-5 rounded-xl bg-error/10 p-4 text-sm text-error">{error}</p>}
      {loading ? (
        <div className="mt-6 space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-20 animate-pulse rounded-xl bg-outline/40" />)}</div>
      ) : visibleItems.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-outline bg-surface p-10 text-center text-sm text-ink-600">নতুন কোনো নোটিফিকেশন নেই।</div>
      ) : (
        <div className="mt-6 space-y-3">
          {visibleItems.map((item) => {
            const meta = notificationMeta(item.type)
            const Icon = meta.icon
            const content = (
              <div className={`rounded-2xl border p-3.5 transition hover:border-brand-200 ${item.is_read ? 'border-outline bg-surface' : 'border-brand-200 bg-brand-50/40'}`}>
                <div className="flex gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${meta.tone}`}><Icon size={18} /></span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="font-bold text-ink-900">{item.title}</p>{!item.is_read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}</div><p className="mt-1 text-sm leading-relaxed text-ink-600">{item.body}</p><div className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-ink-400"><span className={`rounded-full px-2 py-0.5 ${meta.tone}`}>{meta.label}</span><span>•</span><span>{new Date(item.created_at).toLocaleString('bn-BD')}</span></div></div></div>
              </div>
            )
            return item.link ? <Link key={item.id} to={item.link} onClick={() => void read(item)}>{content}</Link> : <button type="button" key={item.id} onClick={() => void read(item)} className="block w-full text-left">{content}</button>
          })}
        </div>
      )}
    </Layout>
  )
}
