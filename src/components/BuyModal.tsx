import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { X, ShieldCheck } from 'lucide-react'
import { createPendingOrder, createWalletOrder, getWalletBalance, startUddoktaPayCheckout, cancelPendingOrder } from '@/lib/payments'
import type { Product, ProductDigitalSpecs } from '@/types/product'
import { formatTaka } from '@/lib/format'
import { validateCoupon, type CouponPreview } from '@/lib/marketplace'

export function BuyModal({
  product,
  digitalSpecs,
  buyerId,
  onClose,
}: {
  product: Product
  digitalSpecs?: ProductDigitalSpecs | null
  buyerId: string
  onClose: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [couponCode, setCouponCode] = useState('')
  const [coupon, setCoupon] = useState<CouponPreview | null>(null)
  const [couponLoading, setCouponLoading] = useState(false)
  const [acceptedPolicy, setAcceptedPolicy] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'ONLINE' | 'WALLET'>('ONLINE')
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [walletLoading, setWalletLoading] = useState(true)
  const [deliveryEmail, setDeliveryEmail] = useState('')
  const requiresDeliveryEmail = ['digital_game_accounts', 'digital_subscriptions', 'digital_topups'].includes(product.category_id) || Object.keys(digitalSpecs?.specifications ?? {}).some((key) => /email|gmail|recipient|account_email/i.test(key))

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow
    const previousDocumentOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousDocumentOverflow
    }
  }, [])

  useEffect(() => {
    let active = true
    setWalletLoading(true)
    void getWalletBalance(buyerId).then((balance) => { if (active) setWalletBalance(balance) }).catch(() => { if (active) setWalletBalance(null) }).finally(() => { if (active) setWalletLoading(false) })
    return () => { active = false }
  }, [buyerId])

  const discountedPrice = coupon?.valid ? coupon.final_price : product.price
  const escrowFee = Math.max(discountedPrice * 0.01, 10)
  const total = discountedPrice + escrowFee
  const walletAffordable = walletBalance !== null && walletBalance >= total

  useEffect(() => {
    if (paymentMethod === 'WALLET' && walletBalance !== null && walletBalance < total) setPaymentMethod('ONLINE')
  }, [paymentMethod, total, walletBalance])

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
    if (!acceptedPolicy) {
      setError('অর্ডার করতে প্রাইভেসি পলিসি ও রিফান্ড নীতি মেনে নেওয়া আবশ্যক।')
      return
    }
    if (requiresDeliveryEmail && !deliveryEmail.trim()) {
      setError('এই পণ্যটি পাঠাতে আপনার ইমেইল দিন।')
      return
    }
    if (deliveryEmail.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(deliveryEmail.trim())) {
      setError('সঠিক ইমেইল ঠিকানা দিন।')
      return
    }
    if (paymentMethod === 'WALLET' && !walletAffordable) {
      setPaymentMethod('ONLINE')
      setError(walletBalance === null ? 'ওয়ালেটের ব্যালেন্স পাওয়া যায়নি। অনলাইন পেমেন্ট বেছে নিন।' : `ওয়ালেটের ব্যালেন্স ${formatTaka(walletBalance)}; মোট প্রয়োজন ${formatTaka(total)}।`)
      return
    }
    setSubmitting(true)
    setError(null)

    let orderId: string | null = null
    try {
      const orderParams = { productId: product.id, buyerId, deliveryEmail: requiresDeliveryEmail ? deliveryEmail.trim() : undefined, couponCode: coupon?.valid ? coupon.normalized_code : undefined }
      orderId = paymentMethod === 'WALLET' ? await createWalletOrder(orderParams) : await createPendingOrder(orderParams)
      if (paymentMethod === 'ONLINE') {
        const paymentUrl = await startUddoktaPayCheckout(orderId)
        window.location.href = paymentUrl
      } else {
        window.location.href = '/orders'
      }
    } catch (checkoutError) {
      console.error('ডিজিটাল অর্ডার failed:', checkoutError)
      if (orderId) await cancelPendingOrder(orderId, buyerId).catch(() => {})
      setError(checkoutError instanceof Error ? checkoutError.message : 'পেমেন্ট শুরু করা যায়নি — আবার চেষ্টা করুন।')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-ink-900/55" role="dialog" aria-modal="true" aria-labelledby="confirm-order-title">
      <div className="flex h-full items-start justify-center sm:items-center sm:p-5">
        <div className="h-full w-full overflow-y-auto bg-surface p-4 sm:h-auto sm:max-h-[calc(100dvh-2.5rem)] sm:max-w-lg sm:border sm:border-outline sm:p-6 sm:shadow-2xl">
          <div className="flex items-center justify-between border-b border-outline pb-3">
            <div><p className="text-sm font-semibold text-brand-700">ডিজিটাল অর্ডার</p><h2 id="confirm-order-title" className="mt-1 text-lg font-semibold text-ink-900">অর্ডার নিশ্চিত করুন</h2></div>
            <button type="button" onClick={onClose} className="p-1.5 text-ink-500 transition hover:bg-bg hover:text-ink-900" aria-label="বন্ধ করুন"><X size={19} /></button>
          </div>

          <p className="mt-3 line-clamp-2 text-sm text-ink-700">{product.title}</p>

          <div className="mt-4 space-y-4">
            <div className="border border-brand-200 bg-brand-50 p-4"><div className="flex items-start gap-3"><ShieldCheck size={20} className="mt-0.5 shrink-0 text-brand-600" /><div><p className="text-sm font-semibold text-ink-900">ডিজিটাল পণ্য পেমেন্ট</p><p className="mt-1 text-xs leading-5 text-ink-700">পেমেন্ট সম্পন্ন হলে পণ্যটি আপনার ডিজিটাল সংগ্রহে পাওয়া যাবে।</p></div></div></div>
            {requiresDeliveryEmail && <div className="border border-outline bg-bg p-3"><label className="block text-sm font-semibold text-ink-900" htmlFor="delivery-email">ডেলিভারি ইমেইল</label><p className="mt-1 text-xs leading-5 text-ink-500">এই পণ্যের তথ্য বা প্রবেশাধিকার আপনার ইমেইলে পাঠানো হতে পারে।</p><input id="delivery-email" type="email" value={deliveryEmail} onChange={(event) => { setDeliveryEmail(event.target.value); setError(null) }} placeholder="আপনার ইমেইল ঠিকানা" className="mt-3 w-full border border-outline bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500" /></div>}

            <div className="border border-outline bg-bg p-3"><p className="text-sm font-semibold text-ink-900">পেমেন্ট অপশন বেছে নিন</p><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => setPaymentMethod('ONLINE')} className={`border px-3 py-3 text-left transition ${paymentMethod === 'ONLINE' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-outline bg-surface text-ink-700 hover:border-brand-300'}`}><span className="block text-sm font-bold">অনলাইন পেমেন্ট</span><span className="mt-1 block text-xs text-ink-500">বিকাশ, নগদ, রকেট বা কার্ড</span></button><button type="button" disabled={!walletAffordable} onClick={() => setPaymentMethod('WALLET')} className={`border px-3 py-3 text-left transition ${paymentMethod === 'WALLET' ? 'border-brand-500 bg-brand-50 text-brand-700' : walletAffordable ? 'border-outline bg-surface text-ink-700 hover:border-brand-300' : 'cursor-not-allowed border-outline bg-bg text-ink-400'}`}><span className="block text-sm font-bold">ওয়ালেট পেমেন্ট</span><span className="mt-1 block text-xs">{walletLoading ? 'ব্যালেন্স দেখা হচ্ছে...' : walletAffordable ? `ব্যালেন্স ${formatTaka(walletBalance ?? 0)}` : `ব্যালেন্স কম — ${formatTaka(walletBalance ?? 0)}`}</span></button></div>{!walletLoading && !walletAffordable && <p className="mt-2 text-xs text-ink-500">ওয়ালেট দিয়ে পেমেন্ট করতে ব্যালেন্স বাড়ান অথবা অনলাইন পেমেন্ট বেছে নিন।</p>}</div>

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

            <button type="button" onClick={() => void handleSubmit()} disabled={submitting || !acceptedPolicy || !product.is_digital} className="w-full bg-brand-500 py-3 text-base font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? 'পেমেন্ট সম্পন্ন হচ্ছে...' : paymentMethod === 'ONLINE' ? 'অনলাইন পেমেন্টে এগিয়ে যান' : 'ওয়ালেট দিয়ে পেমেন্ট করুন'}</button>
            <p className="text-center text-xs text-ink-500">পেমেন্ট সম্পন্ন হলে পণ্যটি আপনার ডিজিটাল সংগ্রহে পাওয়া যাবে।</p>
          </div>
        </div>
      </div>
    </div>
  )
}
