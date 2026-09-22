import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Building2, CheckCircle2, Smartphone } from 'lucide-react'
import { auth } from '@/lib/firebase'
import type { WithdrawalMethod } from '@/types/wallet'
import { formatTaka } from '@/lib/format'

const METHODS: { value: WithdrawalMethod; label: string; icon: typeof Smartphone }[] = [
  { value: 'BKASH', label: 'বিকাশ', icon: Smartphone },
  { value: 'NAGAD', label: 'নগদ', icon: Smartphone },
  { value: 'BANK', label: 'ব্যাংক অ্যাকাউন্ট', icon: Building2 },
]

export function WithdrawModal({ userId, availableBalance, onClose, onSuccess }: { userId: string; availableBalance: number; onClose: () => void; onSuccess: () => void }) {
  const [method, setMethod] = useState<WithdrawalMethod>('BKASH')
  const [amount, setAmount] = useState('')
  const [accountName, setAccountName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [bankName, setBankName] = useState('')
  const [branchName, setBranchName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow
    const previousDocumentOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousBodyOverflow; document.documentElement.style.overflow = previousDocumentOverflow }
  }, [])

  const parsedAmount = Number(amount)
  const normalizedNumber = accountNumber.replace(/\D/g, '')
  const accountIsValid = method === 'BANK'
    ? accountName.trim().length >= 2 && bankName.trim().length >= 2 && branchName.trim().length >= 2 && normalizedNumber.length >= 6
    : accountName.trim().length >= 2 && /^01\d{9}$/.test(normalizedNumber)
  const isValid = parsedAmount > 0 && parsedAmount <= availableBalance && accountIsValid
  const validationMessage = useMemo(() => {
    if (!amount) return 'প্রথমে কত টাকা তুলবেন তা লিখুন।'
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return 'সঠিক withdrawal amount লিখুন।'
    if (parsedAmount > availableBalance) return 'উপলব্ধ balance-এর বেশি withdrawal করা যাবে না।'
    if (method !== 'BANK' && !/^01\d{9}$/.test(normalizedNumber)) return 'সঠিক ১১ সংখ্যার বিকাশ/নগদ নম্বর দিন।'
    if (!accountName.trim()) return 'Account holder-এর নাম লিখুন।'
    if (method === 'BANK' && (!bankName.trim() || !branchName.trim() || normalizedNumber.length < 6)) return 'ব্যাংকের নাম, শাখা ও account number সম্পূর্ণ দিন।'
    return null
  }, [accountName, amount, availableBalance, bankName, branchName, method, normalizedNumber, parsedAmount])

  const handleSubmit = async () => {
    if (!isValid) { setError(validationMessage); return }
    setSubmitting(true); setError(null)
    try {
      if (auth.currentUser?.uid !== userId) throw new Error('আপনার Firebase session পাওয়া যায়নি। আবার login করুন।')
      const idToken = await auth.currentUser.getIdToken()
      const details = method === 'BANK'
        ? `Account holder: ${accountName.trim()} | Bank: ${bankName.trim()} | Branch: ${branchName.trim()} | Account number: ${normalizedNumber}`
        : `Account holder: ${accountName.trim()} | ${method} number: ${normalizedNumber}`
      const response = await fetch('/api/wallet-withdrawal', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }, body: JSON.stringify({ amount: parsedAmount, method, accountDetails: details }) })
      const result = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) {
        const rawError = result.error || `Withdrawal failed (HTTP ${response.status})`
        const normalized = rawError.toLowerCase()
        if (normalized.includes('reserved') || normalized.includes('spendable')) throw new Error('আপনার wallet-এর কিছু অংশ আগের payout request-এ reserved আছে।')
        if (normalized.includes('insufficient')) throw new Error('এই পরিমাণ withdrawal-এর জন্য spendable balance যথেষ্ট নয়।')
        throw new Error(rawError)
      }
      onSuccess()
    } catch (withdrawError) {
      console.error('Withdrawal request failed:', withdrawError)
      setError(withdrawError instanceof Error ? withdrawError.message : 'উত্তোলনের অনুরোধ পাঠানো যায়নি।')
    } finally { setSubmitting(false) }
  }

  return <div className="fixed inset-0 z-[80] overflow-y-auto bg-bg" role="dialog" aria-modal="true" aria-labelledby="withdraw-title">
    <main className="mx-auto min-h-full w-full max-w-2xl px-4 pb-10 pt-4 sm:px-6 sm:pt-8">
      <header className="flex items-center gap-3 border-b border-outline pb-4"><button type="button" onClick={onClose} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-outline bg-surface text-ink-700 hover:border-brand-500 hover:text-brand-700" aria-label="ফিরে যান"><ArrowLeft size={20} /></button><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">Seller wallet</p><h1 id="withdraw-title" className="text-xl font-extrabold text-ink-900 sm:text-2xl">টাকা উত্তোলন করুন</h1></div></header>
      <section className="mt-6 rounded-3xl border border-brand-100 bg-surface p-5 shadow-sm sm:p-7"><div className="rounded-2xl bg-brand-50 p-4"><p className="text-sm text-brand-800">উত্তোলনের জন্য উপলব্ধ</p><p className="mt-1 text-2xl font-extrabold text-brand-700">{formatTaka(availableBalance)}</p></div>
        <div className="mt-6"><p className="text-sm font-bold text-ink-900">কোন মাধ্যমে টাকা নেবেন?</p><div className="mt-3 grid gap-2 sm:grid-cols-3">{METHODS.map(({ value, label, icon: Icon }) => <button type="button" key={value} onClick={() => { setMethod(value); setError(null) }} className={`flex items-center gap-2 rounded-2xl border px-3 py-3 text-left text-sm font-bold transition ${method === value ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-sm' : 'border-outline bg-surface text-ink-700 hover:border-brand-300'}`}><Icon size={19} />{label}{method === value && <CheckCircle2 size={16} className="ml-auto" />}</button>)}</div></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-1.5 block text-sm font-bold text-ink-900">কত টাকা তুলবেন?</span><input type="number" min="1" max={availableBalance} inputMode="decimal" value={amount} onChange={(event) => { setAmount(event.target.value); setError(null) }} placeholder="যেমন ৫০০" className="tabular-amount w-full rounded-xl border border-outline bg-surface px-3 py-3 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10" /></label><label className="block"><span className="mb-1.5 block text-sm font-bold text-ink-900">Account holder-এর নাম</span><input value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder="যে নামে account" className="w-full rounded-xl border border-outline bg-surface px-3 py-3 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10" /></label></div>
        {method !== 'BANK' ? <label className="mt-4 block"><span className="mb-1.5 block text-sm font-bold text-ink-900">{method === 'BKASH' ? 'বিকাশ' : 'নগদ'} নম্বর</span><input value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} inputMode="numeric" maxLength={11} placeholder="01XXXXXXXXX" className="w-full rounded-xl border border-outline bg-surface px-3 py-3 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10" /></label> : <div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-1.5 block text-sm font-bold text-ink-900">ব্যাংকের নাম</span><input value={bankName} onChange={(event) => setBankName(event.target.value)} placeholder="যেমন Dutch-Bangla Bank" className="w-full rounded-xl border border-outline bg-surface px-3 py-3 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10" /></label><label className="block"><span className="mb-1.5 block text-sm font-bold text-ink-900">শাখার নাম</span><input value={branchName} onChange={(event) => setBranchName(event.target.value)} placeholder="শাখার নাম" className="w-full rounded-xl border border-outline bg-surface px-3 py-3 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10" /></label><label className="block sm:col-span-2"><span className="mb-1.5 block text-sm font-bold text-ink-900">ব্যাংক account number</span><input value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} inputMode="numeric" placeholder="Account number" className="w-full rounded-xl border border-outline bg-surface px-3 py-3 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10" /></label></div>}
        {error ? <p className="mt-4 rounded-xl border border-error/20 bg-error/5 p-3 text-sm font-medium text-error">{error}</p> : validationMessage && <p className="mt-4 text-xs text-ink-500">{validationMessage}</p>}
        <button type="button" onClick={() => void handleSubmit()} disabled={submitting} className="mt-6 w-full rounded-2xl bg-brand-500 py-3.5 text-base font-extrabold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-wait disabled:opacity-60">{submitting ? 'অনুরোধ পাঠানো হচ্ছে…' : 'Withdrawal request পাঠান'}</button><p className="mt-3 text-center text-xs leading-5 text-ink-500">তথ্য যাচাইয়ের পর সাধারণত ১–৩ কার্যদিবসের মধ্যে payment পাঠানো হবে।</p>
      </section>
    </main>
  </div>
}
