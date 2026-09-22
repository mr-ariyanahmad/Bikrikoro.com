import { useEffect, useState } from 'react'
import { ArrowLeft, CheckCircle2, Star } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Order } from '@/types/order'

export function ReviewModal({ order, buyerName, onClose, onSuccess }: { order: Order; buyerName: string; onClose: () => void; onSuccess: () => void }) {
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      const { error: insertError } = await supabase.rpc('submit_order_review', { p_review_id: crypto.randomUUID(), p_order_id: order.id, p_product_id: order.product_id, p_seller_id: order.seller_id, p_buyer_id: order.buyer_id, p_buyer_name: buyerName, p_rating: rating, p_comment: comment.trim() })
      if (insertError) {
        if (insertError.code === '23505') throw new Error('এই অর্ডারের জন্য আগেই রিভিউ দেওয়া হয়েছে।')
        if (insertError.message.includes('Only completed orders')) throw new Error('শুধু সম্পন্ন অর্ডারের জন্য রিভিউ দেওয়া যাবে।')
        throw new Error('রিভিউ জমা দেওয়া যায়নি — আবার চেষ্টা করুন।')
      }
      onSuccess()
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : 'রিভিউ জমা দেওয়া যায়নি।') } finally { setSubmitting(false) }
  }

  return <div className="fixed inset-0 z-[80] overflow-y-auto bg-bg" role="dialog" aria-modal="true" aria-labelledby="review-title">
    <main className="mx-auto min-h-full w-full max-w-2xl px-4 pb-10 pt-4 sm:px-6 sm:pt-8"><header className="flex items-center gap-3 border-b border-outline pb-4"><button type="button" onClick={onClose} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-outline bg-surface text-ink-700 hover:border-brand-500 hover:text-brand-700" aria-label="ফিরে যান"><ArrowLeft size={20} /></button><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">Order feedback</p><h1 id="review-title" className="text-xl font-extrabold text-ink-900 sm:text-2xl">আপনার রিভিউ দিন</h1></div></header>
      <section className="mt-6 rounded-3xl border border-brand-100 bg-surface p-5 shadow-sm sm:p-8"><div className="rounded-2xl bg-brand-50 p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-700">সম্পন্ন অর্ডার</p><p className="mt-2 text-base font-extrabold text-ink-900">{order.product_title}</p><p className="mt-1 text-sm text-ink-600">আপনার অভিজ্ঞতা অন্য ক্রেতাদের সিদ্ধান্ত নিতে সাহায্য করবে।</p></div>
        <div className="mt-7"><p className="text-center text-sm font-bold text-ink-900">আপনার rating কত?</p><div className="mt-3 flex justify-center gap-2">{[1, 2, 3, 4, 5].map((star) => <button type="button" key={star} onClick={() => setRating(star)} className={`rounded-xl p-2 transition hover:bg-warning/10 ${star <= rating ? 'text-warning' : 'text-outline'}`} aria-label={`${star} স্টার`} aria-pressed={star === rating}><Star size={34} fill="currentColor" /></button>)}</div><p className="mt-2 text-center text-xs font-semibold text-ink-500">{rating}/৫ rating নির্বাচিত</p></div>
        <label className="mt-7 block"><span className="mb-1.5 block text-sm font-bold text-ink-900">আপনার মন্তব্য <span className="font-normal text-ink-400">(ঐচ্ছিক)</span></span><textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={6} maxLength={1000} placeholder="পণ্যের quality, delivery বা seller experience সম্পর্কে লিখুন…" className="w-full resize-y rounded-2xl border border-outline bg-surface px-3 py-3 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10" /><p className="mt-1 text-right text-xs text-ink-400">{comment.length}/1000</p></label>
        {error && <p className="mt-4 rounded-xl border border-error/20 bg-error/5 p-3 text-sm font-medium text-error">{error}</p>}
        <button type="button" onClick={() => void handleSubmit()} disabled={submitting} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 py-3.5 text-base font-extrabold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-wait disabled:opacity-60">{submitting ? 'রিভিউ জমা হচ্ছে…' : <><CheckCircle2 size={19} />রিভিউ জমা দিন</>}</button>
      </section>
    </main>
  </div>
}
