import { useCallback, useEffect, useState } from 'react'
import { Ban, CheckCircle2, CreditCard, FileText, MessageCircle, Package, Save, Send, ShieldAlert, UserRound, WalletCards } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { AdminPageHeader, AdminShell, AdminTableCard } from '@/components/admin/AdminShell'
import { BrandedDialog, DialogButton, DialogInput } from '@/components/BrandedDialog'
import { useAuth } from '@/context/AuthContext'
import { formatDateTime, formatTaka } from '@/lib/format'
import { formatAdminRpcError } from '@/lib/adminRpcError'
import { adminRpc } from '@/lib/adminRpc'

type CustomerOverview = {
  profile: { id: string; name: string; email: string | null; phone: string | null; photo_url?: string | null; is_verified: boolean; is_blocked?: boolean; admin_note?: string; created_at: string }
  wallet: { available_balance?: number }
  orders: Array<Record<string, unknown>>
  ledger: Array<{ id: string; amount: number; type: string; description: string; created_at: string }>
  products: Array<{ id: string; title: string; price: number; is_hidden?: boolean; created_at: string }>
  disputes: Array<Record<string, unknown>>
  chats: Array<Record<string, unknown>>
  notifications: Array<Record<string, unknown>>
}

export default function AdminCustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [overview, setOverview] = useState<CustomerOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [walletOpen, setWalletOpen] = useState(false)
  const [blockOpen, setBlockOpen] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [notificationTitle, setNotificationTitle] = useState('')
  const [notificationBody, setNotificationBody] = useState('')
  const [walletAmount, setWalletAmount] = useState('')
  const [walletReason, setWalletReason] = useState('')
  const [blockReason, setBlockReason] = useState('')
  const [adminNote, setAdminNote] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!id || !user?.uid) return
    setLoading(true)
    const { data, error: loadError } = await adminRpc('admin_get_customer_overview', { p_admin_id: user.uid, p_customer_id: id })
    if (loadError) setError(formatAdminRpcError(loadError, 'Customer detail', '026 customer controls migration'))
    else { const next = data as CustomerOverview; setOverview(next); setAdminNote(next.profile.admin_note ?? '') }
    setLoading(false)
  }, [id, user?.uid])

  useEffect(() => { load() }, [load])

  const adjustWallet = async () => {
    const amount = Number(walletAmount)
    if (!Number.isFinite(amount) || amount === 0 || walletReason.trim().length < 3 || !id) { setMessage('শূন্য ছাড়া টাকার পরিমাণ এবং কারণ লিখুন।'); return }
    setSaving(true); setMessage(null)
    const { error: actionError } = await adminRpc('admin_adjust_customer_wallet', { p_admin_id: user?.uid, p_customer_id: id, p_amount: amount, p_reason: walletReason.trim() })
    if (actionError) setMessage(actionError.message.includes('negative') ? 'এই deduction করলে wallet negative হয়ে যাবে।' : formatAdminRpcError(actionError, 'Customer wallet adjustment', '026 customer controls migration'))
    else { setWalletOpen(false); setWalletAmount(''); setWalletReason(''); setMessage('Wallet adjustment ledger-এ সংরক্ষিত হয়েছে।'); load() }
    setSaving(false)
  }

  const toggleBlock = async () => {
    if (!id || blockReason.trim().length < 3) { setMessage('Block/unblock করার কারণ লিখুন।'); return }
    setSaving(true)
    const { error: actionError } = await adminRpc('admin_set_customer_blocked', { p_admin_id: user?.uid, p_customer_id: id, p_blocked: !overview?.profile.is_blocked, p_reason: blockReason.trim() })
    if (actionError) setMessage(formatAdminRpcError(actionError, 'Customer account status', '026 customer controls migration'))
    else { setBlockOpen(false); setBlockReason(''); setMessage(overview?.profile.is_blocked ? 'Customer account চালু করা হয়েছে।' : 'Customer account block করা হয়েছে।'); load() }
    setSaving(false)
  }

  const saveNote = async () => {
    if (!id) return
    setSaving(true)
    const { error: actionError } = await adminRpc('admin_set_customer_note', { p_admin_id: user?.uid, p_customer_id: id, p_note: adminNote })
    setMessage(actionError ? formatAdminRpcError(actionError, 'Admin note save', '026 customer controls migration') : 'Admin note সেভ হয়েছে।')
    setSaving(false)
    if (!actionError) load()
  }

  const sendNotification = async () => {
    if (!id || notificationTitle.trim().length < 2 || notificationBody.trim().length < 3) { setMessage('Notification title ও message লিখুন।'); return }
    setSaving(true)
    const { error: actionError } = await adminRpc('admin_send_notification', { p_admin_id: user?.uid, p_user_id: id, p_title: notificationTitle.trim(), p_body: notificationBody.trim(), p_link: '/account' })
    setMessage(actionError ? formatAdminRpcError(actionError, 'Customer notification', '026 customer controls migration') : 'Customer-কে notification পাঠানো হয়েছে।')
    setSaving(false)
    if (!actionError) { setNotificationOpen(false); setNotificationTitle(''); setNotificationBody(''); load() }
  }

  if (loading) return <AdminShell><AdminPageHeader title="Customer detail" description="Customer workspace লোড হচ্ছে..." /><AdminTableCard><div className="h-64 animate-pulse bg-slate-100" /></AdminTableCard></AdminShell>
  if (!overview) return <AdminShell><AdminPageHeader title="Customer detail" description="Customer পাওয়া যায়নি।" /><p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error ?? 'এই customer আর নেই।'}</p></AdminShell>

  const { profile, wallet, orders, ledger, products, disputes, chats, notifications } = overview
  const balance = Number(wallet.available_balance ?? 0)
  const issues = [profile.is_blocked && 'Account বর্তমানে blocked', !profile.is_verified && 'Profile verification অসম্পূর্ণ', disputes.length > 0 && `${disputes.length}টি dispute আছে`, orders.length === 0 && 'এখনো কোনো order নেই'].filter(Boolean) as string[]
  return <AdminShell><AdminPageHeader title="Customer workspace" description="একজন customer-এর profile, activity, wallet এবং সমস্যা এক জায়গা থেকে দেখুন।"  />{error && <p className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}{message && <p className="mb-4 rounded-xl bg-brand-50 p-4 text-sm text-brand-700">{message}</p>}<div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]"><AdminTableCard><div className="flex flex-wrap items-start gap-4 p-5"><div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-brand-50 text-xl font-bold text-brand-700">{profile.photo_url ? <img src={profile.photo_url} alt="" className="h-full w-full object-cover" /> : profile.name?.charAt(0) || <UserRound size={25} />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-bold text-slate-900">{profile.name || 'নাম দেওয়া হয়নি'}</h2>{profile.is_verified && <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700"><CheckCircle2 size={13} />Verified</span>}{profile.is_blocked && <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700"><Ban size={13} />Blocked</span>}</div><p className="mt-1 break-all text-sm text-slate-500">{profile.email || 'Email নেই'} · {profile.phone || 'Phone নেই'}</p><p className="mt-1 font-mono text-[11px] text-slate-400">UID: {profile.id}</p><p className="mt-1 text-xs text-slate-400">Joined {formatDateTime(profile.created_at)}</p></div></div><div className="grid gap-3 border-t border-slate-100 p-5 sm:grid-cols-3"><Metric icon={WalletCards} label="Wallet balance" value={formatTaka(balance)} /><Metric icon={Package} label="Orders" value={String(orders.length)} /><Metric icon={MessageCircle} label="Chats" value={String(chats.length)} /></div></AdminTableCard><AdminTableCard><div className="border-b border-slate-100 p-5"><div className="flex items-center gap-2"><ShieldAlert size={18} className="text-amber-600" /><h2 className="font-semibold text-slate-900">কোথায় সমস্যা আছে?</h2></div></div><div className="space-y-2 p-5">{issues.length === 0 ? <p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-700">এখন কোনো বড় সমস্যা ধরা পড়েনি।</p> : issues.map((issue) => <p key={issue} className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{issue}</p>)}</div></AdminTableCard></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><button type="button" onClick={() => setWalletOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-3 text-sm font-bold text-white hover:bg-brand-600"><CreditCard size={17} />টাকা যোগ/কেটে নিন</button><button type="button" onClick={() => setNotificationOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-200 px-4 py-3 text-sm font-bold text-brand-700"><Send size={17} />Notification পাঠান</button><button type="button" onClick={() => setBlockOpen(true)} className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold ${profile.is_blocked ? 'border-brand-200 text-brand-700' : 'border-red-200 text-red-600'}`}><Ban size={17} />{profile.is_blocked ? 'Account চালু করুন' : 'Account block করুন'}</button><button type="button" onClick={saveNote} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 disabled:opacity-50"><Save size={17} />Note সেভ করুন</button></div><AdminTableCard className="mt-5"><div className="p-5"><label className="block text-sm font-semibold text-slate-800">Admin note<textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} rows={3} placeholder="Customer-এর সমস্যা, support history বা risk note লিখুন..." className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500" /></label></div></AdminTableCard><div className="mt-5 grid gap-5 xl:grid-cols-2"><DataList title="সাম্প্রতিক order" icon={Package} empty="কোনো order নেই।">{orders.slice(0, 8).map((order, index) => <div key={String(order.id ?? index)} className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 text-sm"><span className="truncate text-slate-700">{String(order.product_title ?? order.id ?? 'Order')}</span><span className="shrink-0 text-xs text-slate-500">{String(order.status ?? '')}</span></div>)}</DataList><DataList title="Wallet ledger" icon={WalletCards} empty="কোনো wallet entry নেই।">{ledger.slice(0, 8).map((entry) => <div key={entry.id} className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 text-sm"><div className="min-w-0"><p className="truncate text-slate-700">{entry.description || entry.type}</p><p className="text-xs text-slate-400">{formatDateTime(entry.created_at)}</p></div><span className={`shrink-0 font-semibold ${Number(entry.amount) >= 0 ? 'text-brand-700' : 'text-red-600'}`}>{Number(entry.amount) >= 0 ? '+' : ''}{formatTaka(Number(entry.amount))}</span></div>)}</DataList><DataList title="Seller listings" icon={FileText} empty="এই customer-এর seller listing নেই。">{products.slice(0, 8).map((product) => <div key={product.id} className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 text-sm"><Link to={`/products/${product.id}`} className="truncate font-semibold text-brand-700">{product.title}</Link><span className="shrink-0 text-xs text-slate-500">{product.is_hidden ? 'Hidden' : formatTaka(product.price)}</span></div>)}</DataList><DataList title="Support activity" icon={MessageCircle} empty="কোনো chat বা notification নেই।"><div className="grid grid-cols-2 gap-3 p-5"><Metric icon={MessageCircle} label="Chats" value={String(chats.length)} /><Metric icon={FileText} label="Notifications" value={String(notifications.length)} /><Metric icon={ShieldAlert} label="Disputes" value={String(disputes.length)} /></div></DataList></div><BrandedDialog open={walletOpen} title="Customer wallet adjustment" tone="warning" onClose={() => setWalletOpen(false)} actions={<><DialogButton onClick={() => setWalletOpen(false)} variant="outline">বাতিল</DialogButton><DialogButton onClick={adjustWallet} tone="warning" disabled={saving}>সংরক্ষণ করুন</DialogButton></>}><p>Positive amount দিলে টাকা যোগ হবে, negative amount দিলে টাকা কাটা হবে। প্রতিটি adjustment wallet ledger ও admin audit log-এ থাকবে।</p><DialogInput value={walletAmount} onChange={setWalletAmount} placeholder="যেমন: 500 বা -200" /><DialogInput value={walletReason} onChange={setWalletReason} placeholder="কারণ: refund correction" /></BrandedDialog><BrandedDialog open={notificationOpen} title="Customer-কে notification পাঠান" onClose={() => setNotificationOpen(false)} actions={<><DialogButton onClick={() => setNotificationOpen(false)} variant="outline">বাতিল</DialogButton><DialogButton onClick={sendNotification} disabled={saving}>পাঠান</DialogButton></>}><p>এই notification customer-এর inbox-এ যাবে এবং admin audit log-এ সংরক্ষিত হবে।</p><DialogInput value={notificationTitle} onChange={setNotificationTitle} placeholder="শিরোনাম" /><DialogInput value={notificationBody} onChange={setNotificationBody} placeholder="Customer-কে কী জানাবেন?" /></BrandedDialog><BrandedDialog open={blockOpen} title={profile.is_blocked ? 'Customer account চালু করবেন?' : 'Customer account block করবেন?'} tone={profile.is_blocked ? 'success' : 'danger'} onClose={() => setBlockOpen(false)} actions={<><DialogButton onClick={() => setBlockOpen(false)} variant="outline">বাতিল</DialogButton><DialogButton onClick={toggleBlock} tone={profile.is_blocked ? 'success' : 'danger'} disabled={saving}>{profile.is_blocked ? 'চালু করুন' : 'Block করুন'}</DialogButton></>}><p>এই action-এর কারণ লিখুন। Customer-এর profile-এ status ও admin audit log update হবে।</p><DialogInput value={blockReason} onChange={setBlockReason} placeholder="কারণ লিখুন" /></BrandedDialog></AdminShell>
}

function Metric({ icon: Icon, label, value }: { icon: typeof WalletCards; label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-3"><Icon size={16} className="text-brand-600" /><p className="mt-2 text-xs text-slate-500">{label}</p><p className="mt-1 text-lg font-bold text-slate-900">{value}</p></div> }
function DataList({ title, icon: Icon, empty, children }: { title: string; icon: typeof Package; empty: string; children: React.ReactNode }) { return <AdminTableCard><div className="flex items-center gap-2 border-b border-slate-100 p-5"><Icon size={17} className="text-brand-600" /><h2 className="font-semibold text-slate-900">{title}</h2></div>{children || <p className="p-6 text-center text-sm text-slate-500">{empty}</p>}</AdminTableCard> }
