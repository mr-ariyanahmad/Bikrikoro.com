import { useState } from 'react'
import { auth } from '@/lib/firebase'
import type { WithdrawalMethod } from '@/types/wallet'
import { formatTaka } from '@/lib/format'

const METHODS: { value: WithdrawalMethod; label: string; placeholder: string }[] = [
  { value: 'BKASH', label: 'বিকাশ', placeholder: 'বিকাশ নম্বর (০১XXXXXXXXX)' },
  { value: 'NAGAD', label: 'নগদ', placeholder: 'নগদ নম্বর (০১XXXXXXXXX)' },
  { value: 'BANK', label: 'ব্যাংক', placeholder: 'ব্যাংকের নাম, শাখা, অ্যাকাউন্ট নম্বর' },
]

export function WithdrawModal({
  userId,
  availableBalance,
  onClose,
  onSuccess,
}: {
  userId: string
  availableBalance: number
  onClose: () => void
  onSuccess: () => void
}) {
  const [method, setMethod] = useState<WithdrawalMethod>('BKASH')
  const [amount, setAmount] = useState('')
  const [accountDetails, setAccountDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsedAmount = Number(amount)
  const accountIsValid = method === 'BANK' ? accountDetails.trim().length >= 10 : /^01\d{9}$/.test(accountDetails.replace(/\D/g, ''))
  const isValid = parsedAmount > 0 && parsedAmount <= availableBalance && accountIsValid

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)

    try {
      if (auth.currentUser?.uid !== userId) throw new Error('আপনার Firebase session পাওয়া যায়নি। আবার login করুন।')
      const idToken = await auth.currentUser.getIdToken()
      const response = await fetch('/api/wallet-withdrawal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ amount: parsedAmount, method, accountDetails: accountDetails.trim() }),
      })
      const result = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) {
        const rawError = result.error || `Withdrawal failed (HTTP ${response.status})`
        const normalized = rawError.toLowerCase()
        if (normalized.includes('after pending payouts') || normalized.includes('reserved') || normalized.includes('spendable')) throw new Error('আপনার wallet-এর কিছু অংশ আগের payout request-এ reserved আছে। উত্তোলনের পরিমাণ spendable balance-এর মধ্যে রাখুন।')
        if (normalized.includes('insufficient wallet balance') || normalized.includes('insufficient spendable')) throw new Error('এই পরিমাণ উত্তোলনের জন্য spendable balance যথেষ্ট নয়।')
        if (normalized.includes('wallet balance not found')) throw new Error('আপনার wallet এখনো প্রস্তুত হয়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।')
        throw new Error(rawError)
      }
      onSuccess()
    } catch (withdrawError) {
      console.error('Withdrawal request failed:', withdrawError)
      setError(withdrawError instanceof Error ? withdrawError.message : 'উত্তোলনের অনুরোধ পাঠানো যায়নি।')
    } finally {
      setSubmitting(false)
    }
  }

  const selected = METHODS.find((m) => m.value === method)!

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-surface p-6 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink-900">উত্তোলন করুন</h2>
          <button type="button" onClick={onClose} className="text-ink-300 hover:text-ink-600" aria-label="বন্ধ করুন">
            ✕
          </button>
        </div>
        <p className="mt-1 text-sm text-ink-600">
          উত্তোলনের জন্য উপলব্ধ: <span className="tabular-amount font-medium">{formatTaka(availableBalance)}</span>
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-900">মাধ্যম বেছে নিন</label>
            <div className="flex gap-2">
              {METHODS.map((m) => (
                <button
                  type="button"
                  key={m.value}
                  onClick={() => setMethod(m.value)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    method === m.value
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-outline text-ink-600 hover:border-brand-500/40'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-900">পরিমাণ (৳)</label>
            <input
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="যত টাকা উত্তোলন করতে চান"
              className="tabular-amount w-full rounded-lg border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
            {parsedAmount > availableBalance && (
              <p className="mt-1 text-xs text-error">উত্তোলনের জন্য উপলব্ধ amount-এর চেয়ে বেশি দেওয়া যাবে না।</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-900">{selected.label} তথ্য</label>
            <input
              type="text"
              value={accountDetails}
              onChange={(e) => setAccountDetails(e.target.value)}
              placeholder={selected.placeholder}
              className="w-full rounded-lg border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="w-full rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'পাঠানো হচ্ছে...' : 'অনুরোধ পাঠান'}
          </button>
          <p className="text-center text-xs text-ink-300">
            অনুরোধ পর্যালোচনার পর ১-৩ কার্যদিবসের মধ্যে টাকা পাঠানো হবে।
          </p>
        </div>
      </div>
    </div>
  )
}
