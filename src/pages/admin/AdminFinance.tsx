import { useCallback, useEffect, useState } from 'react'
import { AdminPageHeader, AdminShell, AdminTableCard } from '@/components/admin/AdminShell'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { formatAdminRpcError } from '@/lib/adminRpcError'
import { formatDateTime, formatTaka } from '@/lib/format'

type Withdrawal = { id: string; user_id: string; amount: number; method: string; account_details: string; status: string; admin_note: string | null; requested_at: string; processed_at: string | null }
const labels: Record<string, string> = { PENDING: 'অপেক্ষায়', APPROVED: 'অনুমোদিত', REJECTED: 'বাতিল', PAID: 'পরিশোধিত' }

export default function AdminFinance() {
  const { user } = useAuth()
  const [rows, setRows] = useState<Withdrawal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<Record<string, string>>({})
  const load = useCallback(() => {
    setLoading(true)
    supabase.rpc('admin_list_withdrawals', { p_admin_id: user?.uid }).then(({ data, error: loadError }) => {
      setRows((data ?? []) as Withdrawal[])
      if (loadError) setError(formatAdminRpcError(loadError, 'উইথড্রয়াল data', '014 admin workspace migration'))
      setLoading(false)
    })
  }, [user?.uid])
  useEffect(() => { load() }, [load])
  const formatPayoutError = (reviewError: { message?: string | null; code?: string | null }) => {
    const message = reviewError.message?.toLowerCase() ?? ''
    if (message.includes('insufficient wallet balance') || message.includes('available_balance_check')) {
      return 'এই payout পরিশোধ করা যাচ্ছে না। Seller wallet-এর available balance payout amount-এর চেয়ে কম। আগে wallet balance যাচাই করুন।'
    }
    if (message.includes('wallet balance not found')) {
      return 'এই seller-এর wallet balance row পাওয়া যায়নি। Seller account-এ wallet তৈরি হয়েছে কি না যাচাই করুন।'
    }
    return formatAdminRpcError(reviewError, 'উইথড্রয়াল update', '014 admin workspace migration')
  }
  const review = async (row: Withdrawal, status: string) => {
    const { error: reviewError } = await supabase.rpc('admin_review_withdrawal', { p_admin_id: user?.uid, p_request_id: row.id, p_status: status, p_admin_note: note[row.id] ?? '' })
    if (reviewError) setError(formatPayoutError(reviewError))
    else load()
  }
  return <AdminShell><AdminPageHeader title="পেআউট ও উইথড্রয়াল" description="Seller wallet-এর payout request review ও process করুন।" /><AdminTableCard>{loading ? <p className="p-10 text-center text-sm text-slate-500">লোড হচ্ছে...</p> : rows.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">কোনো payout request নেই।</p> : <div className="divide-y divide-slate-100">{rows.map((row) => <div key={row.id} className="space-y-3 px-5 py-5"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-semibold text-slate-800">{formatTaka(row.amount)} · {row.method}</p><p className="mt-1 text-xs text-slate-400">Seller UID: {row.user_id} · {formatDateTime(row.requested_at)}</p><p className="mt-1 text-sm text-slate-600">Account: {row.account_details}</p></div><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${row.status === 'PAID' ? 'bg-brand-50 text-brand-700' : row.status === 'REJECTED' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{labels[row.status] ?? row.status}</span></div><div className="flex flex-col gap-2 sm:flex-row"><input value={note[row.id] ?? row.admin_note ?? ''} onChange={(e) => setNote({ ...note, [row.id]: e.target.value })} placeholder="Admin note (ঐচ্ছিক)" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />{row.status === 'PENDING' && <><button onClick={() => review(row, 'APPROVED')} className="rounded-xl border border-brand-200 px-3 py-2 text-sm font-semibold text-brand-700">Approve</button><button onClick={() => review(row, 'REJECTED')} className="rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700">Reject</button></>}{row.status === 'APPROVED' && <button onClick={() => review(row, 'PAID')} className="rounded-xl bg-brand-500 px-3 py-2 text-sm font-semibold text-white">Mark paid</button>}</div></div>)}</div>}</AdminTableCard>{error && <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}</AdminShell>
}
