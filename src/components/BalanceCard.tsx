import { formatTaka } from '@/lib/format'

export function BalanceCard({
  balance,
  reservedAmount,
  onWithdrawClick,
}: {
  balance: number | null
  reservedAmount?: number
  onWithdrawClick: () => void
}) {
  const reserved = Number(reservedAmount ?? 0)
  const spendable = balance === null ? null : Math.max(Number(balance) - reserved, 0)

  return (
    <div className="rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 p-6 text-white shadow-lg shadow-brand-600/20 sm:p-8">
      <p className="text-sm font-medium text-brand-50/80">উত্তোলনের জন্য উপলব্ধ</p>
      <p className="tabular-amount mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
        {spendable === null ? '···' : formatTaka(spendable)}
      </p>
      <div className="mt-3 space-y-1 text-xs text-brand-50/80">
        <p>ওয়ালেটের ব্যালেন্স: {balance === null ? '···' : formatTaka(balance)}</p>
        {reserved > 0 && <p>আটকে রাখা অর্থ: {formatTaka(reserved)}</p>}
      </div>
      <button
        onClick={onWithdrawClick}
        disabled={spendable === null || spendable <= 0}
        className="mt-6 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        উত্তোলন করুন
      </button>
    </div>
  )
}
