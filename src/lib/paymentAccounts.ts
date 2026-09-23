import { auth } from '@/lib/firebase'

export type PaymentProvider = 'BKASH' | 'NAGAD' | 'ROCKET' | 'UPAY'
export type PaymentPurpose = 'SELLER_RECEIVE' | 'BUYER_REFUND'
export type PaymentTransactionType = 'CASH_IN' | 'CASH_OUT' | 'SEND_MONEY' | 'PAYMENT'
export type PaymentAccountType = 'PERSONAL' | 'MERCHANT'

export interface PaymentAccount {
  id: string
  provider: PaymentProvider
  purpose: PaymentPurpose
  transaction_type: PaymentTransactionType
  account_type: PaymentAccountType
  account_number: string
  account_holder_name: string | null
  merchant_name: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

export type PaymentAccountInput = {
  id?: string
  provider: PaymentProvider
  purpose: PaymentPurpose
  transactionType: PaymentTransactionType
  accountType: PaymentAccountType
  accountNumber: string
  accountHolderName?: string
  merchantName?: string
  isDefault?: boolean
}

async function request<T>(body?: Record<string, unknown>): Promise<T> {
  const idToken = await auth.currentUser?.getIdToken()
  if (!idToken) throw new Error('আপনার Firebase session পাওয়া যায়নি। আবার login করুন।')
  const response = await fetch('/api/payment-accounts', {
    method: body ? 'POST' : 'GET',
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), Authorization: `Bearer ${idToken}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const payload = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) throw new Error(payload.error || 'পেমেন্ট অ্যাকাউন্টের তথ্য লোড করা যায়নি।')
  return payload
}

export async function listPaymentAccounts(purpose?: PaymentPurpose) {
  const query = purpose ? `?purpose=${encodeURIComponent(purpose)}` : ''
  const idToken = await auth.currentUser?.getIdToken()
  if (!idToken) throw new Error('আপনার Firebase session পাওয়া যায়নি। আবার login করুন।')
  const response = await fetch(`/api/payment-accounts${query}`, { headers: { Authorization: `Bearer ${idToken}` } })
  const payload = await response.json().catch(() => ({})) as { accounts?: PaymentAccount[]; error?: string }
  if (!response.ok) throw new Error(payload.error || 'পেমেন্ট অ্যাকাউন্টের তথ্য লোড করা যায়নি।')
  return payload.accounts ?? []
}

export async function savePaymentAccount(input: PaymentAccountInput) {
  return request<{ account: PaymentAccount }>({ action: input.id ? 'update' : 'create', ...input })
}

export async function deletePaymentAccount(id: string) {
  return request<{ ok: true }>({ action: 'delete', id })
}

export async function setDefaultPaymentAccount(id: string) {
  return request<{ ok: true }>({ action: 'set_default', id })
}
