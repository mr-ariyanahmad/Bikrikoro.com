import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Order } from '@/types/order'

export function ReviewModal({
  order,
  buyerName,
  onClose,
  onSuccess,
}: {
  order: Order
  buyerName: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)

    // The database RPC verifies that this user owns the completed order,
    // that the product/seller match, and that the order has not been reviewed.
    const { error: insertError } = await supabase.rpc('submit_order_review', {
      p_review_id: crypto.randomUUID(),
      p_order_id: order.id,
      p_product_id: order.product_id,
      p_seller_id: order.seller_id,
      p_buyer_id: order.buyer_id,
      p_buyer_name: buyerName,
      p_rating: rating,
      p_comment: comment.trim(),
    })

    setSubmitting(false)
    if (insertError) {
      setError(
        insertError.code === '23505'
          ? 'এই অর্ডারের জন্য আগেই রিভিউ দেওয়া হয়েছে।'
          : insertError.message.includes('Only completed orders')
            ? 'শুধু সম্পন্ন অর্ডারের জন্য রিভিউ দেওয়া যাবে।'
            : 'রিভিউ জমা দেওয়া যায়নি — আবার চেষ্টা করুন।'
      )
      return
    }
    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-surface p-6 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink-900">রিভিউ দিন</h2>
          <button onClick={onClose} className="text-ink-300 hover:text-ink-600" aria-label="বন্ধ করুন">
            ✕
          </button>
        </div>
        <p className="mt-1 line-clamp-1 text-sm text-ink-600">{order.product_title}</p>

        <div className="mt-5 flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              className={`text-3xl transition ${star <= rating ? 'text-warning' : 'text-outline'}`}
              aria-label={`${star} স্টার`}
            >
              ★
            </button>
          ))}
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder="অভিজ্ঞতা লিখুন (ঐচ্ছিক)"
          className="mt-4 w-full rounded-lg border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />

        {error && <p className="mt-2 text-sm text-error">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="mt-4 w-full rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'জমা হচ্ছে...' : 'রিভিউ জমা দিন'}
        </button>
      </div>
    </div>
  )
}
