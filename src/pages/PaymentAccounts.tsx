import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Check, CreditCard, Pencil, Plus, ShieldCheck, Trash2, WalletCards } from 'lucide-react'
import { Helmet } from 'react-helmet-async'
import { useSearchParams } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { useAuth } from '@/context/AuthContext'
import { deletePaymentAccount, listPaymentAccounts, savePaymentAccount, setDefaultPaymentAccount, type PaymentAccount, type PaymentAccountInput, type PaymentAccountType, type PaymentProvider, type PaymentPurpose, type PaymentTransactionType } from '@/lib/paymentAccounts'

type PurposeTab = { value: PaymentPurpose; label: string; shortLabel: string; description: string; action: string }
type ProviderTheme = { value: PaymentProvider; label: string; subtitle: string; logo: string; color: string; soft: string; border: string; text: string }

const PURPOSES: PurposeTab[] = [
  { value: 'SELLER_RECEIVE', label: 'সেলার পেমেন্ট', shortLabel: 'টাকা গ্রহণ', description: 'বিক্রিত পণ্যের টাকা যে অ্যাকাউন্টে পাবেন', action: 'টাকা রিসিভ' },
  { value: 'BUYER_REFUND', label: 'রিফান্ড অ্যাকাউন্ট', shortLabel: 'রিফান্ড গ্রহণ', description: 'অর্ডার বাতিল বা রিফান্ড হলে যে অ্যাকাউন্টে টাকা পাবেন', action: 'রিফান্ড পাবেন' },
]
const PROVIDERS: ProviderTheme[] = [
  { value: 'BKASH', label: 'bKash', subtitle: 'মোবাইল ব্যাংকিং', logo: '/payment-logos/bkash.png', color: '#e2136e', soft: '#fff0f7', border: '#e2136e', text: '#a80d51' },
  { value: 'NAGAD', label: 'Nagad', subtitle: 'মোবাইল ব্যাংকিং', logo: '/payment-logos/nagad.png', color: '#f15a24', soft: '#fff3ed', border: '#f15a24', text: '#b43b14' },
  { value: 'ROCKET', label: 'Rocket', subtitle: 'মোবাইল ব্যাংকিং', logo: '/payment-logos/rocket.png', color: '#7b2b83', soft: '#f7eff8', border: '#7b2b83', text: '#5e2165' },
  { value: 'UPAY', label: 'Upay', subtitle: 'মোবাইল ব্যাংকিং', logo: '/payment-logos/upay.png', color: '#2b9ed8', soft: '#edf9fe', border: '#2b9ed8', text: '#17719d' },
]
const TRANSACTION_TYPES: Array<{ value: PaymentTransactionType; label: string; description: string }> = [
  { value: 'CASH_OUT', label: 'Cash Out', description: 'এই account-এ টাকা পাঠানো হবে' },
  { value: 'CASH_IN', label: 'Cash In', description: 'এই account থেকে টাকা নেওয়া হবে' },
  { value: 'SEND_MONEY', label: 'Send Money', description: 'এই account-এ send money করা হবে' },
  { value: 'PAYMENT', label: 'Payment', description: 'এই account-এ payment করা হবে' },
]

export default function PaymentAccounts() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const [purpose, setPurpose] = useState<PaymentPurpose>(searchParams.get('purpose') === 'BUYER_REFUND' ? 'BUYER_REFUND' : 'SELLER_RECEIVE')
  const [accounts, setAccounts] = useState<PaymentAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(searchParams.get('required') ? 'অর্ডার বা লিস্টিং চালু রাখতে আগে একটি default payment account যোগ করুন।' : null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<PaymentAccount | null>(null)
  const [provider, setProvider] = useState<PaymentProvider>('BKASH')
  const [transactionType, setTransactionType] = useState<PaymentTransactionType>('CASH_OUT')
  const [accountType, setAccountType] = useState<PaymentAccountType>('PERSONAL')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountHolderName, setAccountHolderName] = useState('')
  const [merchantName, setMerchantName] = useState('')
  const [isDefault, setIsDefault] = useState(true)

  const tab = useMemo(() => PURPOSES.find((item) => item.value === purpose) ?? PURPOSES[0], [purpose])
  const currentAccounts = accounts.filter((account) => account.purpose === purpose)
  const selectedProvider = PROVIDERS.find((item) => item.value === provider) ?? PROVIDERS[0]

  const loadAccounts = useCallback(async () => {
    if (!user) return
    setLoading(true); setError(null)
    try { setAccounts(await listPaymentAccounts()) } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'অ্যাকাউন্ট লোড করা যায়নি।') } finally { setLoading(false) }
  }, [user])
  useEffect(() => { void loadAccounts() }, [loadAccounts])

  const resetForm = () => {
    setEditing(null); setProvider('BKASH'); setTransactionType('CASH_OUT'); setAccountType('PERSONAL'); setAccountNumber(''); setAccountHolderName(''); setMerchantName(''); setIsDefault(currentAccounts.length === 0); setError(null)
  }
  const openCreate = () => { resetForm(); setShowForm(true) }
  const openEdit = (account: PaymentAccount) => {
    setEditing(account); setProvider(account.provider); setTransactionType(account.transaction_type); setAccountType(account.account_type); setAccountNumber(''); setAccountHolderName(account.account_holder_name ?? ''); setMerchantName(account.merchant_name ?? ''); setIsDefault(account.is_default); setError(null); setShowForm(true)
  }
  const closeForm = () => { setShowForm(false); resetForm() }
  const handleSave = async () => {
    setSaving(true); setError(null)
    try {
      const input: PaymentAccountInput = { id: editing?.id, provider, purpose, transactionType, accountType, accountNumber, accountHolderName, merchantName, isDefault }
      await savePaymentAccount(input)
      setNotice(editing ? 'Payment account আপডেট হয়েছে।' : 'Payment account যোগ হয়েছে।')
      closeForm(); await loadAccounts()
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'অ্যাকাউন্ট সেভ করা যায়নি।') } finally { setSaving(false) }
  }
  const handleDelete = async (account: PaymentAccount) => {
    if (!window.confirm('এই payment account মুছে ফেলবেন?')) return
    try { await deletePaymentAccount(account.id); setNotice('Payment account মুছে ফেলা হয়েছে।'); await loadAccounts() } catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : 'অ্যাকাউন্ট মুছে ফেলা যায়নি।') }
  }
  const handleDefault = async (account: PaymentAccount) => {
    try { await setDefaultPaymentAccount(account.id); setNotice('Default payment account পরিবর্তন হয়েছে।'); await loadAccounts() } catch (defaultError) { setError(defaultError instanceof Error ? defaultError.message : 'Default account পরিবর্তন করা যায়নি।') }
  }
  const choosePurpose = (next: PaymentPurpose) => { setPurpose(next); setShowForm(false); setError(null) }

  if (showForm) return <Layout fullScreen fullWidth hideMobileHeader hideFooter hideMobileQuickNav>
    <Helmet><title>{editing ? 'Payment account আপডেট' : 'Payment account যোগ করুন'} | BikriKoro.Com</title></Helmet>
    <div className="flex min-h-0 flex-1 flex-col" style={{ '--provider-color': selectedProvider.color, '--provider-soft': selectedProvider.soft, '--provider-border': selectedProvider.border, backgroundColor: '#f7f8fc' } as CSSProperties}>
      <header className="shrink-0 px-4 py-4 text-white shadow-sm sm:px-6" style={{ backgroundColor: selectedProvider.color }}><div className="mx-auto flex w-full max-w-3xl items-center gap-3"><button type="button" onClick={closeForm} aria-label="ফিরে যান" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/15 text-2xl leading-none hover:bg-white/25">←</button><div className="min-w-0 flex-1 text-center"><p className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-80">{tab.label}</p><h1 className="truncate text-xl font-bold">{editing ? 'Payment account আপডেট' : 'পেমেন্ট পদ্ধতি যোগ করুন'}</h1></div><img src={selectedProvider.logo} alt={selectedProvider.label} className="h-10 w-10 shrink-0 rounded-xl bg-white object-contain p-1.5" /></div></header>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-6">
        <section className="mx-auto w-full max-w-3xl rounded-[1.25rem] border-2 bg-surface shadow-sm" style={{ borderColor: selectedProvider.border }}>
          <div className="space-y-4 p-4 sm:p-6">
          <div><h2 className="text-lg font-bold text-ink-900">পেমেন্ট মেথড সিলেক্ট করুন</h2><div className="mt-3 grid grid-cols-2 gap-2.5">{PROVIDERS.map((item) => <button key={item.value} type="button" onClick={() => { setProvider(item.value); setError(null) }} className="flex min-h-[72px] items-center gap-2 rounded-xl border-2 px-3 py-2 text-left transition active:scale-[0.98]" style={provider === item.value ? { borderColor: item.border, backgroundColor: item.soft, color: item.text } : { borderColor: '#d9e5e1', backgroundColor: '#fff' }}><img src={item.logo} alt="" className="h-10 w-10 shrink-0 rounded-lg bg-white object-contain p-1" /><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-ink-900">{item.label}</span><span className="mt-0.5 block text-[11px] text-ink-500">{item.subtitle}</span></span>{provider === item.value && <Check size={17} style={{ color: item.color }} />}</button>)}</div></div>
          <label className="block text-sm font-bold text-ink-900">অ্যাকাউন্টের ব্যবহার<select value={transactionType} onChange={(event) => setTransactionType(event.target.value as PaymentTransactionType)} className="mt-1.5 w-full appearance-none rounded-xl border-2 bg-surface px-3 py-3 text-base font-normal outline-none" style={{ borderColor: selectedProvider.border, color: selectedProvider.text, backgroundColor: selectedProvider.soft }}>{TRANSACTION_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="block text-sm font-bold text-ink-900">অ্যাকাউন্টের ধরন<select value={accountType} onChange={(event) => setAccountType(event.target.value as PaymentAccountType)} className="mt-1.5 w-full appearance-none rounded-xl border-2 bg-surface px-3 py-3 text-base font-normal outline-none" style={{ borderColor: selectedProvider.border, color: selectedProvider.text, backgroundColor: selectedProvider.soft }}><option value="PERSONAL">Personal account</option><option value="MERCHANT">Merchant account</option></select></label>
          <label className="block text-sm font-bold text-ink-900">মোবাইল নাম্বার<input value={accountNumber} onChange={(event) => setAccountNumber(event.target.value.replace(/[^0-9\s]/g, ''))} inputMode="numeric" autoComplete="tel" placeholder="01XXXXXXXXX" className="mt-1.5 w-full rounded-xl border-2 bg-surface px-3 py-3 text-base font-normal outline-none" style={{ borderColor: selectedProvider.border }} />{editing && <span className="mt-1 block text-xs font-normal text-ink-500">নিরাপত্তার জন্য পুরো নম্বরটি আবার লিখুন।</span>}</label>
          {accountType === 'PERSONAL' ? <label className="block text-sm font-bold text-ink-900">Account holder-এর নাম<input value={accountHolderName} onChange={(event) => setAccountHolderName(event.target.value)} placeholder="যে নামে account খোলা" className="mt-1.5 w-full rounded-xl border-2 bg-surface px-3 py-3 text-base font-normal outline-none" style={{ borderColor: selectedProvider.border }} /></label> : <label className="block text-sm font-bold text-ink-900">Merchant name<input value={merchantName} onChange={(event) => setMerchantName(event.target.value)} placeholder="ব্যবসার নাম" className="mt-1.5 w-full rounded-xl border-2 bg-surface px-3 py-3 text-base font-normal outline-none" style={{ borderColor: selectedProvider.border }} /></label>}
          <label className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold" style={{ backgroundColor: selectedProvider.soft, color: selectedProvider.text }}><input type="checkbox" checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} className="h-5 w-5" style={{ accentColor: selectedProvider.color }} />এই purpose-এর default account রাখুন</label>
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button type="button" onClick={() => void handleSave()} disabled={saving} className="w-full rounded-xl py-3.5 text-base font-bold text-white shadow-sm transition active:scale-[0.99] hover:brightness-95 disabled:opacity-50" style={{ backgroundColor: selectedProvider.color }}>{saving ? 'সংরক্ষণ হচ্ছে…' : editing ? 'Payment account আপডেট করুন' : 'পেমেন্ট account যোগ করুন'}</button>
          </div>
        </section>
      </div>
    </div>
  </Layout>

  return <Layout wide>
    <Helmet><title>পেমেন্ট অ্যাকাউন্ট | BikriKoro.Com</title></Helmet>
    <div className="mx-auto w-full max-w-4xl pb-24">
      <div className="rounded-[1.6rem] bg-[#075985] px-5 py-6 text-white shadow-lg sm:px-8 sm:py-8"><div className="flex items-start gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/15"><WalletCards size={26} /></span><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-100">BikriKoro secure setup</p><h1 className="mt-1 text-2xl font-bold sm:text-3xl">পেমেন্ট অ্যাকাউন্ট</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-sky-100">টাকা গ্রহণ ও রিফান্ডের জন্য আপনার mobile wallet address সংরক্ষণ করুন।</p></div></div></div>
      {notice && <div className="mt-4 flex items-start gap-2 rounded-2xl border border-pink-200 bg-pink-50 p-4 text-sm font-medium text-pink-900"><ShieldCheck size={18} className="mt-0.5 shrink-0 text-pink-600" /><span>{notice}</span><button type="button" onClick={() => setNotice(null)} className="ml-auto text-pink-500" aria-label="বন্ধ করুন">×</button></div>}
      {error && <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">{PURPOSES.map((item) => <button key={item.value} type="button" onClick={() => choosePurpose(item.value)} className={`rounded-2xl border p-4 text-left transition ${purpose === item.value ? 'border-brand-500 bg-brand-50 shadow-sm' : 'border-outline bg-surface hover:border-brand-300'}`}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-brand-700">{item.shortLabel}</p><h2 className="mt-1 text-lg font-bold text-ink-900">{item.label}</h2><p className="mt-1 text-sm leading-5 text-ink-600">{item.description}</p></div><span className={`grid h-8 w-8 place-items-center rounded-full ${purpose === item.value ? 'bg-brand-500 text-white' : 'bg-bg text-ink-400'}`}>{purpose === item.value ? <Check size={17} /> : <CreditCard size={17} />}</span></div></button>)}</div>
      <section className="mt-6 rounded-[1.5rem] border border-outline bg-surface p-4 shadow-sm sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">{tab.label}</p><h2 className="mt-1 text-xl font-bold text-ink-900">আপনার account</h2><p className="mt-1 text-sm text-ink-500">{tab.action} করার জন্য default account নির্বাচন করুন।</p></div>{currentAccounts.length > 0 && <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-600"><Plus size={17} />অ্যাকাউন্ট যোগ করুন</button>}</div>
        {loading ? <div className="mt-5 grid grid-cols-2 gap-3"><div className="h-24 animate-pulse rounded-2xl bg-bg" /><div className="h-24 animate-pulse rounded-2xl bg-bg" /></div> : currentAccounts.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-brand-300 bg-brand-50/60 p-6 text-center"><WalletCards className="mx-auto text-brand-500" size={30} /><p className="mt-3 font-bold text-ink-900">এখনো কোনো {tab.label.toLowerCase()} যোগ করা হয়নি</p><p className="mt-1 text-sm text-ink-600">নিচের একটিমাত্র button দিয়ে ধাপে ধাপে account যোগ করুন।</p><button type="button" onClick={openCreate} className="mt-4 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white">অ্যাকাউন্ট যোগ করুন</button></div> : <div className="mt-5 grid gap-3 sm:grid-cols-2">{currentAccounts.map((account) => { const providerInfo = PROVIDERS.find((item) => item.value === account.provider)!; return <article key={account.id} className="relative rounded-2xl border-2 p-4 transition" style={account.is_default ? { borderColor: providerInfo.border, backgroundColor: providerInfo.soft } : undefined}><div className="flex items-start gap-3"><img src={providerInfo.logo} alt={providerInfo.label} className="h-12 w-12 rounded-xl bg-white object-contain p-1 shadow-sm" /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><h3 className="font-bold text-ink-900">{providerInfo.label}</h3><p className="mt-0.5 text-xs text-ink-500">{account.account_type === 'MERCHANT' ? account.merchant_name : account.account_holder_name} · {account.transaction_type.replace('_', ' ')}</p></div>{account.is_default && <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold shadow-sm" style={{ color: providerInfo.text }}>Default</span>}</div><p className="mt-2 text-base font-bold tracking-wide text-ink-800">{account.account_number}</p></div></div><div className="mt-4 flex flex-wrap gap-2 border-t border-black/5 pt-3"><button type="button" onClick={() => openEdit(account)} className="inline-flex items-center gap-1.5 rounded-lg border border-outline px-3 py-2 text-xs font-bold text-ink-700 hover:border-brand-500 hover:text-brand-700"><Pencil size={13} />এডিট</button>{!account.is_default && <button type="button" onClick={() => void handleDefault(account)} className="inline-flex items-center gap-1.5 rounded-lg border border-brand-300 px-3 py-2 text-xs font-bold text-brand-700 hover:bg-brand-50">Default করুন</button>}<button type="button" onClick={() => void handleDelete(account)} className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"><Trash2 size={13} />মুছুন</button></div></article> })}</div>}
      </section>
      <section className="mt-4 flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-900"><ShieldCheck size={20} className="mt-0.5 shrink-0 text-sky-600" /><p><strong>নিরাপত্তা নোট:</strong> এই account শুধু selected purpose-এর জন্য ব্যবহার হবে। পরে default বদলালেও পুরনো order-এর account snapshot বদলাবে না।</p></section>
    </div>
  </Layout>
}
