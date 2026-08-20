import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { X, ShieldCheck } from 'lucide-react'
import { createPendingOrder, startUddoktaPayCheckout, cancelPendingOrder } from '@/lib/payments'
import type { Product } from '@/types/product'
import { formatTaka } from '@/lib/format'
import { validateCoupon, type CouponPreview } from '@/lib/marketplace'
import { DEFAULT_PAYMENT_METHODS, getPaymentMethods, loadPublicSettings, type PaymentMethodConfig } from '@/lib/publicSettings'

export function BuyModal({
  product,
  buyerId,
  onClose,
}: {
  product: Product
  buyerId: string
  onClose: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(product.is_digital ? null : 'এই listing physical হওয়ায় digital checkout-এর জন্য available নয়।')
  const [couponCode, setCouponCode] = useState('')
  const [coupon, setCoupon] = useState<CouponPreview | null>(null)
  const [couponLoading, setCouponLoading] = useState(false)
  const [acceptedPolicy, setAcceptedPolicy] = useState(false)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodConfig[]>(DEFAULT_PAYMENT_METHODS)

  useEffect(() => {
    void loadPublicSettings().then((settings) => setPaymentMethods(getPaymentMethods(settings)))
  }, [])

  const discountedPrice = coupon?.valid ? coupon.final_price : product.price
  const escrowFee = Math.max(discountedPrice * 0.01, 10)
  const total = discountedPrice + escrowFee

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      setError('কুপন কোড লিখুন।')
      return
    }
    setCouponLoading(true)
    setError(null)
    try {
      const result = await validateCoupon(couponCode, product.id, buyerId)
      setCoupon(result)
      if (!result.valid) setError(result.message)
    } catch (couponError) {
      console.error('Coupon validation failed:', couponError)
      setCoupon(null)
      setError('কুপন যাচাই করা যায়নি।')
    } finally {
      setCouponLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!product.is_digital) {
      setError('শুধু digital product checkout করা যাবে।')
      return
    }
    if (!acceptedPolicy) {
      setError('অর্ডার করতে প্রাইভেসি পলিসি ও রিফান্ড নীতি মেনে নেওয়া আবশ্যক।')
      return
    }
    setSubmitting(true)
    setError(null)

    let orderId: string | null = null
    try {
      orderId = await createPendingOrder({
        productId: product.id,
        buyerId,
        deliveryAddress: '',
        couponCode: coupon?.valid ? coupon.normalized_code : undefined,
      })
      const paymentUrl = await startUddoktaPayCheckout(orderId)
      window.location.href = paymentUrl
    } catch (checkoutError) {
      console.error('Digital checkout failed:', checkoutError)
      if (orderId) await cancelPendingOrder(orderId, buyerId).catch(() => {})
      setError(checkoutError instanceof Error ? checkoutError.message : 'পেমেন্ট শুরু করা যায়নি — আবার চেষ্টা করুন।')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink-900/55" role="dialog" aria-modal="true" aria-labelledby="confirm-order-title">
      <div className="flex min-h-full items-start justify-center sm:items-center sm:p-5">
        <div className="min-h-screen w-full bg-surface p-4 sm:min-h-0 sm:max-w-lg sm:border sm:border-outline sm:p-6 sm:shadow-2xl">
          <div className="flex items-center justify-between border-b border-outline pb-3">
            <div><p className="text-sm font-semibold text-brand-700">Digital checkout</p><h2 id="confirm-order-title" className="mt-1 text-lg font-semibold text-ink-900">অর্ডার নিশ্চিত করুন</h2></div>
            <button type="button" onClick={onClose} className="p-1.5 text-ink-500 transition hover:bg-bg hover:text-ink-900" aria-label="বন্ধ করুন"><X size={19} /></button>
          </div>

          <p className="mt-3 line-clamp-2 text-sm text-ink-700">{product.title}</p>

          <div className="mt-4 space-y-4">
            <div className="border border-brand-200 bg-brand-50 p-4">
              <div className="flex items-start gap-3"><ShieldCheck size={20} className="mt-0.5 shrink-0 text-brand-600" /><div><p className="text-sm font-semibold text-ink-900">Digital payment hold ও automatic delivery</p><p className="mt-1 text-xs leading-5 text-ink-700">Payment প্রথমে escrow-তে থাকবে। Payment verified হলে seller-এর key/file/instructions আপনার authenticated order library-তে আসবে। আপনি confirm না করা পর্যন্ত seller payout release হবে না।</p></div></div>
            </div>

            <div className="border border-outline bg-bg p-3">
              <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-ink-900">পেমেন্ট পদ্ধতি</p><span className="text-xs text-brand-700">UddoktaPay নিরাপদ checkout</span></div>
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">{paymentMethods.slice(0, 9).map((method) => <div key={method.name} className="flex items-center gap-1.5 border border-outline bg-surface px-2 py-2" style={{ borderColor: `${method.color}55` }} title={`${method.name} — তথ্য প্রদর্শন মাত্র`}><span className="flex h-6 w-6 shrink-0 items-center justify-center text-[9px] font-bold text-white" style={{ backgroundColor: method.color }}>{method.short.slice(0, 3)}</span><span className="truncate text-xs font-medium text-ink-700">{method.name}</span></div>)}</div>
              <p className="mt-2 text-xs leading-5 text-ink-500">এগুলো payment option-এর display badge; চূড়ান্ত পেমেন্ট UddoktaPay-এর hosted page-এ হবে।</p>
            </div>

            <div className="border border-outline p-3">
              <label className="mb-1.5 block text-sm font-medium text-ink-900" htmlFor="coupon-code">কুপন কোড</label>
              <div className="flex gap-2"><input id="coupon-code" value={couponCode} onChange={(event) => { setCouponCode(event.target.value.toUpperCase()); setCoupon(null) }} placeholder="যেমন: WELCOME10" className="min-w-0 flex-1 border border-outline px-3 py-2 text-sm uppercase outline-none focus:border-brand-500" /><button type="button" onClick={() => void handleApplyCoupon()} disabled={couponLoading} className="border border-brand-500 px-3 py-2 text-base font-semibold text-brand-600 disabled:opacity-50">{couponLoading ? 'যাচাই হচ্ছে…' : 'প্রয়োগ করুন'}</button></div>
              {coupon?.valid && <p className="mt-2 text-xs font-medium text-brand-700">কুপন প্রয়োগ হয়েছে: {coupon.message || 'ছাড় পাওয়া গেছে'}</p>}
            </div>

            <div className="bg-bg p-3 text-sm">
              <div className="flex justify-between text-ink-600"><span>পণ্যের দাম</span><span className="tabular-amount">{formatTaka(product.price)}</span></div>
              {coupon?.valid && <div className="mt-1 flex justify-between text-brand-700"><span>কুপন ছাড়</span><span className="tabular-amount">−{formatTaka(coupon.discount_amount)}</span></div>}
              <div className="mt-1 flex justify-between text-ink-600"><span>এসক্রো ফি</span><span className="tabular-amount">{formatTaka(escrowFee)}</span></div>
              <div className="mt-2 flex justify-between border-t border-outline pt-2 font-semibold text-ink-900"><span>মোট</span><span className="tabular-amount">{formatTaka(total)}</span></div>
            </div>

            <div className="flex items-start gap-2 border border-outline bg-bg p-3 text-xs leading-relaxed text-ink-600"><input id="order-policy-consent" type="checkbox" checked={acceptedPolicy} onChange={(event) => setAcceptedPolicy(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 border-outline text-brand-500 focus:ring-brand-500" /><label htmlFor="order-policy-consent">আমি BikriKoro-এর <Link to="/privacy" className="font-semibold text-brand-700 underline underline-offset-2" onClick={(event) => event.stopPropagation()}>প্রাইভেসি পলিসি</Link> এবং <Link to="/return-policy" className="font-semibold text-brand-700 underline underline-offset-2" onClick={(event) => event.stopPropagation()}>রিটার্ন ও রিফান্ড নীতি</Link> পড়েছি এবং মেনে নিচ্ছি।</label></div>
            {error && <p className="border border-error/30 bg-error/5 p-3 text-sm text-error">{error}</p>}

            <button type="button" onClick={() => void handleSubmit()} disabled={submitting || !acceptedPolicy || !product.is_digital} className="w-full bg-brand-500 py-3 text-base font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? 'পেমেন্ট পেজে নিয়ে যাচ্ছে...' : 'বিকাশ/নগদ/রকেট দিয়ে পেমেন্ট করুন'}</button>
            <p className="text-center text-xs text-ink-500">UddoktaPay-এর নিরাপদ পেমেন্ট পেজে নিয়ে যাওয়া হবে। Dispute থাকলে admin review শেষ না হওয়া পর্যন্ত escrow release হবে না।</p>
          </div>
        </div>
      </div>
    </div>
  )
}
