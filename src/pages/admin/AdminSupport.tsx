import { useCallback, useEffect, useState } from 'react'
import { AdminPageHeader, AdminShell, AdminTableCard } from '@/components/admin/AdminShell'
import { useAuth } from '@/context/AuthContext'
import { formatAdminRpcError } from '@/lib/adminRpcError'
import { formatDateTime } from '@/lib/format'
import { adminRpc } from '@/lib/adminRpc'

type Thread = { id: string; buyer_id: string; seller_id: string; product_id: string | null; last_message: string; last_message_at: string; buyer_unread_count: number; seller_unread_count: number }
export default function AdminSupport() {
  const { user } = useAuth()
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ user_id: '', title: '', body: '', link: '' })
  const [message, setMessage] = useState<string | null>(null)
  const load = useCallback(() => {
    setLoading(true)
    adminRpc('admin_list_chat_threads', { p_admin_id: user?.uid }).then(({ data, error }) => {
      setThreads((data ?? []) as Thread[])
      if (error) setMessage(formatAdminRpcError(error, 'চ্যাট thread', '014 admin workspace migration'))
      setLoading(false)
    })
  }, [user?.uid])
  useEffect(() => { load() }, [load])
  const send = async () => {
    if (!form.user_id.trim() || !form.title.trim() || !form.body.trim()) { setMessage('User ID, title এবং message দিন।'); return }
    const { error } = await adminRpc('admin_send_notification', { p_admin_id: user?.uid, p_user_id: form.user_id.trim(), p_title: form.title.trim(), p_body: form.body.trim(), p_link: form.link.trim() || null })
    if (error) setMessage(formatAdminRpcError(error, 'Notification send', '014 admin workspace migration'))
    else { setMessage('Notification পাঠানো হয়েছে।'); setForm({ user_id: '', title: '', body: '', link: '' }) }
  }
  return <AdminShell><AdminPageHeader title="সাপোর্ট ও যোগাযোগ" description="Buyer-seller chat context দেখুন এবং প্রয়োজনে user notification পাঠান।" /><div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]"><AdminTableCard><div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">চ্যাট থ্রেড</h2><p className="mt-1 text-xs text-slate-500">শেষ activity অনুযায়ী সাজানো</p></div>{loading ? <p className="p-10 text-center text-sm text-slate-500">লোড হচ্ছে...</p> : threads.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">কোনো chat thread নেই।</p> : <div className="divide-y divide-slate-100">{threads.map((thread) => <div key={thread.id} className="px-5 py-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-800">Buyer {thread.buyer_id.slice(0, 10)} ↔ Seller {thread.seller_id.slice(0, 10)}</p><p className="mt-1 truncate text-sm text-slate-600">{thread.last_message || 'কোনো message নেই'}</p></div><span className="shrink-0 text-xs text-slate-400">{formatDateTime(thread.last_message_at)}</span></div><p className="mt-2 text-xs text-slate-400">Unread: buyer {thread.buyer_unread_count} · seller {thread.seller_unread_count}</p></div>)}</div>}</AdminTableCard><AdminTableCard><div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">User notification</h2><p className="mt-1 text-xs text-slate-500">কোনো নির্দিষ্ট account-এ message পাঠান</p></div><div className="space-y-3 p-5"><Field label="User ID" value={form.user_id} onChange={(value) => setForm({ ...form, user_id: value })} placeholder="Firebase UID" /><Field label="Title" value={form.title} onChange={(value) => setForm({ ...form, title: value })} placeholder="আপনার order update" /><label className="block text-sm text-slate-600"><span className="mb-1 block font-medium text-slate-800">Message</span><textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={4} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-brand-500" /></label><Field label="Link (optional)" value={form.link} onChange={(value) => setForm({ ...form, link: value })} placeholder="/orders/…" /><button type="button" onClick={send} className="w-full rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white">Notification পাঠান</button>{message && <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{message}</p>}</div></AdminTableCard></div></AdminShell>
}
function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) { return <label className="block text-sm text-slate-600"><span className="mb-1 block font-medium text-slate-800">{label}</span><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-brand-500" /></label> }
