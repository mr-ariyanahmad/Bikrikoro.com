import { formatTaka } from '@/lib/format'

export function BalanceCard({
  balance,
  onWithdrawClick,
}: {
  balance: number | null
  onWithdrawClick: () => void
}) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 p-6 text-white shadow-lg shadow-brand-600/20 sm:p-8">
      <p className="text-sm font-medium text-brand-50/80">উপলব্ধ ব্যালেন্স</p>
      <p className="tabular-amount mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
        {balance === null ? '···' : formatTaka(balance)}
      </p>
      <button
        onClick={onWithdrawClick}
        disabled={balance === null || balance <= 0}
        className="mt-6 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        উত্তোলন করুন
      </button>
    </div>
  )
}
