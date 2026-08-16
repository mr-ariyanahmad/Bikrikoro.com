import { useState } from 'react'
import { supabase } from '@/lib/supabase'
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
  const isValid =
    parsedAmount > 0 && parsedAmount <= availableBalance && accountDetails.trim().length >= 6

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)

    const { error: rpcError } = await supabase.rpc('request_wallet_withdrawal', {
      p_user_id: userId,
      p_amount: parsedAmount,
      p_method: method,
      p_account_details: accountDetails.trim(),
    })

    setSubmitting(false)
    if (rpcError) {
      setError('অনুরোধ পাঠানো যায়নি — আবার চেষ্টা করুন।')
      return
    }
    onSuccess()
  }

  const selected = METHODS.find((m) => m.value === method)!

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-surface p-6 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink-900">উত্তোলন করুন</h2>
          <button onClick={onClose} className="text-ink-300 hover:text-ink-600" aria-label="বন্ধ করুন">
            ✕
          </button>
        </div>
        <p className="mt-1 text-sm text-ink-600">
          উপলব্ধ ব্যালেন্স: <span className="tabular-amount font-medium">{formatTaka(availableBalance)}</span>
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-900">মাধ্যম বেছে নিন</label>
            <div className="flex gap-2">
              {METHODS.map((m) => (
                <button
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
              <p className="mt-1 text-xs text-error">ব্যালেন্সের চেয়ে বেশি পরিমাণ দেওয়া যাবে না।</p>
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
