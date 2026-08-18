import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bell, Megaphone, RefreshCw, Send, Users } from 'lucide-react'
import { AdminPageHeader, AdminShell, AdminStatCard, AdminTableCard } from '@/components/admin/AdminShell'
import { useAuth } from '@/context/AuthContext'
import { auth } from '@/lib/firebase'
import { formatDateTime } from '@/lib/format'
import { BrandSelect } from '@/components/BrandSelect'

type TargetType = 'ALL' | 'CUSTOMERS' | 'SELLERS' | 'USER_LIST'
type Campaign = {
  id: string
  target_type: TargetType
  title: string
  body: string
  link: string | null
  send_push: boolean
  status: string
  recipient_count: number
  push_sent_count: number
  push_failed_count: number
  created_at: string
}

async function callNotificationApi(payload: Record<string, unknown>) {
  const idToken = await auth.currentUser?.getIdToken()
  if (!idToken) throw new Error('Admin Firebase session পাওয়া যায়নি।')
  const response = await fetch('/api/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(payload),
  })
  const raw = await response.text()
  let result: { data?: Campaign[]; campaign?: Campaign & { campaign_id?: string; recipient_count?: number }; error?: string } = {}
  try {
    result = raw ? JSON.parse(raw) as typeof result : {}
  } catch {
    result = {}
  }
  if (!response.ok) {
    const detail = result.error || raw.trim() || `HTTP ${response.status}`
    throw new Error(`${detail} (HTTP ${response.status})`)
  }
  return result
}

const targetOptions: Array<{ value: TargetType; label: string; description: string }> = [
  { value: 'ALL', label: 'সব ব্যবহারকারী', description: 'ব্লক করা account বাদে পুরো marketplace' },
  { value: 'CUSTOMERS', label: 'কাস্টমার', description: 'যারা seller হিসেবে চিহ্নিত নয়' },
  { value: 'SELLERS', label: 'সেলার', description: 'listing বা অনুমোদিত seller verification আছে' },
  { value: 'USER_LIST', label: 'নির্দিষ্ট ব্যবহারকারী', description: 'Firebase UID-এর তালিকা দিয়ে target করুন' },
]

export default function AdminNotifications() {
  const { user } = useAuth()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [form, setForm] = useState({ target_type: 'ALL' as TargetType, user_ids: '', title: '', body: '', link: '', send_push: true })

  const load = useCallback(async () => {
    if (!user?.uid) return
    setLoading(true)
    try {
      const result = await callNotificationApi({ action: 'admin_campaigns' })
      setCampaigns(result.data ?? [])
    } catch (error) {
      console.error('Campaign history load failed:', error)
      setMessage(`Campaign history লোড করা যায়নি: ${error instanceof Error ? error.message : 'অজানা server সমস্যা'}`)
    } finally {
      setLoading(false)
    }
  }, [user?.uid])

  useEffect(() => { void load() }, [load])

  const totals = useMemo(() => ({
    campaigns: campaigns.length,
    recipients: campaigns.reduce((sum, item) => sum + Number(item.recipient_count || 0), 0),
    sent: campaigns.reduce((sum, item) => sum + Number(item.push_sent_count || 0), 0),
  }), [campaigns])

  const createCampaign = async () => {
    if (!user?.uid) return
    if (form.title.trim().length < 2 || form.body.trim().length < 2) {
      setMessage('Title এবং message দুটোই পূরণ করুন।')
      return
    }
    const userIds = form.target_type === 'USER_LIST' ? form.user_ids.split(/[\s,]+/).map((value) => value.trim()).filter(Boolean) : []
    if (form.target_type === 'USER_LIST' && userIds.length === 0) {
      setMessage('নির্দিষ্ট user target করতে অন্তত একটি Firebase UID দিন।')
      return
    }

    setSending(true)
    setMessage(null)
    let campaign: (Campaign & { campaign_id?: string; recipient_count?: number }) | null = null
    try {
      const result = await callNotificationApi({
        action: 'create_campaign',
        targetType: form.target_type,
        targetUserIds: userIds,
        title: form.title.trim(),
        body: form.body.trim(),
        link: form.link.trim() || null,
        sendPush: form.send_push,
      })
      campaign = result.campaign ?? null
    } catch (error) {
      setMessage(`Campaign তৈরি হয়নি: ${error instanceof Error ? error.message : 'অজানা সমস্যা'}`)
      setSending(false)
      return
    }
    let pushMessage = ''
    if (form.send_push && campaign?.campaign_id) {
      try {
        const idToken = await auth.currentUser?.getIdToken()
        if (!idToken) throw new Error('Admin Firebase session পাওয়া যায়নি।')
        const response = await fetch('/api/notification-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ campaignId: campaign.campaign_id, adminId: user.uid, title: form.title.trim(), body: form.body.trim(), link: form.link.trim() || '/' }),
        })
        const result = await response.json().catch(() => ({})) as { error?: string; sent?: number; failed?: number }
        if (!response.ok) throw new Error(result.error || 'Push delivery failed')
        pushMessage = ` Push পাঠানো হয়েছে: ${result.sent ?? 0}টি, ব্যর্থ: ${result.failed ?? 0}টি।`
      } catch (pushError) {
        pushMessage = ` In-app notification গেছে, কিন্তু push delivery সম্পন্ন হয়নি: ${pushError instanceof Error ? pushError.message : 'অজানা সমস্যা'}।`
      }
    }

    setMessage(`Campaign পাঠানো হয়েছে। ${campaign?.recipient_count ?? 0}টি account-এ in-app notification গেছে।${pushMessage}`)
    setForm({ target_type: 'ALL', user_ids: '', title: '', body: '', link: '', send_push: true })
    await load()
    setSending(false)
  }

  return (
    <AdminShell>
      <AdminPageHeader title="নোটিফিকেশন ক্যাম্পেইন" description="অর্ডার ও system event-এর পাশাপাশি নির্দিষ্ট audience-কে branded in-app এবং Firebase push বার্তা পাঠান।" actions={<button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-600 hover:border-brand-400 hover:text-brand-700"><RefreshCw size={16} />রিফ্রেশ</button>} />

      {message && <div className="mb-5 rounded-2xl border border-brand-100 bg-brand-50 p-4 text-sm leading-relaxed text-brand-700">{message}</div>}
      <div className="mb-6 grid gap-4 sm:grid-cols-3"><AdminStatCard label="মোট campaign" value={totals.campaigns} helper="সর্বশেষ ১০০টি" tone="blue" /><AdminStatCard label="ইন-অ্যাপ প্রাপক" value={totals.recipients.toLocaleString('bn-BD')} helper="campaign-এর ইতিহাস" tone="green" /><AdminStatCard label="Push পৌঁছেছে" value={totals.sent.toLocaleString('bn-BD')} helper="Firebase delivery" tone="amber" /></div>

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <AdminTableCard>
          <div className="border-b border-slate-200 px-5 py-4"><div className="flex items-center gap-2"><Megaphone size={18} className="text-brand-700" /><h2 className="font-semibold text-slate-900">নতুন campaign</h2></div><p className="mt-1 text-xs text-slate-500">একবার পাঠালে in-app inbox-এ সংরক্ষিত হবে।</p></div>
          <div className="space-y-4 p-5">
            <BrandSelect label="কাকে পাঠাবেন?" value={form.target_type} options={targetOptions.map((option) => ({ value: option.value, label: `${option.label} — ${option.description}` }))} onChange={(value) => setForm({ ...form, target_type: value as TargetType })} />
            {form.target_type === 'USER_LIST' && <label className="block text-sm text-slate-600"><span className="mb-1 block font-medium text-slate-800">Firebase UID তালিকা</span><textarea value={form.user_ids} onChange={(event) => setForm({ ...form, user_ids: event.target.value })} rows={3} placeholder="প্রতি লাইনে একটি UID বা comma দিয়ে" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-xs outline-none focus:border-brand-500" /></label>}
            <Field label="শিরোনাম" value={form.title} onChange={(value) => setForm({ ...form, title: value })} placeholder="আজকের marketplace update" />
            <label className="block text-sm text-slate-600"><span className="mb-1 block font-medium text-slate-800">বার্তা</span><textarea value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} rows={4} placeholder="আপনার জন্য নতুন সুবিধা এসেছে…" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-brand-500" /></label>
            <Field label="অ্যাপ লিংক (ঐচ্ছিক)" value={form.link} onChange={(value) => setForm({ ...form, link: value })} placeholder="/products অথবা /wallet" />
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"><input type="checkbox" checked={form.send_push} onChange={(event) => setForm({ ...form, send_push: event.target.checked })} className="mt-0.5 h-4 w-4 accent-blue-600" /><span><span className="font-semibold text-slate-900">Firebase push পাঠান</span><span className="mt-0.5 block text-xs text-slate-500">যে user browser push permission দিয়েছে, শুধু তার device-এ যাবে।</span></span></label>
            <button onClick={() => void createCampaign()} disabled={sending} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 disabled:cursor-wait disabled:opacity-60"><Send size={16} />{sending ? 'পাঠানো হচ্ছে…' : 'Campaign পাঠান'}</button>
          </div>
        </AdminTableCard>

        <AdminTableCard>
          <div className="border-b border-slate-200 px-5 py-4"><div className="flex items-center gap-2"><Bell size={18} className="text-amber-600" /><h2 className="font-semibold text-slate-900">Campaign-এর ইতিহাস</h2></div><p className="mt-1 text-xs text-slate-500">ইন-অ্যাপ প্রাপক, push delivery এবং failure count সহ।</p></div>
          {loading ? <p className="p-10 text-center text-sm text-slate-500">লোড হচ্ছে…</p> : campaigns.length === 0 ? <div className="p-10 text-center text-sm text-slate-500"><Users size={24} className="mx-auto mb-2 text-slate-300" />এখনো কোনো campaign পাঠানো হয়নি।</div> : <div className="divide-y divide-slate-100">{campaigns.map((campaign) => <div key={campaign.id} className="px-5 py-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-900">{campaign.title}</p><Status status={campaign.status} /></div><p className="mt-1 text-sm leading-relaxed text-slate-600">{campaign.body}</p></div><span className="shrink-0 text-xs text-slate-400">{formatDateTime(campaign.created_at)}</span></div><div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-600"><span className="rounded-full bg-slate-100 px-2.5 py-1">Audience: {targetOptions.find((option) => option.value === campaign.target_type)?.label || campaign.target_type}</span><span className="rounded-full bg-brand-50 px-2.5 py-1 text-brand-700">ইন-অ্যাপ {campaign.recipient_count}</span>{campaign.send_push && <><span className="rounded-full bg-green-50 px-2.5 py-1 text-green-700">Push {campaign.push_sent_count}</span><span className="rounded-full bg-red-50 px-2.5 py-1 text-red-700">ব্যর্থ {campaign.push_failed_count}</span></>}</div></div>)}</div>}
        </AdminTableCard>
      </div>
    </AdminShell>
  )
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="block text-sm text-slate-600"><span className="mb-1 block font-medium text-slate-800">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-brand-500" /></label>
}

function Status({ status }: { status: string }) {
  const tone = status === 'SENT' || status === 'IN_APP_SENT' ? 'bg-green-50 text-green-700' : status === 'PARTIAL' ? 'bg-amber-50 text-amber-700' : status === 'FAILED' ? 'bg-red-50 text-red-700' : 'bg-brand-50 text-brand-700'
  const label: Record<string, string> = { SENT: 'সম্পন্ন', IN_APP_SENT: 'In-app সম্পন্ন', PARTIAL: 'আংশিক', FAILED: 'ব্যর্থ', PUSH_QUEUED: 'Push queue' }
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${tone}`}>{label[status] || status}</span>
}
