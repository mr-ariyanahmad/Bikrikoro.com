import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { auth } from '@/lib/firebase'
import { Layout } from '@/components/Layout'
import type { OrderStatus } from '@/types/order'

type ViewState = 'checking' | 'confirmed' | 'still_pending' | 'cancelled'

export default function PaymentCallback() {
  const [searchParams] = useSearchParams()
  const orderId = searchParams.get('order_id')
  const wasCancelled = searchParams.get('cancelled') === '1'

  const [view, setView] = useState<ViewState>(wasCancelled ? 'cancelled' : 'checking')
  const [pollError, setPollError] = useState<string | null>(null)

  useEffect(() => {
    if (!orderId || wasCancelled) return

    let attempts = 0
    let cancelled = false

    async function poll() {
      try {
        const idToken = await auth.currentUser?.getIdToken()
        if (!idToken) throw new Error('আপনার Firebase session পাওয়া যায়নি।')
        const response = await fetch('/api/order-read', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }, body: JSON.stringify({ action: 'payment_state', orderId }) })
        const payload = await response.json().catch(() => ({})) as { error?: string; status?: OrderStatus }
        if (!response.ok) throw new Error(payload.error || `Payment status failed (HTTP ${response.status})`)
        const status = payload.status
        if (cancelled) return

      if (status === 'ESCROW_HELD') {
        setView('confirmed')
        return
      }
      if (status === 'CANCELLED') {
        setView('cancelled')
        return
      }

        attempts++
        // UddoktaPay's webhook is usually near-instant, but poll for up to
        // ~20s to cover network delays before telling the buyer it's still processing.
        if (attempts < 10) {
          setTimeout(poll, 2000)
        } else {
          setView('still_pending')
        }
      } catch (error) {
        console.error('Payment status polling failed:', error)
        if (!cancelled) {
          setPollError(error instanceof Error ? error.message : 'পেমেন্ট status যাচাই করা যায়নি।')
          setView('still_pending')
        }
      }
    }
    poll()

    return () => {
      cancelled = true
    }
  }, [orderId, wasCancelled])

  return (
    <Layout>
      <div className="flex flex-col items-center py-16 text-center">
        {view === 'checking' && (
          <>
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
            <p className="mt-4 text-ink-600">পেমেন্ট যাচাই করা হচ্ছে...</p>
          </>
        )}

        {view === 'confirmed' && (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-3xl text-brand-600">
              ✓
            </div>
            <h1 className="mt-4 text-xl font-semibold text-ink-900">পেমেন্ট সফল হয়েছে!</h1>
            <p className="mt-1 text-sm text-ink-600">টাকা এসক্রোতে জমা হয়েছে। বিক্রেতা এখন অর্ডারটি পাঠাবেন।</p>
            <Link
              to="/orders"
              className="mt-6 rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
            >
              অর্ডার দেখুন
            </Link>
          </>
        )}

        {view === 'still_pending' && (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-warning/10 text-3xl text-warning">
              ⏳
            </div>
            <h1 className="mt-4 text-xl font-semibold text-ink-900">পেমেন্ট প্রসেস হচ্ছে</h1>
            <p className="mt-1 max-w-sm text-sm text-ink-600">
              {pollError ?? 'কিছুটা সময় লাগছে। কনফার্মেশন এলে অর্ডার পেজে স্ট্যাটাস আপডেট হয়ে যাবে — এখনই টাকা কাটা থাকলে চিন্তার কিছু নেই।'}
            </p>
            <Link
              to="/orders"
              className="mt-6 rounded-xl border border-outline px-6 py-2.5 text-sm font-semibold text-ink-600 hover:border-brand-500 hover:text-brand-600"
            >
              অর্ডার পেজে যান
            </Link>
          </>
        )}

        {view === 'cancelled' && (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-error/10 text-3xl text-error">
              ✕
            </div>
            <h1 className="mt-4 text-xl font-semibold text-ink-900">পেমেন্ট বাতিল হয়েছে</h1>
            <p className="mt-1 text-sm text-ink-600">কোনো টাকা কাটা হয়নি। আবার চেষ্টা করতে পারেন।</p>
            <Link
              to="/products"
              className="mt-6 rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
            >
              কেনাকাটা চালিয়ে যান
            </Link>
          </>
        )}
      </div>
    </Layout>
  )
}
