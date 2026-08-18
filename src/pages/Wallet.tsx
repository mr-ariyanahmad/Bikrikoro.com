import { useEffect, useState, useCallback } from 'react'
import { Download, Filter } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { auth } from '@/lib/firebase'
import { Layout } from '@/components/Layout'
import { BalanceCard } from '@/components/BalanceCard'
import { LedgerThread } from '@/components/LedgerThread'
import { BrandSelect } from '@/components/BrandSelect'
import { WithdrawModal } from '@/components/WithdrawModal'
import type { WalletBalance, WalletLedgerEntry } from '@/types/wallet'

export default function Wallet() {
  const { user } = useAuth()
  const uid = user!.uid

  const [balance, setBalance] = useState<WalletBalance | null>(null)
  const [entries, setEntries] = useState<WalletLedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [entryFilter, setEntryFilter] = useState<'all' | 'credit' | 'debit'>('all')

  const loadWallet = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) throw new Error('আপনার Firebase session পাওয়া যায়নি।')
      const response = await fetch('/api/order-read', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }, body: JSON.stringify({ action: 'wallet' }) })
      const payload = await response.json().catch(() => ({})) as { error?: string; balance?: WalletBalance; ledger?: WalletLedgerEntry[] }
      if (!response.ok) throw new Error(payload.error || `Wallet load failed (HTTP ${response.status})`)
      setBalance(payload.balance ?? { user_id: uid, available_balance: 0, updated_at: new Date().toISOString() })
      setEntries(payload.ledger ?? [])
    } catch (error) {
      console.error('Wallet load failed:', error)
      setLoadError(error instanceof Error ? error.message : 'ওয়ালেট লোড করা যায়নি।')
    } finally {
      setLoading(false)
    }
  }, [uid])

  useEffect(() => {
    loadWallet()

    // Balance and ledger update the moment a seller-cancelled order
    // refunds the buyer, a sale completes, or a withdrawal is marked
    // paid — all server-side, this just reflects it live.
    const channel = supabase
      .channel(`wallet-${uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wallet_balances', filter: `user_id=eq.${uid}` },
        loadWallet
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wallet_ledger', filter: `user_id=eq.${uid}` },
        loadWallet
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [uid, loadWallet])

  const visibleEntries = entries.filter((entry) => entryFilter === 'all' || (entryFilter === 'credit' ? entry.amount >= 0 : entry.amount < 0))
  const exportCsv = () => {
    const rows = [['তারিখ', 'ধরন', 'বিবরণ', 'পরিমাণ'], ...visibleEntries.map((entry) => [new Date(entry.created_at).toLocaleString('bn-BD'), entry.type, entry.description, String(entry.amount)])]
    const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'bikrikoro-wallet.csv'; anchor.click(); URL.revokeObjectURL(url)
  }

  return (
    <Layout wide>
      {loading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-outline/40" />
      ) : (
        <>
          {loadError && <p className="mb-4 border border-error/20 bg-error/5 p-3 text-sm text-error">ওয়ালেট লোড করা যায়নি: {loadError}</p>}
          <BalanceCard
            balance={balance?.available_balance ?? 0}
            onWithdrawClick={() => setShowWithdraw(true)}
          />

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-semibold tracking-wide text-ink-600 uppercase">লেনদেনের হিস্ট্রি</h2><div className="flex items-center gap-2"><div className="flex min-w-32 items-center gap-1"><Filter size={14} className="text-ink-400" /><BrandSelect label="লেনদেনের ধরন" value={entryFilter} options={[{ value: 'all', label: 'সব' }, { value: 'credit', label: 'জমা' }, { value: 'debit', label: 'খরচ' }]} onChange={(value) => setEntryFilter(value as typeof entryFilter)} /></div><button type="button" onClick={exportCsv} disabled={visibleEntries.length === 0} className="inline-flex items-center gap-1.5 rounded-xl border border-outline px-3 py-2 text-xs font-semibold text-ink-600 hover:border-brand-500 hover:text-brand-600 disabled:opacity-40"><Download size={14} />CSV</button></div></div>
          <LedgerThread entries={visibleEntries} />
        </>
      )}

      {showWithdraw && balance && (
        <WithdrawModal
          userId={uid}
          availableBalance={balance.available_balance}
          onClose={() => setShowWithdraw(false)}
          onSuccess={() => {
            setShowWithdraw(false)
            setToast('উত্তোলনের অনুরোধ জমা হয়েছে — পর্যালোচনার পর টাকা পাঠানো হবে।')
            setTimeout(() => setToast(null), 4000)
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-xl bg-ink-900 px-4 py-3 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </Layout>
  )
}
