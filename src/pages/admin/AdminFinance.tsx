import { useCallback, useEffect, useMemo, useState } from 'react'
import { AdminPageHeader, AdminShell, AdminTableCard } from '@/components/admin/AdminShell'
import { useAuth } from '@/context/AuthContext'
import { formatAdminRpcError } from '@/lib/adminRpcError'
import { formatDateTime, formatTaka } from '@/lib/format'
import { adminRpc } from '@/lib/adminRpc'

type Withdrawal = {
  id: string
  user_id: string
  amount: number
  method: string
  account_details: string
  status: string
  admin_note: string | null
  requested_at: string
  processed_at: string | null
  available_balance: number
  reserved_amount: number
  spendable_balance: number
}

type WithdrawalStatus = 'APPROVED' | 'REJECTED' | 'PAID'
type LedgerRow = { id: string; user_id: string; user_name: string | null; type: string; amount: number; order_id: string | null; description: string; created_at: string }
type WalletRow = { user_id: string; user_name: string | null; email: string | null; available_balance: number; reserved_amount: number; spendable_balance: number }

const labels: Record<string, string> = {
  PENDING: 'অপেক্ষায়',
  APPROVED: 'অনুমোদিত',
  REJECTED: 'বাতিল',
  PAID: 'পরিশোধিত',
}

export default function AdminFinance() {
  const { user } = useAuth()
  const [rows, setRows] = useState<Withdrawal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<Record<string, string>>({})
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [transactionType, setTransactionType] = useState('ALL')
  const [finance, setFinance] = useState<{ total_wallet_balance: number; wallet_users: number; ledger_entries: number; by_type: Array<{ type: string; entries: number; net_amount: number }>; wallets: WalletRow[]; transactions: LedgerRow[] }>({ total_wallet_balance: 0, wallet_users: 0, ledger_entries: 0, by_type: [], wallets: [], transactions: [] })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: loadError } = await adminRpc('admin_list_withdrawals_reconciled', { p_admin_id: user?.uid })
    const { data: financeData } = await adminRpc('admin_get_finance_overview', { p_admin_id: user?.uid })
    setRows((data ?? []) as Withdrawal[])
    if (financeData) setFinance(financeData as typeof finance)
    if (loadError) setError(formatAdminRpcError(loadError, 'উইথড্রয়াল data', '055 safe withdrawal reservation migration'))
    setLoading(false)
  }, [user?.uid])

  useEffect(() => { void load() }, [load])

  const formatPayoutError = (reviewError: { message?: string | null; code?: string | null }) => {
    const message = reviewError.message?.toLowerCase() ?? ''
    if (message.includes('insufficient') || message.includes('available_balance_check')) {
      return 'এই payout পরিশোধ করা যাচ্ছে না। Seller-এর spendable balance এবং active reservation যাচাই করুন।'
    }
    if (message.includes('wallet balance not found')) {
      return 'এই seller-এর wallet balance row পাওয়া যায়নি। Seller account-এ wallet তৈরি হয়েছে কি না যাচাই করুন।'
    }
    return formatAdminRpcError(reviewError, 'উইথড্রয়াল update', '055 safe withdrawal reservation migration')
  }

  const filteredTransactions = useMemo(() => finance.transactions.filter((item) => {
    const created = new Date(item.created_at).getTime()
    const from = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null
    const to = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : null
    return (!from || created >= from) && (!to || created <= to) && (transactionType === 'ALL' || item.type === transactionType)
  }), [finance.transactions, fromDate, toDate, transactionType])

  const clearTransactionFilters = () => { setFromDate(''); setToDate(''); setTransactionType('ALL') }

  const review = async (row: Withdrawal, status: WithdrawalStatus) => {
    const available = Number(row.available_balance ?? 0)
    const reserved = Number(row.reserved_amount ?? 0)
    if (row.status === 'REJECTED' || row.status === 'PAID') {
      setError('এই payout-এর আর কোনো status পরিবর্তন করা যাবে না।')
      return
    }
    if (row.status === 'PENDING' && !['APPROVED', 'REJECTED'].includes(status)) {
      setError('Pending payout শুধু Approve অথবা Reject করা যাবে।')
      return
    }
    if (row.status === 'APPROVED' && !['PAID', 'REJECTED'].includes(status)) {
      setError('Approved payout শুধু Mark paid অথবা paid হওয়ার আগে Reject করা যাবে; আবার approve করা যাবে না।')
      return
    }
    if (status === 'PAID' && (available < Number(row.amount) || reserved > available)) {
      setError('এই payout এখন পরিশোধ করা যাবে না। আগে duplicate বা অতিরিক্ত active payout Reject করুন।')
      return
    }

    setProcessingId(row.id)
    setError(null)
    try {
      const { error: reviewError } = await adminRpc('admin_review_withdrawal', {
        p_admin_id: user?.uid,
        p_request_id: row.id,
        p_status: status,
        p_admin_note: note[row.id] ?? '',
      })
      if (reviewError) setError(formatPayoutError(reviewError))
      else await load()
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <AdminShell>
      <AdminPageHeader title="পেআউট ও উইথড্রয়াল" description="Seller wallet-এর payout request review ও process করুন।" />
      <div className="mb-5 grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-outline bg-surface p-5"><p className="text-sm text-ink-500">সব user wallet balance</p><p className="mt-2 text-2xl font-extrabold text-ink-900">{formatTaka(finance.total_wallet_balance)}</p><p className="mt-1 text-xs text-ink-500">{finance.wallet_users.toLocaleString('bn-BD')}টি wallet</p></div><div className="rounded-2xl border border-outline bg-surface p-5"><p className="text-sm text-ink-500">মোট ledger transaction</p><p className="mt-2 text-2xl font-extrabold text-ink-900">{finance.ledger_entries.toLocaleString('bn-BD')}</p></div><div className="rounded-2xl border border-outline bg-surface p-5"><p className="text-sm text-ink-500">Transaction type</p><p className="mt-2 text-sm font-semibold text-ink-800">{finance.by_type.map((item) => `${item.type}: ${formatTaka(Number(item.net_amount))}`).join(' · ') || '—'}</p></div></div>
      <AdminTableCard className="mb-5"><div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">প্রতিটি user-এর wallet balance</h2><p className="mt-1 text-xs text-slate-500">Available, reserved এবং বর্তমানে খরচযোগ্য balance। সর্বোচ্চ ৫০০টি wallet দেখানো হচ্ছে।</p></div>{finance.wallets.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">কোনো wallet নেই।</p> : <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-5 py-3 font-semibold">User</th><th className="px-5 py-3 font-semibold">Available</th><th className="px-5 py-3 font-semibold">Reserved</th><th className="px-5 py-3 font-semibold">Spendable</th></tr></thead><tbody className="divide-y divide-slate-100">{finance.wallets.map((item) => <tr key={item.user_id}><td className="px-5 py-3"><p className="font-semibold text-slate-800">{item.user_name || item.user_id}</p><p className="text-xs text-slate-500">{item.email || item.user_id}</p></td><td className="px-5 py-3 font-semibold text-slate-800">{formatTaka(Number(item.available_balance))}</td><td className="px-5 py-3 text-amber-700">{formatTaka(Number(item.reserved_amount))}</td><td className="px-5 py-3 font-bold text-brand-700">{formatTaka(Number(item.spendable_balance))}</td></tr>)}</tbody></table></div>}</AdminTableCard>
      <AdminTableCard className="mb-5"><div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">সব wallet transaction</h2><p className="mt-1 text-xs text-slate-500">সর্বশেষ ২০০টি transaction থেকে date range ও type অনুযায়ী filter করুন।</p></div><div className="grid gap-3 border-b border-slate-100 bg-slate-50 p-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"><label className="text-xs font-semibold text-slate-600"><span className="mb-1 block">শুরু তারিখ</span><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-brand-500" /></label><label className="text-xs font-semibold text-slate-600"><span className="mb-1 block">শেষ তারিখ</span><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-brand-500" /></label><label className="text-xs font-semibold text-slate-600"><span className="mb-1 block">Transaction type</span><select value={transactionType} onChange={(event) => setTransactionType(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-brand-500"><option value="ALL">সব ধরনের</option>{finance.by_type.map((item) => <option key={item.type} value={item.type}>{item.type}</option>)}</select></label><button type="button" onClick={clearTransactionFilters} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-brand-400 hover:text-brand-700">Reset</button></div>{finance.transactions.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">কোনো ledger transaction নেই।</p> : filteredTransactions.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">এই filter অনুযায়ী কোনো transaction পাওয়া যায়নি।</p> : <><p className="px-5 pt-4 text-xs font-semibold text-slate-500">দেখানো হচ্ছে {filteredTransactions.length.toLocaleString('bn-BD')}টি transaction</p><div className="divide-y divide-slate-100">{filteredTransactions.map((item) => <div key={item.id} className="flex flex-col gap-1 px-5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-slate-800">{item.user_name || item.user_id}</p><p className="text-xs text-slate-500">{item.type} · {item.description || '—'} · {formatDateTime(item.created_at)}</p></div><span className={`font-bold ${Number(item.amount) >= 0 ? 'text-brand-700' : 'text-red-600'}`}>{Number(item.amount) >= 0 ? '+' : ''}{formatTaka(Number(item.amount))}</span></div>)}</div></>}</AdminTableCard>
      <AdminTableCard>
        {loading ? <p className="p-10 text-center text-sm text-slate-500">লোড হচ্ছে...</p> : rows.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">কোনো payout request নেই।</p> : (
          <div className="divide-y divide-slate-100">
            {rows.map((row) => {
              const available = Number(row.available_balance ?? 0)
              const reserved = Number(row.reserved_amount ?? 0)
              const spendable = Number(row.spendable_balance ?? Math.max(available - reserved, 0))
              const terminal = row.status === 'REJECTED' || row.status === 'PAID'
              const overReserved = reserved > available
              return (
                <div key={row.id} className="space-y-3 px-5 py-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-800">{formatTaka(row.amount)} · {row.method}</p>
                      <p className="mt-1 text-xs text-slate-400">Seller UID: {row.user_id} · {formatDateTime(row.requested_at)}</p>
                      <p className="mt-1 text-sm text-slate-600">Account: {row.account_details}</p>
                      <p className="mt-1 text-xs text-ink-500">Wallet: {formatTaka(available)} · Reserved: {formatTaka(reserved)} · Spendable: {formatTaka(spendable)}</p>
                      {overReserved && !terminal && <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs leading-5 text-red-700">Active payout-এর মোট reserved amount wallet balance-এর চেয়ে বেশি। Duplicate/অতিরিক্ত request Reject করুন।</p>}
                    </div>
                    <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${row.status === 'PAID' ? 'bg-brand-50 text-brand-700' : row.status === 'REJECTED' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{labels[row.status] ?? row.status}</span>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input value={note[row.id] ?? row.admin_note ?? ''} onChange={(e) => setNote({ ...note, [row.id]: e.target.value })} disabled={terminal} placeholder={terminal ? 'এই payout বন্ধ হয়ে গেছে' : 'Admin note (ঐচ্ছিক)'} className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400" />
                    {row.status === 'PENDING' && <>
                      <button type="button" onClick={() => void review(row, 'APPROVED')} disabled={processingId === row.id} className="rounded-xl border border-brand-200 px-3 py-2 text-sm font-semibold text-brand-700 disabled:opacity-50">Approve</button>
                      <button type="button" onClick={() => void review(row, 'REJECTED')} disabled={processingId === row.id} className="rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">Reject</button>
                    </>}
                    {row.status === 'APPROVED' && <>
                      <button type="button" onClick={() => void review(row, 'REJECTED')} disabled={processingId === row.id} className="rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">Reject before paid</button>
                      <button type="button" onClick={() => void review(row, 'PAID')} disabled={processingId === row.id || available < Number(row.amount) || overReserved} title={overReserved ? 'আগে duplicate বা অতিরিক্ত payout Reject করুন' : available < Number(row.amount) ? 'Seller wallet balance কম' : undefined} className="rounded-xl bg-brand-500 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{processingId === row.id ? 'প্রক্রিয়া চলছে...' : 'Mark paid'}</button>
                    </>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </AdminTableCard>
      {error && <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    </AdminShell>
  )
}
