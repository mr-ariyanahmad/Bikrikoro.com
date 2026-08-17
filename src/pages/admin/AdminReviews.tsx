import { useCallback, useEffect, useMemo, useState } from 'react'
import { AdminPageHeader, AdminShell, AdminTableCard } from '@/components/admin/AdminShell'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { formatDate } from '@/lib/format'

type Review = { id: string; product_id: string; product_title: string; buyer_name: string; rating: number; comment: string; created_at: string }
export default function AdminReviews() {
  const { user } = useAuth()
  const [reviews, setReviews] = useState<Review[]>([])
  const [query, setQuery] = useState('')
  const [rating, setRating] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => { setLoading(true); supabase.rpc('admin_list_reviews', { p_admin_id: user?.uid }).then(({ data, error: loadError }) => { setReviews((data ?? []) as Review[]); if (loadError) setError('রিভিউ লোড করা যায়নি।'); setLoading(false) }) }, [user?.uid])
  useEffect(() => { load() }, [load])
  const visible = useMemo(() => { const value = query.trim().toLowerCase(); return reviews.filter((review) => (!rating || String(review.rating) === rating) && (!value || `${review.product_title} ${review.buyer_name} ${review.comment}`.toLowerCase().includes(value))) }, [reviews, query, rating])
  const moderate = async (review: Review, action: 'HIDE' | 'DELETE') => { const { error: actionError } = await supabase.rpc('admin_moderate_review', { p_admin_id: user?.uid, p_review_id: review.id, p_action: action }); if (actionError) setError('রিভিউ moderation করা যায়নি। নতুন admin migration প্রয়োগ করা হয়েছে কি না দেখুন।'); else load() }
  return <AdminShell><AdminPageHeader title="রিভিউ" description="ক্রেতার feedback monitor ও moderation করুন।" /><div className="mb-5 grid gap-3 sm:grid-cols-[1fr_180px]"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="প্রোডাক্ট, কাস্টমার বা মন্তব্য খুঁজুন..." className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500" /><select value={rating} onChange={(e) => setRating(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"><option value="">সব rating</option>{[5, 4, 3, 2, 1].map((item) => <option key={item} value={item}>{item} star</option>)}</select></div>{error && <p className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}<AdminTableCard>{loading ? <p className="p-10 text-center text-sm text-slate-500">লোড হচ্ছে...</p> : visible.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">কোনো রিভিউ নেই।</p> : <div className="divide-y divide-slate-100">{visible.map((review) => <div key={review.id} className="flex flex-col gap-3 px-5 py-5 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-amber-500">{'★'.repeat(Math.max(0, Math.min(5, review.rating)))}</span><span className="text-xs text-slate-400">{formatDate(review.created_at)}</span></div><p className="mt-2 font-semibold text-slate-800">{review.product_title}</p><p className="mt-1 text-sm leading-relaxed text-slate-600">{review.comment || 'কোনো মন্তব্য নেই।'}</p><p className="mt-2 text-xs text-slate-400">কাস্টমার: {review.buyer_name || 'অজানা'}</p></div><div className="flex shrink-0 gap-2"><button onClick={() => moderate(review, 'HIDE')} className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700">Hide</button><button onClick={() => moderate(review, 'DELETE')} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700">Delete</button></div></div>)}</div>}</AdminTableCard></AdminShell>
}
