import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, BadgeCheck, ChevronRight, CircleAlert, CreditCard, Headphones, LockKeyhole, MessageCircle, Package, Plus, Send, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { useAuth } from '@/context/AuthContext'
import { chatRequest } from '@/lib/chat'
import { auth } from '@/lib/firebase'
import { formatDateTime } from '@/lib/format'
import { formatOrderNumber } from '@/lib/orderNumber'
import type { Order } from '@/types/order'

type SupportCase = { id: string; case_number: number; category: string; status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'; order_id: string | null; subject: string; created_at: string; updated_at: string; last_message: string; message_count: number }
type SupportMessage = { id: string; case_id: string; sender_id: string; sender_role: 'CUSTOMER' | 'SUPPORT'; text: string; created_at: string }
type Category = { key: string; title: string; description: string; icon: typeof Package }

const categories: Category[] = [
  { key: 'ORDER_PRODUCT', title: 'অর্ডার ও পণ্য', description: 'অর্ডার, ডেলিভারি বা পণ্য নিয়ে সাহায্য', icon: Package },
  { key: 'PAYMENT', title: 'পেমেন্ট', description: 'পেমেন্ট, রিফান্ড বা লেনদেন', icon: CreditCard },
  { key: 'ACCOUNT_SECURITY', title: 'অ্যাকাউন্ট ও নিরাপত্তা', description: 'লগইন, প্রোফাইল ও নিরাপত্তা', icon: LockKeyhole },
  { key: 'REPORT_COMPLAINT', title: 'রিপোর্ট ও অভিযোগ', description: 'সমস্যা বা অভিযোগ জানাতে', icon: CircleAlert },
  { key: 'OTHER', title: 'অন্যান্য', description: 'অন্য যেকোনো বিষয়ে সহায়তা', icon: MessageCircle },
]
const categoryMap = new Map(categories.map((category) => [category.key, category]))
const statusLabels: Record<SupportCase['status'], string> = { OPEN: 'Open', IN_PROGRESS: 'In progress', RESOLVED: 'Resolved', CLOSED: 'Closed' }

export default function SupportCenter() {
  const { user } = useAuth()
  const [cases, setCases] = useState<SupportCase[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [selectedCase, setSelectedCase] = useState<SupportCase | null>(null)
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showNewRequest, setShowNewRequest] = useState(false)
  const [orderChoice, setOrderChoice] = useState('')
  const [error, setError] = useState<string | null>(null)

  const loadCases = useCallback(async () => {
    const result = await chatRequest<{ cases?: SupportCase[] }>({ action: 'support_cases' })
    const nextCases = result.cases ?? []
    setCases(nextCases)
    setSelectedCase((current) => current ? nextCases.find((item) => item.id === current.id) ?? current : nextCases[0] ?? null)
  }, [])

  useEffect(() => {
    void loadCases().catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Support cases লোড করা যায়নি।')).finally(() => setLoading(false))
    const loadOrders = async () => {
      const token = await auth.currentUser?.getIdToken()
      if (!token) return
      const response = await fetch('/api/order-read', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'list' }) })
      if (response.ok) {
        const payload = await response.json() as { orders?: Order[] }
        setOrders((payload.orders ?? []).filter((order) => order.buyer_id === user?.uid))
      }
    }
    void loadOrders().catch(() => undefined)
  }, [loadCases, user?.uid])

  useEffect(() => {
    if (!selectedCase) { setMessages([]); return }
    setMessagesLoading(true)
    void chatRequest<{ messages?: SupportMessage[] }>({ action: 'support_case_messages', caseId: selectedCase.id }).then((result) => setMessages(result.messages ?? [])).catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'কথোপকথন লোড করা যায়নি।')).finally(() => setMessagesLoading(false))
  }, [selectedCase])

  const createCase = async (category: Category) => {
    if (category.key === 'ORDER_PRODUCT' && !orderChoice) { setError('অর্ডার-সংক্রান্ত সহায়তার জন্য একটি অর্ডার বেছে নিন।'); return }
    setSaving(true); setError(null)
    try {
      const result = await chatRequest<{ supportCase?: SupportCase }>({ action: 'support_create_case', category: category.key, subject: category.title, orderId: orderChoice || null })
      setShowNewRequest(false); setOrderChoice('')
      await loadCases()
      if (result.supportCase?.id) setSelectedCase(result.supportCase)
    } catch (createError) { setError(createError instanceof Error ? createError.message : 'Support case তৈরি করা যায়নি।') } finally { setSaving(false) }
  }

  const sendMessage = async () => {
    if (!selectedCase || !message.trim() || saving || ['RESOLVED', 'CLOSED'].includes(selectedCase.status)) return
    const text = message.trim(); setSaving(true); setError(null)
    try {
      await chatRequest({ action: 'support_send_message', caseId: selectedCase.id, text })
      setMessage('')
      const result = await chatRequest<{ messages?: SupportMessage[] }>({ action: 'support_case_messages', caseId: selectedCase.id })
      setMessages(result.messages ?? [])
      await loadCases()
    } catch (sendError) { setError(sendError instanceof Error ? sendError.message : 'মেসেজ পাঠানো যায়নি।') } finally { setSaving(false) }
  }

  const selectedCategory = selectedCase ? categoryMap.get(selectedCase.category) : null
  const SelectedIcon = selectedCategory?.icon ?? ShieldCheck
  const hasCases = cases.length > 0

  return <Layout wide hideFooter hideMobileQuickNav backFallback="/chat" backLabel="চ্যাটে ফিরুন">
    <div className={hasCases ? 'mx-auto flex h-[calc(100dvh-8.5rem)] w-full max-w-4xl flex-col overflow-hidden' : 'mx-auto w-full max-w-3xl pb-8'}>
      <div className="flex shrink-0 items-center gap-3"><Link to="/chat" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-outline text-ink-700 hover:bg-brand-50" aria-label="চ্যাটে ফিরে যান"><ArrowLeft size={18} /></Link><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-ink-900">BikriKoro Support</p>{hasCases && selectedCase && <p className="mt-0.5 truncate text-[11px] text-brand-700">CASE #BK-{selectedCase.case_number} · {selectedCategory?.title ?? selectedCase.subject}</p>}</div>{hasCases && <button type="button" onClick={() => setShowNewRequest((current) => !current)} className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-brand-500 px-2.5 py-2 text-[11px] font-bold text-brand-700"><Plus size={14} />নতুন অনুরোধ</button>}</div>

      {!hasCases && <><div className="mt-6 rounded-3xl bg-brand-500 p-5 text-white shadow-lg shadow-brand-500/15"><div className="flex items-start gap-3"><div className="relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/15 p-1"><img src="/icon-512.png" alt="BikriKoro Support" className="h-full w-full rounded-xl object-cover" /><span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full border-2 border-brand-500 bg-white text-brand-600"><Headphones size={13} /></span></div><div><div className="flex items-center gap-1.5"><h1 className="text-lg font-bold">আমরা আপনাকে কীভাবে সাহায্য করতে পারি?</h1><BadgeCheck size={17} /></div><p className="mt-1 text-sm leading-6 text-white/80">একটি বিষয় বেছে নিন, আমরা একই Support Chat-এর মধ্যে আপনার জন্য Case খুলে দেব।</p></div></div></div><div className="mt-6"><h2 className="text-lg font-bold text-ink-900">সহায়তার বিষয় বেছে নিন</h2><p className="mt-1 text-sm text-ink-500">আপনার প্রশ্ন অনুযায়ী একটি নতুন Case শুরু হবে।</p></div></>}

      {(showNewRequest || !hasCases) && <div className="mt-3 grid gap-2 sm:grid-cols-2">{categories.map((category) => { const Icon = category.icon; return <div key={category.key} className="rounded-2xl border border-outline bg-surface p-3 transition hover:border-brand-300"><button type="button" onClick={() => void createCase(category)} disabled={saving} className="flex w-full items-center gap-3 text-left"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><Icon size={19} /></span><span className="min-w-0 flex-1"><strong className="block text-sm text-ink-900">{category.title}</strong><span className="mt-0.5 block text-xs text-ink-500">{category.description}</span></span><ChevronRight size={17} className="shrink-0 text-ink-300" /></button>{category.key === 'ORDER_PRODUCT' && <select value={orderChoice} onChange={(event) => setOrderChoice(event.target.value)} className="mt-3 w-full rounded-xl border border-outline bg-bg px-3 py-2 text-xs outline-none focus:border-brand-500"><option value="">অর্ডার বেছে নিন</option>{orders.map((order) => <option key={order.id} value={order.id}>{formatOrderNumber(order.order_number, order.id)} · {order.product_title}</option>)}</select>}</div> })}</div>}

      {error && <p className="mt-3 shrink-0 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading ? <div className="mt-5 h-32 animate-pulse rounded-2xl bg-outline/40" /> : hasCases && <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-outline bg-surface"><div className="shrink-0 border-b border-outline bg-surface p-3"><div className="flex gap-2 overflow-x-auto">{cases.map((item) => { const category = categoryMap.get(item.category); return <button type="button" key={item.id} onClick={() => setSelectedCase(item)} className={`min-w-[9.5rem] shrink-0 rounded-xl border px-3 py-2 text-left transition ${selectedCase?.id === item.id ? 'border-brand-400 bg-brand-50' : 'border-outline bg-bg hover:border-brand-200'}`}><p className="text-[10px] font-bold text-brand-700">CASE #BK-{item.case_number}</p><p className="mt-1 truncate text-xs font-bold text-ink-900">{category?.title ?? item.subject}</p><span className={`mt-1 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-bold ${item.status === 'RESOLVED' || item.status === 'CLOSED' ? 'bg-ink-100 text-ink-500' : 'bg-brand-100 text-brand-700'}`}>{statusLabels[item.status]}</span></button> })}</div></div><div className="flex min-h-0 flex-1 flex-col"><div className="flex shrink-0 items-center gap-2 border-b border-outline bg-bg px-3 py-2.5"><span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-600"><SelectedIcon size={16} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-ink-900">{selectedCategory?.title ?? 'Support Case'}</p><p className="text-[10px] text-ink-500">CASE #BK-{selectedCase?.case_number} · {selectedCase ? statusLabels[selectedCase.status] : ''}</p></div></div><div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-bg p-3">{messagesLoading ? <div className="h-20 animate-pulse rounded-xl bg-outline/40" /> : messages.length === 0 ? <div className="py-12 text-center text-sm text-ink-500"><MessageCircle size={32} className="mx-auto mb-3 text-ink-300" />এই Case-এ এখনো কোনো message নেই।</div> : messages.map((item) => <div key={item.id} className={`flex ${item.sender_role === 'CUSTOMER' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm ${item.sender_role === 'CUSTOMER' ? 'rounded-br-md bg-brand-500 text-white' : 'rounded-bl-md bg-surface text-ink-900 shadow-sm'}`}><p className="whitespace-pre-wrap break-words">{item.text}</p><p className={`mt-1 text-[10px] ${item.sender_role === 'CUSTOMER' ? 'text-white/70' : 'text-ink-400'}`}>{formatDateTime(item.created_at)}</p></div></div>)}</div><div className="flex shrink-0 items-center gap-2 border-t border-outline bg-surface p-3"><input value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void sendMessage()} disabled={!selectedCase || selectedCase.status === 'RESOLVED' || selectedCase.status === 'CLOSED'} placeholder={selectedCase?.status === 'RESOLVED' || selectedCase?.status === 'CLOSED' ? 'এই Case সমাধান হয়েছে' : 'মেসেজ লিখুন...'} className="min-w-0 flex-1 rounded-full border border-outline bg-bg px-4 py-2.5 text-sm outline-none focus:border-brand-500 disabled:opacity-60" /><button type="button" onClick={() => void sendMessage()} disabled={!message.trim() || saving || !selectedCase} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-500 text-white disabled:opacity-50" aria-label="মেসেজ পাঠান"><Send size={16} /></button></div></div></div>}
      {!hasCases && <div className="mt-5 flex items-center justify-center gap-2 text-xs text-ink-400"><ShieldCheck size={14} />আপনার Support Case নিরাপদে পরিচালিত হবে</div>}
    </div>
  </Layout>
}
