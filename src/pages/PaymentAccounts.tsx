import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { ArrowLeft, Check, ChevronRight, CreditCard, Pencil, Plus, ShieldCheck, Trash2, WalletCards } from 'lucide-react'
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
  const [formStep, setFormStep] = useState(1)
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
    setEditing(null); setFormStep(1); setProvider('BKASH'); setTransactionType('CASH_OUT'); setAccountType('PERSONAL'); setAccountNumber(''); setAccountHolderName(''); setMerchantName(''); setIsDefault(currentAccounts.length === 0); setError(null)
  }
  const openCreate = () => { resetForm(); setShowForm(true) }
  const openEdit = (account: PaymentAccount) => {
    setEditing(account); setFormStep(1); setProvider(account.provider); setTransactionType(account.transaction_type); setAccountType(account.account_type); setAccountNumber(''); setAccountHolderName(account.account_holder_name ?? ''); setMerchantName(account.merchant_name ?? ''); setIsDefault(account.is_default); setError(null); setShowForm(true)
  }
  const closeForm = () => { setShowForm(false); resetForm() }
  const nextStep = () => { setError(null); setFormStep((step) => Math.min(5, step + 1)) }
  const previousStep = () => { setError(null); setFormStep((step) => Math.max(1, step - 1)) }
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

  if (showForm) return <Layout wide>
    <Helmet><title>{editing ? 'Payment account আপডেট' : 'Payment account যোগ করুন'} | BikriKoro.Com</title></Helmet>
    <div className="mx-auto w-full max-w-3xl pb-16" style={{ '--provider-color': selectedProvider.color, '--provider-soft': selectedProvider.soft, '--provider-border': selectedProvider.border } as CSSProperties}>
      <button type="button" onClick={closeForm} className="mb-4 inline-flex items-center gap-2 rounded-xl px-1 py-2 text-sm font-bold text-ink-600 hover:text-ink-900"><ArrowLeft size={17} />Payment accounts-এ ফিরে যান</button>
      <div className="overflow-hidden rounded-[1.6rem] border-2 bg-surface shadow-sm" style={{ borderColor: selectedProvider.border }}>
        <header className="px-5 py-6 text-white sm:px-8 sm:py-8" style={{ backgroundColor: selectedProvider.color }}><div className="flex items-center gap-4"><img src={selectedProvider.logo} alt={selectedProvider.label} className="h-14 w-14 rounded-2xl bg-white object-contain p-2 shadow-sm" /><div><p className="text-xs font-bold uppercase tracking-[0.16em] opacity-80">{tab.label}</p><h1 className="mt-1 text-2xl font-bold">{editing ? 'Payment account আপডেট করুন' : 'Payment account যোগ করুন'}</h1><p className="mt-1 text-sm opacity-90">ধাপে ধাপে account-এর তথ্য দিন</p></div></div></header>
        <div className="grid grid-cols-4 border-b border-outline bg-surface">{['Wallet', 'ব্যবহার', 'ধরন', 'তথ্য'].map((label, index) => <div key={label} className={`relative px-2 py-3 text-center text-xs font-bold ${formStep >= index + 1 ? 'text-[var(--provider-color)]' : 'text-ink-400'}`}><span className={`mx-auto grid h-7 w-7 place-items-center rounded-full text-xs ${formStep >= index + 1 ? 'text-white' : 'bg-bg text-ink-400'}`} style={formStep >= index + 1 ? { backgroundColor: selectedProvider.color } : undefined}>{formStep > index + 1 ? <Check size={14} /> : index + 1}</span><span className="mt-1 block">{label}</span></div>)}</div>
        <div className="p-5 sm:p-8">
          {formStep === 1 && <section><p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: selectedProvider.color }}>ধাপ ১</p><h2 className="mt-1 text-2xl font-bold text-ink-900">কোন wallet ব্যবহার করবেন?</h2><p className="mt-2 text-sm leading-6 text-ink-600">একটি wallet সিলেক্ট করলে তার color ও পরের ধাপগুলো এখানে খুলবে।</p><div className="mt-6 grid gap-3 sm:grid-cols-2">{PROVIDERS.map((item) => <button key={item.value} type="button" onClick={() => { setProvider(item.value); setFormStep(2); setError(null) }} className="flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition hover:-translate-y-0.5" style={provider === item.value ? { borderColor: item.border, backgroundColor: item.soft, color: item.text } : undefined}><img src={item.logo} alt="" className="h-12 w-12 rounded-xl bg-white object-contain p-1 shadow-sm" /><span className="flex-1"><span className="block text-base font-bold text-ink-900">{item.label}</span><span className="mt-1 block text-xs text-ink-500">{item.subtitle}</span></span>{provider === item.value && <Check size={20} style={{ color: item.color }} />}</button>)}</div></section>}
          {formStep === 2 && <section><p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: selectedProvider.color }}>ধাপ ২</p><h2 className="mt-1 text-2xl font-bold text-ink-900">অ্যাকাউন্টটি কীভাবে ব্যবহার হবে?</h2><p className="mt-2 text-sm leading-6 text-ink-600">একটি অপশন বেছে নিন। তারপর account-এর ধরন দেওয়ার ধাপ খুলবে।</p><div className="mt-6 space-y-3">{TRANSACTION_TYPES.map((item) => <button key={item.value} type="button" onClick={() => { setTransactionType(item.value); setFormStep(3); setError(null) }} className="flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition hover:-translate-y-0.5" style={transactionType === item.value ? { borderColor: selectedProvider.border, backgroundColor: selectedProvider.soft } : undefined}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white" style={{ backgroundColor: selectedProvider.color }}><CreditCard size={19} /></span><span className="flex-1"><span className="block font-bold text-ink-900">{item.label}</span><span className="mt-1 block text-sm text-ink-500">{item.description}</span></span><ChevronRight size={18} className="text-ink-400" /></button>)}</div></section>}
          {formStep === 3 && <section><p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: selectedProvider.color }}>ধাপ ৩</p><h2 className="mt-1 text-2xl font-bold text-ink-900">অ্যাকাউন্টের ধরন বেছে নিন</h2><p className="mt-2 text-sm leading-6 text-ink-600">Personal হলে account holder-এর নাম, Merchant হলে merchant name দিতে হবে।</p><div className="mt-6 grid gap-3 sm:grid-cols-2">{(['PERSONAL', 'MERCHANT'] as PaymentAccountType[]).map((item) => <button key={item} type="button" onClick={() => { setAccountType(item); setFormStep(4); setError(null) }} className="rounded-2xl border-2 p-5 text-left transition hover:-translate-y-0.5" style={accountType === item ? { borderColor: selectedProvider.border, backgroundColor: selectedProvider.soft } : undefined}><p className="text-lg font-bold text-ink-900">{item === 'PERSONAL' ? 'Personal account' : 'Merchant account'}</p><p className="mt-2 text-sm leading-6 text-ink-600">{item === 'PERSONAL' ? 'আপনার নিজের নামে খোলা mobile wallet' : 'ব্যবসা বা shop-এর নামে খোলা mobile wallet'}</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-bold" style={{ color: selectedProvider.color }}>বেছে নিন <ChevronRight size={15} /></span></button>)}</div></section>}
          {formStep === 4 && <section><p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: selectedProvider.color }}>ধাপ ৪</p><h2 className="mt-1 text-2xl font-bold text-ink-900">অ্যাকাউন্টের তথ্য দিন</h2><p className="mt-2 text-sm leading-6 text-ink-600">{selectedProvider.label} · {TRANSACTION_TYPES.find((item) => item.value === transactionType)?.label} · {accountType === 'PERSONAL' ? 'Personal' : 'Merchant'}</p><div className="mt-6 space-y-4"><label className="block text-sm font-semibold text-ink-900">মোবাইল নাম্বার<input value={accountNumber} onChange={(event) => setAccountNumber(event.target.value.replace(/[^0-9\s]/g, ''))} inputMode="numeric" autoComplete="tel" placeholder="01XXXXXXXXX" className="mt-1.5 w-full rounded-xl border border-outline bg-surface px-3 py-3 text-base font-normal outline-none focus:border-[var(--provider-color)]" />{editing && <span className="mt-1 block text-xs font-normal text-ink-500">নিরাপত্তার জন্য পুরো নম্বরটি আবার লিখুন।</span>}</label>{accountType === 'PERSONAL' ? <label className="block text-sm font-semibold text-ink-900">Account holder-এর নাম<input value={accountHolderName} onChange={(event) => setAccountHolderName(event.target.value)} placeholder="যে নামে account খোলা" className="mt-1.5 w-full rounded-xl border border-outline bg-surface px-3 py-3 text-base font-normal outline-none focus:border-[var(--provider-color)]" /></label> : <label className="block text-sm font-semibold text-ink-900">Merchant name<input value={merchantName} onChange={(event) => setMerchantName(event.target.value)} placeholder="ব্যবসার নাম" className="mt-1.5 w-full rounded-xl border border-outline bg-surface px-3 py-3 text-base font-normal outline-none focus:border-[var(--provider-color)]" /></label>}<label className="flex items-center gap-3 rounded-xl p-3 text-sm font-semibold" style={{ backgroundColor: selectedProvider.soft, color: selectedProvider.text }}><input type="checkbox" checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} className="h-4 w-4" style={{ accentColor: selectedProvider.color }} />এই purpose-এর default account রাখুন</label><button type="button" onClick={nextStep} className="w-full rounded-xl py-3.5 text-base font-bold text-white transition hover:brightness-95" style={{ backgroundColor: selectedProvider.color }}>তথ্য যাচাই করুন <ChevronRight className="ml-1 inline" size={17} /></button></div></section>}
          {formStep === 5 && <section><p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: selectedProvider.color }}>শেষ ধাপ</p><h2 className="mt-1 text-2xl font-bold text-ink-900">তথ্য নিশ্চিত করুন</h2><div className="mt-6 rounded-2xl p-5" style={{ backgroundColor: selectedProvider.soft, color: selectedProvider.text }}><div className="flex items-center gap-3"><img src={selectedProvider.logo} alt="" className="h-12 w-12 rounded-xl bg-white object-contain p-1" /><div><p className="font-bold">{selectedProvider.label}</p><p className="text-sm">{accountNumber || 'নম্বর দেওয়া হয়নি'}</p></div></div><dl className="mt-5 space-y-2 text-sm"><div className="flex justify-between gap-3"><dt>ব্যবহার</dt><dd className="font-bold">{TRANSACTION_TYPES.find((item) => item.value === transactionType)?.label}</dd></div><div className="flex justify-between gap-3"><dt>ধরন</dt><dd className="font-bold">{accountType === 'PERSONAL' ? accountHolderName || 'নাম দেওয়া হয়নি' : merchantName || 'নাম দেওয়া হয়নি'}</dd></div><div className="flex justify-between gap-3"><dt>Default</dt><dd className="font-bold">{isDefault ? 'হ্যাঁ' : 'না'}</dd></div></dl></div><div className="mt-5 flex items-start gap-3 rounded-xl border border-outline bg-bg p-4 text-sm leading-6 text-ink-600"><ShieldCheck size={19} className="mt-0.5 shrink-0" />এই account শুধু {tab.label.toLowerCase()}-এর জন্য ব্যবহার হবে।</div>{error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<button type="button" onClick={() => void handleSave()} disabled={saving} className="mt-5 w-full rounded-xl py-3.5 text-base font-bold text-white transition hover:brightness-95 disabled:opacity-50" style={{ backgroundColor: selectedProvider.color }}>{saving ? 'সংরক্ষণ হচ্ছে…' : editing ? 'Payment account আপডেট করুন' : 'Payment account সংরক্ষণ করুন'}</button></section>}
          {formStep > 1 && <div className="mt-8 flex justify-between gap-3 border-t border-outline pt-5"><button type="button" onClick={previousStep} className="inline-flex items-center gap-2 rounded-xl border border-outline px-4 py-2.5 text-sm font-bold text-ink-700 hover:bg-bg"><ArrowLeft size={16} />আগের ধাপ</button>{formStep < 4 && <button type="button" onClick={closeForm} className="rounded-xl px-4 py-2.5 text-sm font-bold text-ink-500 hover:bg-bg">বাতিল</button>}</div>}
        </div>
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
