import { useEffect, useState } from 'react'
import { ArrowLeft, CheckCircle2, Star } from 'lucide-react'
import { auth } from '@/lib/firebase'
import type { Order } from '@/types/order'

export function ReviewModal({ order, buyerName, onClose, onSuccess }: { order: Order; buyerName: string; onClose: () => void; onSuccess: () => void }) {
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const suggestions: Record<number, string[]> = {
    1: ['পণ্যটি প্রত্যাশা অনুযায়ী ছিল না।', 'বর্ণনার সঙ্গে পণ্যের মিল পাইনি।', 'ডেলিভারি বা seller support সন্তোষজনক ছিল না।'],
    2: ['কিছু ভালো দিক ছিল, তবে আরও উন্নতি দরকার।', 'পণ্য বা delivery-তে কয়েকটি সমস্যা পেয়েছি।', 'Seller response আরও দ্রুত হলে ভালো হতো।'],
    3: ['পণ্য মোটামুটি ভালো, তবে কিছু উন্নতি করা যায়।', 'বর্ণনা ঠিক ছিল, কিন্তু experience আরও ভালো হতে পারত।', 'দাম ও quality মোটামুটি সামঞ্জস্যপূর্ণ।'],
    4: ['পণ্য ভালো এবং বর্ণনার সঙ্গে সামঞ্জস্যপূর্ণ।', 'Delivery দ্রুত হয়েছে, seller সহযোগিতাপূর্ণ ছিলেন।', 'সামান্য কিছু উন্নতি হলে experience আরও ভালো হবে।'],
    5: ['দারুণ পণ্য, বর্ণনার সঙ্গে পুরোপুরি মিলে গেছে।', 'Delivery দ্রুত এবং seller খুবই সহযোগিতাপূর্ণ।', 'অসাধারণ experience—আমি আবার কিনব।'],
  }

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow
    const previousDocumentOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousBodyOverflow; document.documentElement.style.overflow = previousDocumentOverflow }
  }, [])

  const handleSubmit = async () => {
    if (!order.product_id) { setError('এই পণ্যটি আর সক্রিয় নেই, তাই এই অর্ডারের জন্য নতুন রিভিউ দেওয়া যাবে না।'); return }
    setSubmitting(true); setError(null)
    try {
      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) throw new Error('আপনার login session পাওয়া যায়নি। আবার login করে চেষ্টা করুন।')
      const response = await fetch('/api/order-review', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }, body: JSON.stringify({ orderId: order.id, productId: order.product_id, sellerId: order.seller_id, buyerName, rating, comment }) })
      const payload = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(payload.error || 'রিভিউ জমা দেওয়া যায়নি — আবার চেষ্টা করুন।')
      onSuccess()
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : 'রিভিউ জমা দেওয়া যায়নি।') } finally { setSubmitting(false) }
  }

  return <div className="fixed inset-0 z-[80] overflow-y-auto bg-bg" role="dialog" aria-modal="true" aria-labelledby="review-title">
    <main className="mx-auto min-h-full w-full max-w-2xl px-4 pb-10 pt-4 sm:px-6 sm:pt-8"><header className="flex items-center gap-3 border-b border-outline pb-4"><button type="button" onClick={onClose} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-outline bg-surface text-ink-700 hover:border-brand-500 hover:text-brand-700" aria-label="ফিরে যান"><ArrowLeft size={20} /></button><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">Order feedback</p><h1 id="review-title" className="text-xl font-extrabold text-ink-900 sm:text-2xl">আপনার রিভিউ দিন</h1></div></header>
      <section className="mt-6 rounded-3xl border border-brand-100 bg-surface p-5 shadow-sm sm:p-8"><div className="rounded-2xl bg-brand-50 p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-700">সম্পন্ন অর্ডার</p><p className="mt-2 text-base font-extrabold text-ink-900">{order.product_title}</p><p className="mt-1 text-sm text-ink-600">আপনার অভিজ্ঞতা অন্য ক্রেতাদের সিদ্ধান্ত নিতে সাহায্য করবে।</p></div>
        <div className="mt-7"><p className="text-center text-sm font-bold text-ink-900">আপনার rating কত?</p><div className="mt-3 flex justify-center gap-2">{[1, 2, 3, 4, 5].map((star) => <button type="button" key={star} onClick={() => { setRating(star); setError(null) }} className={`rounded-xl p-2 transition hover:bg-warning/10 ${star <= rating ? 'text-warning' : 'text-outline'}`} aria-label={`${star} স্টার`} aria-pressed={star === rating}><Star size={34} fill="currentColor" /></button>)}</div><p className="mt-2 text-center text-xs font-semibold text-ink-500">{rating}/৫ rating নির্বাচিত</p><div className="mt-4 rounded-2xl border border-brand-100 bg-brand-50 p-3"><p className="text-xs font-bold text-brand-800">এই rating অনুযায়ী মন্তব্যের সাজেশন</p><div className="mt-2 flex flex-wrap gap-2">{suggestions[rating].map((suggestion) => <button type="button" key={suggestion} onClick={() => setComment((current) => current ? `${current} ${suggestion}` : suggestion)} className="rounded-xl border border-brand-200 bg-surface px-3 py-2 text-left text-xs font-semibold text-brand-800 transition hover:border-brand-500 hover:bg-brand-100">+ {suggestion}</button>)}</div></div></div>
        <label className="mt-7 block"><span className="mb-1.5 block text-sm font-bold text-ink-900">আপনার মন্তব্য <span className="font-normal text-ink-400">(ঐচ্ছিক)</span></span><textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={6} maxLength={1000} placeholder="পণ্যের quality, delivery বা seller experience সম্পর্কে লিখুন…" className="w-full resize-y rounded-2xl border border-outline bg-surface px-3 py-3 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10" /><p className="mt-1 text-right text-xs text-ink-400">{comment.length}/1000</p></label>
        {error && <p className="mt-4 rounded-xl border border-error/20 bg-error/5 p-3 text-sm font-medium text-error">{error}</p>}
        <button type="button" onClick={() => void handleSubmit()} disabled={submitting} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 py-3.5 text-base font-extrabold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-wait disabled:opacity-60">{submitting ? 'রিভিউ জমা হচ্ছে…' : <><CheckCircle2 size={19} />রিভিউ জমা দিন</>}</button>
      </section>
    </main>
  </div>
}
