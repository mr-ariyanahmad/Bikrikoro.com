import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, RefreshCw, Trash2, WalletCards } from 'lucide-react'
import { AdminTableCard } from '@/components/admin/AdminShell'
import { useAuth } from '@/context/AuthContext'
import { adminRpc } from '@/lib/adminRpc'
import { formatDateTime } from '@/lib/format'

const providers = ['BKASH', 'NAGAD', 'ROCKET', 'UPAY'] as const
const purposes = ['SELLER_RECEIVE', 'BUYER_REFUND'] as const
const transactionTypes = ['CASH_IN', 'CASH_OUT', 'SEND_MONEY', 'PAYMENT'] as const
const accountTypes = ['PERSONAL', 'MERCHANT'] as const

type PaymentAccount = {
  id: string
  user_id: string
  user_name: string | null
  user_email: string | null
  provider: string
  purpose: string
  transaction_type: string
  account_type: string
  account_number: string
  account_holder_name: string | null
  merchant_name: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

type FormState = {
  id: string | null
  userId: string
  provider: typeof providers[number]
  purpose: typeof purposes[number]
  transactionType: typeof transactionTypes[number]
  accountType: typeof accountTypes[number]
  accountNumber: string
  accountHolderName: string
  merchantName: string
  isDefault: boolean
}

const emptyForm = (): FormState => ({ id: null, userId: '', provider: 'BKASH', purpose: 'SELLER_RECEIVE', transactionType: 'CASH_OUT', accountType: 'PERSONAL', accountNumber: '', accountHolderName: '', merchantName: '', isDefault: true })
const purposeLabel = (value: string) => value === 'SELLER_RECEIVE' ? 'সেলার পেমেন্ট' : 'কাস্টমার রিফান্ড'
const providerLabel = (value: string) => value === 'BKASH' ? 'bKash' : value === 'NAGAD' ? 'Nagad' : value === 'ROCKET' ? 'Rocket' : 'Upay'

export default function AdminPaymentAccounts() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState<PaymentAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [search, setSearch] = useState('')
  const [purposeFilter, setPurposeFilter] = useState('ALL')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user?.uid) return
    setLoading(true)
    const { data, error: loadError } = await adminRpc<PaymentAccount[]>('admin_list_payment_accounts', { p_admin_id: user.uid })
    if (loadError) setError(loadError.message)
    else setAccounts(data ?? [])
    setLoading(false)
  }, [user?.uid])

  useEffect(() => { void load() }, [load])

  const filtered = useMemo(() => accounts.filter((account) => {
    const query = search.trim().toLowerCase()
    const matchesSearch = !query || [account.user_id, account.user_name, account.user_email, account.account_number].some((value) => String(value ?? '').toLowerCase().includes(query))
    return matchesSearch && (purposeFilter === 'ALL' || account.purpose === purposeFilter)
  }), [accounts, purposeFilter, search])

  const edit = (account: PaymentAccount) => {
    setForm({ id: account.id, userId: account.user_id, provider: account.provider as FormState['provider'], purpose: account.purpose as FormState['purpose'], transactionType: account.transaction_type as FormState['transactionType'], accountType: account.account_type as FormState['accountType'], accountNumber: account.account_number, accountHolderName: account.account_holder_name ?? '', merchantName: account.merchant_name ?? '', isDefault: account.is_default })
    setFormOpen(true); setError(null)
  }

  const save = async () => {
    if (!user?.uid) return
    if (!form.userId.trim() || !/^01\d{9}$/.test(form.accountNumber.replace(/\s+/g, ''))) { setError('User UID এবং ১১ সংখ্যার সঠিক বাংলাদেশি mobile account number দিন।'); return }
    if (form.accountType === 'PERSONAL' && !form.accountHolderName.trim()) { setError('Personal account হলে account holder-এর নাম দিন।'); return }
    if (form.accountType === 'MERCHANT' && !form.merchantName.trim()) { setError('Merchant account হলে merchant name দিন।'); return }
    setSaving(true); setError(null)
    const { error: saveError } = await adminRpc('admin_upsert_payment_account', { p_admin_id: user.uid, p_account_id: form.id, p_user_id: form.userId.trim(), p_provider: form.provider, p_purpose: form.purpose, p_transaction_type: form.transactionType, p_account_type: form.accountType, p_account_number: form.accountNumber.replace(/\s+/g, ''), p_account_holder_name: form.accountHolderName.trim() || null, p_merchant_name: form.merchantName.trim() || null, p_is_default: form.isDefault })
    setSaving(false)
    if (saveError) setError(saveError.message)
    else { setFormOpen(false); setForm(emptyForm()); setNotice('Payment account admin panel থেকে সংরক্ষণ করা হয়েছে।'); await load() }
  }

  const remove = async (account: PaymentAccount) => {
    if (!user?.uid || !window.confirm(`${account.user_name || account.user_id}-এর ${purposeLabel(account.purpose)} account মুছে ফেলবেন?`)) return
    setError(null)
    const { error: deleteError } = await adminRpc('admin_delete_payment_account', { p_admin_id: user.uid, p_account_id: account.id })
    if (deleteError) setError(deleteError.message)
    else { setNotice('Payment account মুছে ফেলা হয়েছে।'); await load() }
  }

  return <AdminTableCard id="admin-payment-accounts" className="mt-5"><div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><WalletCards size={19} /></span><div><h2 className="font-semibold text-slate-900">Seller payout ও buyer refund account</h2><p className="mt-1 text-xs leading-5 text-slate-500">Admin এখান থেকে seller receive এবং buyer refund account attach, edit, default এবং remove করতে পারবেন। Account number কেবল admin workspace-এ দেখানো হয়।</p></div></div><div className="flex gap-2"><button type="button" onClick={() => { setForm(emptyForm()); setFormOpen(true); setError(null) }} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-xs font-bold text-white"><Plus size={15} />Account attach</button><button type="button" onClick={() => void load()} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"><RefreshCw size={14} />Refresh</button></div></div>
    {notice && <p className="mx-5 mt-4 rounded-lg bg-brand-50 p-3 text-sm text-brand-700">{notice}</p>}
    {error && <p className="mx-5 mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {formOpen && <div className="m-5 rounded-2xl border border-brand-200 bg-brand-50/50 p-4"><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold text-slate-900">{form.id ? 'Payment account edit' : 'নতুন account attach'}</h3><button type="button" onClick={() => setFormOpen(false)} className="text-xl text-slate-400">×</button></div><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4"><Field label="User UID"><input value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} placeholder="Firebase UID" /></Field><Field label="উদ্দেশ্য"><select value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value as FormState['purpose'] })}><option value="SELLER_RECEIVE">সেলার পেমেন্ট</option><option value="BUYER_REFUND">কাস্টমার রিফান্ড</option></select></Field><Field label="Provider"><select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value as FormState['provider'] })}>{providers.map((item) => <option key={item} value={item}>{providerLabel(item)}</option>)}</select></Field><Field label="Transaction type"><select value={form.transactionType} onChange={(e) => setForm({ ...form, transactionType: e.target.value as FormState['transactionType'] })}>{transactionTypes.map((item) => <option key={item} value={item}>{item}</option>)}</select></Field><Field label="Account type"><select value={form.accountType} onChange={(e) => setForm({ ...form, accountType: e.target.value as FormState['accountType'] })}><option value="PERSONAL">Personal</option><option value="MERCHANT">Merchant</option></select></Field><Field label="Mobile account number"><input value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value.replace(/[^0-9]/g, '').slice(0, 11) })} placeholder="01XXXXXXXXX" inputMode="numeric" /></Field>{form.accountType === 'PERSONAL' ? <Field label="Account holder name"><input value={form.accountHolderName} onChange={(e) => setForm({ ...form, accountHolderName: e.target.value })} /></Field> : <Field label="Merchant name"><input value={form.merchantName} onChange={(e) => setForm({ ...form, merchantName: e.target.value })} /></Field>}<label className="flex items-center gap-2 self-end pb-2 text-xs font-semibold text-slate-700"><input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />এই purpose-এর default account</label></div><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setFormOpen(false)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600">বাতিল</button><button type="button" onClick={() => void save()} disabled={saving} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? 'সংরক্ষণ হচ্ছে…' : 'সংরক্ষণ করুন'}</button></div></div>}
    <div className="grid gap-3 border-b border-slate-100 bg-slate-50 p-4 sm:grid-cols-[1fr_220px]"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="নাম, email, UID বা account number দিয়ে খুঁজুন" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500" /><select value={purposeFilter} onChange={(e) => setPurposeFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"><option value="ALL">সব account</option><option value="SELLER_RECEIVE">সেলার payout</option><option value="BUYER_REFUND">কাস্টমার refund</option></select></div>
    {loading ? <p className="p-8 text-center text-sm text-slate-500">Payment account লোড হচ্ছে…</p> : filtered.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">কোনো payment account পাওয়া যায়নি।</p> : <div className="divide-y divide-slate-100">{filtered.map((account) => <div key={account.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-800">{account.user_name || 'নাম নেই'}</p><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{purposeLabel(account.purpose)}</span>{account.is_default && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">Default</span>}</div><p className="mt-1 text-xs text-slate-500">{account.user_email || account.user_id} · {providerLabel(account.provider)} · {account.account_type}</p><p className="mt-1 font-mono text-sm text-slate-800">{account.account_number} <span className="font-sans text-xs text-slate-400">· {account.account_holder_name || account.merchant_name || 'নাম নেই'}</span></p><p className="mt-1 text-[11px] text-slate-400">শেষ আপডেট: {formatDateTime(account.updated_at)}</p></div><div className="flex gap-2"><button type="button" onClick={() => edit(account)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"><Pencil size={14} />Edit</button><button type="button" onClick={() => void remove(account)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600"><Trash2 size={14} />Remove</button></div></div>)}</div>}
  </AdminTableCard>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-xs font-semibold text-slate-600">{label}<span className="mt-1 block">{children}</span></label> }
