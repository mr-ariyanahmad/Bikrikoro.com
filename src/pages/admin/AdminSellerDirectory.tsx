import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileCheck2, Package, RefreshCw, Search, Send, UserRound } from 'lucide-react'
import { adminRpc } from '@/lib/adminRpc'
import { formatDateTime } from '@/lib/format'
import { BrandedDialog, DialogButton, DialogInput } from '@/components/BrandedDialog'
import { AdminTableCard, AdminStatCard } from '@/components/admin/AdminShell'
import { getSellerHealth } from '@/lib/adminSellerHealth'

type SellerRow = {
  user_id: string
  name: string
  email: string | null
  phone: string | null
  is_verified: boolean
  seller_level: 'NONE' | 'BASIC' | 'VERIFIED' | 'TRUSTED'
  seller_email_verified_at: string | null
  seller_basic_completed_at: string | null
  seller_basic_complete: boolean
  shop_name: string | null
  product_count: number
  latest_product_at: string | null
  registration_id: string | null
  registration_status: 'PENDING' | 'APPROVED' | 'REJECTED' | null
  registration_business_type: string | null
  registration_listing_mode: string | null
  registration_sector: string | null
  registration_submitted_at: string | null
  required_document_count: number
  uploaded_document_count: number
  approved_document_count: number
  pending_document_count: number
  missing_documents: string[]
  missing_items: string[]
  seller_status: 'VERIFICATION_PENDING' | 'VERIFICATION_REJECTED' | 'VERIFIED' | 'BASIC' | 'PRODUCT_SELLER'
}

type SellerFilter = 'ALL' | 'INCOMPLETE' | 'PENDING' | 'VERIFIED' | 'PRODUCT_SELLER' | 'RISK'

export default function AdminSellerDirectory() {
  const [sellers, setSellers] = useState<SellerRow[]>([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<SellerFilter>('ALL')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [notificationTarget, setNotificationTarget] = useState<SellerRow | null>(null)
  const [notificationTitle, setNotificationTitle] = useState('আপনার seller তথ্য সম্পূর্ণ করুন')
  const [notificationBody, setNotificationBody] = useState('আপনার seller account-এর কিছু তথ্য বা document এখনো বাকি আছে। অনুগ্রহ করে Seller Verification পেজে গিয়ে বাকি তথ্য জমা দিন।')
  const [sending, setSending] = useState(false)
  const [expandedSellerId, setExpandedSellerId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await adminRpc('admin_list_sellers')
    if (error) setMessage(error.message)
    else setSellers((data ?? []) as SellerRow[])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const stats = useMemo(() => ({
    total: sellers.length,
    incomplete: sellers.filter((seller) => seller.missing_items.length > 0).length,
    pending: sellers.filter((seller) => seller.registration_status === 'PENDING').length,
    active: sellers.filter((seller) => seller.product_count > 0).length,
    risk: sellers.filter((seller) => getSellerHealth(seller).score < 55).length,
  }), [sellers])

  const visible = useMemo(() => {
    const value = query.trim().toLowerCase()
    return sellers.filter((seller) => {
      const matchesQuery = !value || [seller.name, seller.email, seller.phone, seller.shop_name, seller.user_id].filter(Boolean).some((item) => String(item).toLowerCase().includes(value))
      const matchesFilter = filter === 'ALL'
        || (filter === 'INCOMPLETE' && seller.missing_items.length > 0)
        || (filter === 'PENDING' && seller.registration_status === 'PENDING')
        || (filter === 'VERIFIED' && ['VERIFIED', 'TRUSTED'].includes(seller.seller_level))
        || (filter === 'PRODUCT_SELLER' && seller.product_count > 0)
        || (filter === 'RISK' && getSellerHealth(seller).score < 55)
      return matchesQuery && matchesFilter
    })
  }, [filter, query, sellers])

  const sendNotification = async () => {
    if (!notificationTarget || !notificationTitle.trim() || !notificationBody.trim()) return
    setSending(true)
    const { error } = await adminRpc('admin_send_seller_notification', {
      p_user_id: notificationTarget.user_id,
      p_title: notificationTitle.trim(),
      p_body: notificationBody.trim(),
      p_link: '/seller/verification',
    })
    setSending(false)
    if (error) setMessage(error.message)
    else {
      setMessage(`${notificationTarget.name}-কে in-app notification পাঠানো হয়েছে।`)
      setNotificationTarget(null)
    }
  }

  return <section className="mb-8">
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><h2 className="text-xl font-extrabold text-slate-900">সকল সেলার</h2><p className="mt-1 text-sm leading-6 text-slate-500">যে user product upload করেছে বা seller flow শুরু করেছে, সবাই এখানে থাকবে। বাকি তথ্য দেখে seller-কে সরাসরি in-app message পাঠান।</p></div>
      <button type="button" onClick={() => void load()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-600 hover:border-brand-400 hover:text-brand-700"><RefreshCw size={16} />রিফ্রেশ</button>
    </div>
    {message && <p className="mb-4 rounded-xl border border-brand-100 bg-brand-50 p-3 text-sm text-brand-700">{message}</p>}
    <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><AdminStatCard label="মোট সেলার" value={stats.total} helper="সব seller profile" tone="blue" /><AdminStatCard label="তথ্য অসম্পূর্ণ" value={stats.incomplete} helper="follow-up দরকার" tone="amber" /><AdminStatCard label="Verification pending" value={stats.pending} helper="review queue" tone="red" /><AdminStatCard label="Product uploader" value={stats.active} helper="কমপক্ষে ১টি listing" tone="green" /><AdminStatCard label="Health risk" value={stats.risk} helper="score 55-এর নিচে" tone="red" /></div>
    <AdminTableCard>
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 p-4"><label className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="নাম, email, shop বা UID খুঁজুন" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand-500" /></label><div className="flex flex-wrap gap-2">{([['ALL', 'সব'], ['INCOMPLETE', 'তথ্য বাকি'], ['PENDING', 'Verification pending'], ['VERIFIED', 'Verified'], ['PRODUCT_SELLER', 'Product uploader'], ['RISK', 'Health risk']] as Array<[SellerFilter, string]>).map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${filter === value ? 'bg-brand-500 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:text-brand-700'}`}>{label}</button>)}</div></div>
      {loading ? <p className="p-10 text-center text-sm text-slate-500">সেলার তালিকা লোড হচ্ছে...</p> : visible.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">এই filter-এ কোনো seller পাওয়া যায়নি।</p> : <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">{visible.map((seller) => {
        const docsDone = seller.required_document_count > 0 ? `${seller.approved_document_count}/${seller.required_document_count}` : 'প্রযোজ্য নয়'
        const health = getSellerHealth(seller)
        const status = seller.registration_status === 'PENDING' ? 'Verification pending' : seller.seller_level === 'TRUSTED' ? 'Trusted' : seller.seller_level === 'VERIFIED' ? 'Verified' : seller.product_count > 0 ? 'Product seller' : 'Basic seller'
        return <div key={seller.user_id} className="grid gap-4 px-5 py-4 lg:grid-cols-[1.35fr_0.8fr_1.15fr_0.85fr_auto] lg:items-center">
          <div className="flex min-w-0 items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><UserRound size={18} /></span><div className="min-w-0"><p className="truncate font-bold text-slate-900">{seller.name}</p><p className="mt-1 truncate text-xs text-slate-500">{seller.email || 'Email নেই'} · {seller.phone || 'Phone নেই'}</p><p className="mt-1 truncate font-mono text-[10px] text-slate-400">UID: {seller.user_id}</p></div></div>
          <div><span className="inline-flex rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">{status}</span><p className="mt-2 text-xs text-slate-500">{seller.product_count}টি product</p><span title={health.reasons.join(' · ') || 'Seller setup ও activity ভালো'} className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${health.tone === 'green' ? 'bg-brand-50 text-brand-700' : health.tone === 'amber' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>Health {health.score} · {health.label}</span></div>
          <div className="text-sm text-slate-600"><p className="flex items-center gap-2"><FileCheck2 size={15} className="text-brand-600" />Document: <strong>{docsDone}</strong></p><p className="mt-1 text-xs text-slate-500">{seller.missing_items.length === 0 ? 'কোনো বাকি তথ্য নেই' : `বাকি: ${seller.missing_items.slice(0, 3).join(', ')}${seller.missing_items.length > 3 ? ` +${seller.missing_items.length - 3}` : ''}`}</p></div>
          <div className="text-xs text-slate-500"><p>{seller.shop_name || 'Shop name নেই'}</p><p className="mt-1">{seller.latest_product_at ? `শেষ upload: ${formatDateTime(seller.latest_product_at)}` : seller.registration_submitted_at ? `আবেদন: ${formatDateTime(seller.registration_submitted_at)}` : 'তারিখ নেই'}</p></div>
          <div className="flex flex-wrap gap-2"><a href={`/admin/customers/${seller.user_id}`} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:border-brand-400 hover:text-brand-700"><Package size={14} />বিস্তারিত</a><button type="button" onClick={() => setExpandedSellerId((current) => current === seller.user_id ? null : seller.user_id)} className="inline-flex items-center gap-1 rounded-lg border border-brand-200 px-3 py-2 text-xs font-bold text-brand-700 hover:bg-brand-50">তথ্য {expandedSellerId === seller.user_id ? 'লুকান' : 'দেখুন'}</button><button type="button" onClick={() => { setNotificationTarget(seller); setNotificationTitle(seller.missing_items.length ? 'আপনার seller তথ্য সম্পূর্ণ করুন' : 'আপনার seller account সম্পর্কে update'); setNotificationBody(seller.missing_items.length ? `আপনার seller account-এর কিছু তথ্য বা document এখনো বাকি আছে: ${seller.missing_items.join(', ')}। অনুগ্রহ করে Seller Verification পেজে গিয়ে বাকি তথ্য জমা দিন।` : 'আপনার seller account সম্পর্কে একটি গুরুত্বপূর্ণ update আছে। Seller Verification পেজে গিয়ে status দেখুন.') }} className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-3 py-2 text-xs font-bold text-white hover:bg-brand-600"><Send size={14} />Message</button></div>
          {expandedSellerId === seller.user_id && <div className="lg:col-span-5 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-950"><div className="grid gap-3 sm:grid-cols-3"><div><p className="text-xs font-semibold text-amber-700">Profile & setup</p><p className="mt-1">Email: {seller.seller_email_verified_at ? 'ভেরিফাইড' : 'বাকি'} · Basic seller: {seller.seller_basic_complete ? 'সম্পূর্ণ' : 'বাকি'}</p></div><div><p className="text-xs font-semibold text-amber-700">Verification</p><p className="mt-1">{seller.registration_status || 'আবেদন নেই'} · {seller.registration_listing_mode || 'mode নেই'} · {seller.registration_business_type || 'type নেই'}</p></div><div><p className="text-xs font-semibold text-amber-700">Documents</p><p className="mt-1">Required {seller.required_document_count} · Uploaded {seller.uploaded_document_count} · Approved {seller.approved_document_count}</p></div></div><div className="mt-3 border-t border-amber-200 pt-3"><p className="text-xs font-semibold text-amber-700">সম্পূর্ণ missing checklist</p>{seller.missing_items.length === 0 ? <p className="mt-1 text-brand-700">কোনো তথ্য বা document বাকি নেই।</p> : <ul className="mt-2 grid gap-1 sm:grid-cols-2">{seller.missing_items.map((item) => <li key={item} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />{item}</li>)}</ul>}</div></div>}
        </div>
      })}</div>}
    </AdminTableCard>
    <BrandedDialog open={Boolean(notificationTarget)} title="সেলারকে in-app notification পাঠান" onClose={() => setNotificationTarget(null)} actions={<><DialogButton onClick={() => setNotificationTarget(null)} variant="outline">বাতিল</DialogButton><DialogButton onClick={() => void sendNotification()} disabled={sending}>{sending ? 'পাঠানো হচ্ছে...' : 'পাঠান'}</DialogButton></>}><p><strong>{notificationTarget?.name}</strong>-এর BikriKoro inbox-এ এই message যাবে।</p><DialogInput value={notificationTitle} onChange={setNotificationTitle} placeholder="Notification title" /><DialogInput value={notificationBody} onChange={setNotificationBody} placeholder="সেলারকে কী জানাবেন?" /></BrandedDialog>
  </section>
}
