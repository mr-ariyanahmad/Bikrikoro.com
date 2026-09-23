import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Smartphone, X, ShieldCheck, WalletCards } from 'lucide-react'
import { createOnlineCheckout, cancelPendingOrder } from '@/lib/payments'
import { listPaymentAccounts } from '@/lib/paymentAccounts'
import type { Product, ProductDigitalSpecs } from '@/types/product'
import { formatTaka } from '@/lib/format'
import { validateCoupon, type CouponPreview } from '@/lib/marketplace'

export function BuyModal({ product, digitalSpecs, buyerId, onClose }: { product: Product; digitalSpecs?: ProductDigitalSpecs | null; buyerId: string; onClose: () => void }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [couponCode, setCouponCode] = useState('')
  const [coupon, setCoupon] = useState<CouponPreview | null>(null)
  const [couponLoading, setCouponLoading] = useState(false)
  const [acceptedPolicy, setAcceptedPolicy] = useState(false)
  const [refundAccountReady, setRefundAccountReady] = useState<boolean | null>(null)
  const [deliveryEmail, setDeliveryEmail] = useState('')
  const requiresDeliveryEmail = ['digital_game_accounts', 'digital_subscriptions', 'digital_topups'].includes(product.category_id) || Object.keys(digitalSpecs?.specifications ?? {}).some((key) => /email|gmail|recipient|account_email/i.test(key))

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow
    const previousDocumentOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'; document.documentElement.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousBodyOverflow; document.documentElement.style.overflow = previousDocumentOverflow }
  }, [])

  useEffect(() => {
    let active = true
    void listPaymentAccounts('BUYER_REFUND').then((accounts) => { if (active) setRefundAccountReady(accounts.some((account) => account.is_default)) }).catch(() => { if (active) setRefundAccountReady(false) })
    return () => { active = false }
  }, [buyerId])

  const discountedPrice = coupon?.valid ? coupon.final_price : product.price
  const escrowFee = Math.max(discountedPrice * 0.01, 10)
  const total = discountedPrice + escrowFee

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) { setError('কুপন কোড লিখুন।'); return }
    setCouponLoading(true); setError(null)
    try { const result = await validateCoupon(couponCode, product.id, buyerId); setCoupon(result); if (!result.valid) setError(result.message) } catch { setCoupon(null); setError('কুপন যাচাই করা যায়নি।') } finally { setCouponLoading(false) }
  }

  const handleSubmit = async () => {
    if (!acceptedPolicy) { setError('অর্ডার করতে প্রাইভেসি পলিসি ও রিফান্ড নীতি মেনে নেওয়া আবশ্যক।'); return }
    if (!refundAccountReady) { setError('অর্ডার করার আগে একটি default refund account যোগ করুন।'); return }
    if (requiresDeliveryEmail && !deliveryEmail.trim()) { setError('এই পণ্যটি পাঠাতে আপনার ইমেইল দিন।'); return }
    if (deliveryEmail.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(deliveryEmail.trim())) { setError('সঠিক ইমেইল ঠিকানা দিন।'); return }
    setSubmitting(true); setError(null)
    let orderId: string | null = null
    try {
      const checkout = await createOnlineCheckout({ productId: product.id, buyerId, deliveryEmail: requiresDeliveryEmail ? deliveryEmail.trim() : undefined, couponCode: coupon?.valid ? coupon.normalized_code : undefined })
      orderId = checkout.orderId
      window.location.href = checkout.paymentUrl
    } catch (checkoutError) {
      if (orderId) await cancelPendingOrder(orderId, buyerId).catch(() => {})
      setError(checkoutError instanceof Error ? checkoutError.message : 'পেমেন্ট শুরু করা যায়নি — আবার চেষ্টা করুন।')
      setSubmitting(false)
    }
  }

  return <div className="fixed inset-0 z-50 overflow-hidden bg-ink-900/55" role="dialog" aria-modal="true" aria-labelledby="confirm-order-title"><div className="flex h-full items-start justify-center sm:items-center sm:p-5"><div className="h-full w-full overflow-y-auto bg-surface p-4 sm:h-auto sm:max-h-[calc(100dvh-2.5rem)] sm:max-w-lg sm:rounded-2xl sm:border sm:border-outline sm:p-6 sm:shadow-2xl"><div className="flex items-center justify-between border-b border-outline pb-3"><div><p className="text-sm font-semibold text-brand-700">ডিজিটাল অর্ডার</p><h2 id="confirm-order-title" className="mt-1 text-lg font-semibold text-ink-900">অর্ডার নিশ্চিত করুন</h2></div><button type="button" onClick={onClose} className="rounded-full p-1.5 text-ink-500 hover:bg-bg hover:text-ink-900" aria-label="বন্ধ করুন"><X size={19} /></button></div>
    <p className="mt-3 line-clamp-2 text-sm text-ink-700">{product.title}</p>
    <div className="mt-4 space-y-3"><div className="rounded-xl border border-brand-200 bg-brand-50 p-3"><div className="flex items-center gap-2.5"><ShieldCheck size={18} className="shrink-0 text-brand-600" /><p className="text-sm font-semibold text-ink-900">নিরাপদ payment checkout</p></div></div>
      {!refundAccountReady && <Link to="/payment-accounts?purpose=BUYER_REFUND&required=1" onClick={onClose} className="flex items-center gap-3 rounded-xl border border-pink-200 bg-pink-50 p-3 text-pink-900"><WalletCards size={20} className="shrink-0 text-pink-600" /><span className="min-w-0 flex-1"><strong className="block text-sm">Refund account যোগ করা হয়নি</strong><span className="mt-0.5 block text-xs text-pink-800/75">অর্ডারের আগে account যোগ করুন</span></span><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-pink-500 text-white"><Plus size={19} /></span></Link>}
      {requiresDeliveryEmail && <div className="rounded-xl border border-outline bg-bg p-3"><label className="block text-sm font-semibold text-ink-900" htmlFor="delivery-email">ডেলিভারি ইমেইল</label><input id="delivery-email" type="email" value={deliveryEmail} onChange={(event) => { setDeliveryEmail(event.target.value); setError(null) }} placeholder="আপনার ইমেইল ঠিকানা" className="mt-2 w-full rounded-lg border border-outline bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500" /></div>}
      <div className="rounded-xl border border-outline bg-bg p-2.5"><p className="px-1 text-xs font-semibold text-ink-500">পেমেন্ট পদ্ধতি</p><div className="mt-1.5 flex items-center gap-2.5 rounded-lg border border-brand-400 bg-brand-50 px-2.5 py-2 text-brand-700"><Smartphone size={19} /><span className="min-w-0 flex-1"><span className="block text-sm font-bold">Online payment</span><span className="mt-0.5 block text-[11px]">বিকাশ · নগদ · রকেট · উপায়</span></span><span className="flex items-center gap-1"><img src="/payment-logos/bkash.png" alt="bKash" className="h-7 w-7 rounded-md bg-white object-contain p-0.5" /><img src="/payment-logos/nagad.png" alt="Nagad" className="h-7 w-7 rounded-md bg-white object-contain p-0.5" /><img src="/payment-logos/rocket.png" alt="Rocket" className="h-7 w-7 rounded-md bg-white object-contain p-0.5" /></span></div></div>
      <div className="rounded-xl border border-outline p-3"><label className="mb-1.5 block text-sm font-medium text-ink-900" htmlFor="coupon-code">কুপন কোড</label><div className="flex gap-2"><input id="coupon-code" value={couponCode} onChange={(event) => { setCouponCode(event.target.value.toUpperCase()); setCoupon(null) }} placeholder="যেমন: WELCOME10" className="min-w-0 flex-1 rounded-lg border border-outline px-3 py-2 text-sm uppercase outline-none focus:border-brand-500" /><button type="button" onClick={() => void handleApplyCoupon()} disabled={couponLoading} className="rounded-lg border border-brand-500 px-3 py-2 text-sm font-semibold text-brand-600 disabled:opacity-50">{couponLoading ? 'যাচাই হচ্ছে…' : 'প্রয়োগ করুন'}</button></div>{coupon?.valid && <p className="mt-2 text-xs font-medium text-brand-700">কুপন প্রয়োগ হয়েছে: {coupon.message || 'ছাড় পাওয়া গেছে'}</p>}</div>
      <div className="rounded-xl bg-bg p-3 text-sm"><div className="flex justify-between text-ink-600"><span>পণ্যের দাম</span><span className="tabular-amount">{formatTaka(product.price)}</span></div>{coupon?.valid && <div className="mt-1 flex justify-between text-brand-700"><span>কুপন ছাড়</span><span className="tabular-amount">−{formatTaka(coupon.discount_amount)}</span></div>}<div className="mt-1 flex justify-between text-ink-600"><span>এসক্রো ফি</span><span className="tabular-amount">{formatTaka(escrowFee)}</span></div><div className="mt-2 flex justify-between border-t border-outline pt-2 font-semibold text-ink-900"><span>মোট</span><span className="tabular-amount">{formatTaka(total)}</span></div></div>
      <div className="flex items-start gap-2 rounded-xl border border-outline bg-bg p-3 text-xs leading-relaxed text-ink-600"><input id="order-policy-consent" type="checkbox" checked={acceptedPolicy} onChange={(event) => setAcceptedPolicy(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 border-outline text-brand-500 focus:ring-brand-500" /><label htmlFor="order-policy-consent">আমি BikriKoro-এর <Link to="/privacy" className="font-semibold text-brand-700 underline" onClick={(event) => event.stopPropagation()}>প্রাইভেসি পলিসি</Link> এবং <Link to="/return-policy" className="font-semibold text-brand-700 underline" onClick={(event) => event.stopPropagation()}>রিটার্ন ও রিফান্ড নীতি</Link> মেনে নিচ্ছি।</label></div>
      {error && <p className="border border-error/30 bg-error/5 p-3 text-sm text-error">{error}</p>}
      <button type="button" onClick={() => void handleSubmit()} disabled={submitting || !acceptedPolicy || !refundAccountReady || !product.is_digital} className="w-full rounded-xl bg-brand-500 py-3 text-base font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? 'পেমেন্ট সম্পন্ন হচ্ছে...' : 'পেমেন্টে যান'}</button>
    </div></div></div></div>
}
