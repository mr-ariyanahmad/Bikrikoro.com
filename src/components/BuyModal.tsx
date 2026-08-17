import { useState } from 'react'
import { createPendingOrder, startUddoktaPayCheckout, cancelPendingOrder } from '@/lib/payments'
import type { Product } from '@/types/product'
import { formatTaka } from '@/lib/format'

export function BuyModal({
  product,
  buyerId,
  onClose,
}: {
  product: Product
  buyerId: string
  onClose: () => void
}) {
  const [address, setAddress] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const escrowFee = Math.max(product.price * 0.01, 10)
  const total = product.price + escrowFee

  const handleSubmit = async () => {
    if (!product.is_digital && address.trim().length < 8) {
      setError('ডেলিভারি ঠিকানা লিখুন (কমপক্ষে ৮ অক্ষর)')
      return
    }
    setSubmitting(true)
    setError(null)

    let orderId: string | null = null
    try {
      orderId = await createPendingOrder({
        productId: product.id,
        buyerId,
        deliveryAddress: product.is_digital ? 'ডিজিটাল পণ্য — কোনো শিপিং ঠিকানা প্রযোজ্য নয়' : address.trim(),
      })
      const paymentUrl = await startUddoktaPayCheckout(orderId)
      window.location.href = paymentUrl // hand off to UddoktaPay's hosted checkout page
    } catch (err) {
      console.error('Checkout failed:', err)
      // Payment couldn't even start — don't leave a dangling PENDING_PAYMENT
      // order the buyer never got a chance to pay for.
      if (orderId) await cancelPendingOrder(orderId, buyerId).catch(() => {})
      setError('পেমেন্ট শুরু করা যায়নি — আবার চেষ্টা করুন।')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-surface p-6 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink-900">অর্ডার নিশ্চিত করুন</h2>
          <button onClick={onClose} className="text-ink-300 hover:text-ink-600" aria-label="বন্ধ করুন">
            ✕
          </button>
        </div>

        <p className="mt-3 line-clamp-1 text-sm text-ink-600">{product.title}</p>

        <div className="mt-4 space-y-4">
          {product.is_digital ? (
            <p className="rounded-lg bg-bg p-3 text-sm text-ink-600">
              এটি একটি ডিজিটাল পণ্য — কুরিয়ারে পাঠানো হবে না, তাই কোনো ডেলিভারি ঠিকানা লাগবে না।
            </p>
          ) : (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-900">ডেলিভারি ঠিকানা</label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
                placeholder="বাসা/রোড/এলাকা, শহর"
                className="w-full rounded-lg border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
            </div>
          )}

          <div className="rounded-lg bg-bg p-3 text-sm">
            <div className="flex justify-between text-ink-600">
              <span>পণ্যের দাম</span>
              <span className="tabular-amount">{formatTaka(product.price)}</span>
            </div>
            <div className="mt-1 flex justify-between text-ink-600">
              <span>এসক্রো ফি</span>
              <span className="tabular-amount">{formatTaka(escrowFee)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-outline pt-2 font-semibold text-ink-900">
              <span>মোট</span>
              <span className="tabular-amount">{formatTaka(total)}</span>
            </div>
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'পেমেন্ট পেজে নিয়ে যাচ্ছে...' : 'বিকাশ/নগদ/রকেট দিয়ে পেমেন্ট করুন'}
          </button>
          <p className="text-center text-xs text-ink-300">
            UddoktaPay-এর নিরাপদ পেমেন্ট পেজে নিয়ে যাওয়া হবে। টাকা এসক্রোতে জমা থাকবে — পণ্য হাতে পাওয়ার আগে বিক্রেতাকে
            দেওয়া হবে না।
          </p>
        </div>
      </div>
    </div>
  )
}
