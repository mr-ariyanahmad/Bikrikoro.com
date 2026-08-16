import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Layout } from '@/components/Layout'
import { BalanceCard } from '@/components/BalanceCard'
import { LedgerThread } from '@/components/LedgerThread'
import { WithdrawModal } from '@/components/WithdrawModal'
import type { WalletBalance, WalletLedgerEntry } from '@/types/wallet'

export default function Wallet() {
  const { user } = useAuth()
  const uid = user!.uid

  const [balance, setBalance] = useState<WalletBalance | null>(null)
  const [entries, setEntries] = useState<WalletLedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const loadWallet = useCallback(async () => {
    const [balanceRes, ledgerRes] = await Promise.all([
      supabase.from('wallet_balances').select('*').eq('user_id', uid).maybeSingle(),
      supabase
        .from('wallet_ledger')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    setBalance(balanceRes.data ?? { user_id: uid, available_balance: 0, updated_at: new Date().toISOString() })
    setEntries(ledgerRes.data ?? [])
    setLoading(false)
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

  return (
    <Layout>
      {loading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-outline/40" />
      ) : (
        <>
          <BalanceCard
            balance={balance?.available_balance ?? 0}
            onWithdrawClick={() => setShowWithdraw(true)}
          />

          <h2 className="mt-8 mb-4 text-sm font-semibold tracking-wide text-ink-600 uppercase">
            লেনদেনের হিস্ট্রি
          </h2>
          <LedgerThread entries={entries} />
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
