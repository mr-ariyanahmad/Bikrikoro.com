/** Mirrors supabase/migrations/008_wallet.sql — keep these two in sync by hand. */

export type WalletLedgerType = 'ORDER_REFUND' | 'SELLER_PAYOUT' | 'WITHDRAWAL' | 'ADJUSTMENT'

export type WithdrawalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID'

export type WithdrawalMethod = 'BKASH' | 'NAGAD' | 'BANK'

export interface WalletBalance {
  user_id: string
  available_balance: number
  updated_at: string
}

export interface WalletWithdrawalSummary {
  available_balance: number
  reserved_amount: number
  spendable_balance: number
  pending_amount: number
  approved_amount: number
}

export interface WalletLedgerEntry {
  id: string
  user_id: string
  type: WalletLedgerType
  amount: number
  order_id: string | null
  withdrawal_request_id: string | null
  description: string
  created_at: string
}

export interface WithdrawalRequest {
  id: string
  user_id: string
  amount: number
  method: WithdrawalMethod
  account_details: string
  status: WithdrawalStatus
  admin_note: string | null
  requested_at: string
  processed_at: string | null
}
