import type { WalletLedgerEntry } from '@/types/wallet'
import { formatTaka, formatDateTime } from '@/lib/format'

const TYPE_LABEL: Record<WalletLedgerEntry['type'], string> = {
  ORDER_REFUND: 'রিফান্ড',
  SELLER_PAYOUT: 'বিক্রয় পেআউট',
  WITHDRAWAL: 'উত্তোলন',
  ADJUSTMENT: 'সমন্বয়',
  WALLET_ORDER_PAYMENT: 'ওয়ালেট অর্ডার পেমেন্ট',
}

export function LedgerThread({ entries }: { entries: WalletLedgerEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-outline bg-surface p-8 text-center">
        <p className="text-ink-600">এখনো কোনো লেনদেন হয়নি।</p>
        <p className="mt-1 text-sm text-ink-300">
          কোনো অর্ডার বাতিল হলে রিফান্ড, অথবা বিক্রি সম্পন্ন হলে পেআউট এখানে দেখা যাবে।
        </p>
      </div>
    )
  }

  return (
    <ol className="relative">
      {entries.map((entry, i) => {
        const isCredit = entry.amount >= 0
        const isLast = i === entries.length - 1

        return (
          <li key={entry.id} className="relative flex gap-4 pb-6 last:pb-0">
            {!isLast && (
              <span className="absolute top-7 left-[15px] h-full w-px bg-outline" aria-hidden />
            )}
            <span
              className={`relative mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                isCredit ? 'bg-brand-100 text-brand-600' : 'bg-red-50 text-error'
              }`}
            >
              {isCredit ? '+' : '−'}
            </span>

            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-900">
                    {TYPE_LABEL[entry.type]}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-ink-600">{entry.description}</p>
                </div>
                <span
                  className={`tabular-amount shrink-0 text-sm font-semibold ${
                    isCredit ? 'text-brand-600' : 'text-error'
                  }`}
                >
                  {isCredit ? '+' : ''}
                  {formatTaka(entry.amount)}
                </span>
              </div>
              <p className="mt-1 text-xs text-ink-300">{formatDateTime(entry.created_at)}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
