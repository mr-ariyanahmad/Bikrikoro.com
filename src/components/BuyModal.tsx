import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { auth } from '@/lib/firebase'
import { createPendingOrder, createWalletOrder, startUddoktaPayCheckout, cancelPendingOrder } from '@/lib/payments'
import { supabase } from '@/lib/supabase'
import type { Product } from '@/types/product'
import { formatTaka } from '@/lib/format'
import { validateCoupon, type CouponPreview } from '@/lib/marketplace'
import { BrandSelect } from '@/components/BrandSelect'

type PaymentMethod = 'WALLET' | 'ONLINE'

type WalletCheckoutPayload = {
  error?: string
  balance?: { available_balance?: number }
  withdrawalSummary?: { spendable_balance?: number } | null
}

export function BuyModal({
  product,
  buyerId,
  onClose,
}: {
  product: Product
  buyerId: string
  onClose: () => void
}) {
  const navigate = useNavigate()
  const [address, setAddress] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [couponCode, setCouponCode] = useState('')
  const [coupon, setCoupon] = useState<CouponPreview | null>(null)
  const [couponLoading, setCouponLoading] = useState(false)
  const [savedAddresses, setSavedAddresses] = useState<Array<{ id: string; label: string; recipient_name: string; phone: string; address_line: string; city: string; area: string; postal_code: string | null }>>([])
  const [selectedAddressId, setSelectedAddressId] = useState('')
  const [acceptedPolicy, setAcceptedPolicy] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('ONLINE')
  const [walletSpendable, setWalletSpendable] = useState<number | null>(null)
  const [walletLoading, setWalletLoading] = useState(true)

  useEffect(() => {
    let active = true
    setSavedAddresses([])
    setSelectedAddressId('')
    if (product.is_digital) return () => { active = false }
    const loadSavedAddresses = async () => {
      try {
        const { data, error: addressError } = await supabase.rpc('list_saved_addresses', { p_user_id: buyerId })
        if (addressError) throw addressError
        if (!active) return
        const addresses = (data ?? []) as typeof savedAddresses
        setSavedAddresses(addresses)
        const defaultAddress = addresses[0]
        if (defaultAddress) { setSelectedAddressId(defaultAddress.id); setAddress(`${defaultAddress.recipient_name}, ${defaultAddress.phone}, ${defaultAddress.address_line}, ${defaultAddress.area}, ${defaultAddress.city}`) }
      } catch (addressError) {
        console.error('Saved addresses failed:', addressError)
        if (active) setError(addressError instanceof Error ? addressError.message : 'সেভড ঠিকানা লোড করা যায়নি।')
      }
    }
    void loadSavedAddresses()
    return () => { active = false }
  }, [buyerId, product.is_digital])

  useEffect(() => {
    let active = true
    setWalletLoading(true)
    const loadWalletSpendable = async () => {
      try {
        const idToken = await auth.currentUser?.getIdToken()
        if (!idToken) throw new Error('আপনার Firebase session পাওয়া যায়নি।')
        const response = await fetch('/api/order-read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ action: 'wallet' }),
        })
        const payload = await response.json().catch(() => ({})) as WalletCheckoutPayload
        if (!response.ok) throw new Error(payload.error || `Wallet load failed (HTTP ${response.status})`)
        if (!active) return
        const spendable = payload.withdrawalSummary?.spendable_balance ?? payload.balance?.available_balance ?? 0
        setWalletSpendable(Number(spendable))
      } catch (walletError) {
        console.error('Checkout wallet load failed:', walletError)
        if (active) setWalletSpendable(0)
      } finally {
        if (active) setWalletLoading(false)
      }
    }
    void loadWalletSpendable()
    return () => { active = false }
  }, [buyerId])

  const discountedPrice = coupon?.valid ? coupon.final_price : product.price
  const escrowFee = Math.max(discountedPrice * 0.01, 10)
  const total = discountedPrice + escrowFee
  const walletInsufficient = walletSpendable !== null && walletSpendable < total

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
    } catch (err) {
      console.error('coupon validation failed:', err)
      setCoupon(null)
      setError('কুপন যাচাই করা যায়নি।')
    } finally {
      setCouponLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!product.is_digital && address.trim().length < 8) {
      setError('ডেলিভারি ঠিকানা লিখুন (কমপক্ষে ৮ অক্ষর)')
      return
    }
    if (!acceptedPolicy) { setError('অর্ডার করতে প্রাইভেসি পলিসি ও রিটার্ন/রিফান্ড নীতি মেনে নেওয়া আবশ্যক।'); return }
    if (paymentMethod === 'WALLET' && (walletSpendable === null || walletSpendable < total)) {
      setError('আপনার spendable wallet balance এই অর্ডারের মোট টাকার চেয়ে কম। Online payment বেছে নিন বা wallet balance বাড়ান।')
      return
    }

    setSubmitting(true)
    setError(null)
    let orderId: string | null = null
    try {
      const orderParams = {
        productId: product.id,
        buyerId,
        deliveryAddress: product.is_digital ? 'ডিজিটাল পণ্য — কোনো শিপিং ঠিকানা প্রযোজ্য নয়' : address.trim(),
        couponCode: coupon?.valid ? coupon.normalized_code : undefined,
      }
      if (paymentMethod === 'WALLET') {
        orderId = await createWalletOrder(orderParams)
        navigate(`/orders/${orderId}`)
        return
      }

      orderId = await createPendingOrder(orderParams)
      const paymentUrl = await startUddoktaPayCheckout(orderId)
      window.location.href = paymentUrl
    } catch (err) {
      console.error('Checkout failed:', err)
      if (orderId && paymentMethod === 'ONLINE') await cancelPendingOrder(orderId, buyerId).catch(() => {})
      setError(paymentMethod === 'WALLET' ? 'ওয়ালেট পেমেন্ট সম্পন্ন করা যায়নি — balance ও order status যাচাই করে আবার চেষ্টা করুন।' : 'পেমেন্ট শুরু করা যায়নি — আবার চেষ্টা করুন।')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink-900/55" role="dialog" aria-modal="true" aria-labelledby="confirm-order-title">
      <div className="flex min-h-full items-start justify-center sm:items-center sm:p-5">
        <div className="min-h-screen w-full bg-surface p-4 sm:min-h-0 sm:max-w-lg sm:rounded-2xl sm:p-6 sm:shadow-2xl">
          <div className="flex items-center justify-between">
            <h2 id="confirm-order-title" className="text-lg font-semibold text-ink-900">অর্ডার নিশ্চিত করুন</h2>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-ink-400 transition hover:bg-bg hover:text-ink-700" aria-label="বন্ধ করুন"><X size={19} /></button>
          </div>

          <p className="mt-3 line-clamp-1 text-sm text-ink-600">{product.title}</p>

          <div className="mt-4 space-y-4">
            {product.is_digital ? (
              <p className="rounded-lg bg-bg p-3 text-sm text-ink-600">এটি একটি ডিজিটাল পণ্য — কুরিয়ারে পাঠানো হবে না, তাই কোনো ডেলিভারি ঠিকানা লাগবে না।</p>
            ) : (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-900">ডেলিভারি ঠিকানা</label>
                {savedAddresses.length > 0 && <div className="mb-2"><BrandSelect label="সেভড ঠিকানা" value={selectedAddressId} options={[{ value: '', label: 'সেভড ঠিকানা বেছে নিন' }, ...savedAddresses.map((saved) => ({ value: saved.id, label: `${saved.label} — ${saved.address_line}, ${saved.city}` }))]} onChange={(value) => { const next = savedAddresses.find((item) => item.id === value); setSelectedAddressId(value); if (next) setAddress(`${next.recipient_name}, ${next.phone}, ${next.address_line}, ${next.area}, ${next.city}`) }} /></div>}
                <textarea value={address} onChange={(e) => { setAddress(e.target.value); setSelectedAddressId('') }} rows={2} placeholder="বাসা/রোড/এলাকা, শহর" className="w-full rounded-lg border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500" />
                <p className="mt-1 text-xs text-ink-400">ঠিকানা পরে <span className="font-medium text-brand-600">সেভড ঠিকানা</span> পেজ থেকেও বদলাতে পারবেন।</p>
              </div>
            )}

            <div className="rounded-xl border border-outline p-3">
              <label className="mb-1.5 block text-sm font-medium text-ink-900" htmlFor="coupon-code">কুপন কোড</label>
              <div className="flex gap-2"><input id="coupon-code" value={couponCode} onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCoupon(null) }} placeholder="যেমন: WELCOME10" className="min-w-0 flex-1 rounded-lg border border-outline px-3 py-2 text-sm uppercase outline-none focus:border-brand-500" /><button type="button" onClick={handleApplyCoupon} disabled={couponLoading} className="rounded-lg border border-brand-500 px-3 py-2 text-sm font-semibold text-brand-600 disabled:opacity-50">{couponLoading ? 'যাচাই হচ্ছে…' : 'প্রয়োগ করুন'}</button></div>
              {coupon?.valid && <p className="mt-2 text-xs font-medium text-brand-700">কুপন প্রয়োগ হয়েছে: {coupon.message || 'ছাড় পাওয়া গেছে'}</p>}
            </div>

            <div className="rounded-lg bg-bg p-3 text-sm">
              <div className="flex justify-between text-ink-600"><span>পণ্যের দাম</span><span className="tabular-amount">{formatTaka(product.price)}</span></div>
              {coupon?.valid && <div className="mt-1 flex justify-between text-brand-700"><span>কুপন ছাড়</span><span className="tabular-amount">−{formatTaka(coupon.discount_amount)}</span></div>}
              <div className="mt-1 flex justify-between text-ink-600"><span>এসক্রো ফি</span><span className="tabular-amount">{formatTaka(escrowFee)}</span></div>
              <div className="mt-2 flex justify-between border-t border-outline pt-2 font-semibold text-ink-900"><span>মোট</span><span className="tabular-amount">{formatTaka(total)}</span></div>
            </div>

            <div className="rounded-xl border border-outline p-3">
              <p className="mb-2 text-sm font-medium text-ink-900">পেমেন্ট পদ্ধতি বেছে নিন</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setPaymentMethod('WALLET')} className={`rounded-xl border px-3 py-3 text-left text-sm transition ${paymentMethod === 'WALLET' ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-outline text-ink-600'}`}>
                  <span className="block font-semibold">Wallet balance</span>
                  <span className="mt-1 block text-xs">{walletLoading ? 'লোড হচ্ছে…' : `উপলব্ধ ${formatTaka(walletSpendable ?? 0)}`}</span>
                </button>
                <button type="button" onClick={() => setPaymentMethod('ONLINE')} className={`rounded-xl border px-3 py-3 text-left text-sm transition ${paymentMethod === 'ONLINE' ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-outline text-ink-600'}`}>
                  <span className="block font-semibold">Online payment</span>
                  <span className="mt-1 block text-xs">বিকাশ / নগদ</span>
                </button>
              </div>
              {paymentMethod === 'WALLET' && walletInsufficient && <p className="mt-2 text-xs text-error">Wallet spendable balance এই order-এর মোট টাকার চেয়ে কম। Online payment বেছে নিন।</p>}
            </div>

            <div className="flex items-start gap-2 rounded-xl border border-outline bg-bg p-3 text-xs leading-relaxed text-ink-600"><input id="order-policy-consent" type="checkbox" checked={acceptedPolicy} onChange={(e) => setAcceptedPolicy(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 rounded border-outline text-brand-500 focus:ring-brand-500" /><label htmlFor="order-policy-consent">আমি BikriKoro-এর <Link to="/privacy" className="font-semibold text-brand-700 underline underline-offset-2" onClick={(event) => event.stopPropagation()}>প্রাইভেসি পলিসি</Link> এবং <Link to="/return-policy" className="font-semibold text-brand-700 underline underline-offset-2" onClick={(event) => event.stopPropagation()}>রিটার্ন ও রিফান্ড নীতি</Link> পড়েছি এবং অর্ডারের পণ্যের ধরন অনুযায়ী প্রযোজ্য নিয়ম মেনে নিচ্ছি।</label></div>
            {error && <p className="text-sm text-error">{error}</p>}

            <button type="button" onClick={handleSubmit} disabled={submitting || !acceptedPolicy || (paymentMethod === 'WALLET' && walletInsufficient)} className="w-full rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50">
              {submitting ? (paymentMethod === 'WALLET' ? 'ওয়ালেট থেকে পেমেন্ট হচ্ছে...' : 'পেমেন্ট পেজে নিয়ে যাচ্ছে...') : paymentMethod === 'WALLET' ? 'Wallet balance দিয়ে পেমেন্ট করুন' : 'Online payment (বিকাশ/নগদ)'}
            </button>
            <p className="text-center text-xs text-ink-300">{paymentMethod === 'WALLET' ? 'Wallet থেকে টাকা কেটে order সরাসরি escrow-তে যাবে।' : 'নিরাপদ online payment পেজে নিয়ে যাওয়া হবে। টাকা escrow-তে জমা থাকবে — পণ্য হাতে পাওয়ার আগে বিক্রেতাকে দেওয়া হবে না।'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
