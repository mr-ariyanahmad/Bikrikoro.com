import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase, getVerifiedFirebaseToken, isAuthError } from './_server-auth.js'

type Body = {
  action?: 'create' | 'update' | 'delete' | 'set_default'
  id?: string
  purpose?: 'SELLER_RECEIVE' | 'BUYER_REFUND'
  provider?: 'BKASH' | 'NAGAD' | 'ROCKET' | 'UPAY'
  transactionType?: 'CASH_IN' | 'CASH_OUT' | 'SEND_MONEY' | 'PAYMENT'
  accountType?: 'PERSONAL' | 'MERCHANT'
  accountNumber?: string
  accountHolderName?: string
  merchantName?: string
  isDefault?: boolean
}

function bodyOf(req: VercelRequest): Body {
  if (typeof req.body === 'string') return JSON.parse(req.body) as Body
  return (req.body ?? {}) as Body
}

function purposeFromRequest(req: VercelRequest) {
  const value = Array.isArray(req.query.purpose) ? req.query.purpose[0] : req.query.purpose
  return value === 'SELLER_RECEIVE' || value === 'BUYER_REFUND' ? value : undefined
}

function maskAccount(value: string) {
  const digits = value.replace(/\s+/g, '')
  return digits.length <= 4 ? digits : `${digits.slice(0, 3)}••••${digits.slice(-3)}`
}

function validateInput(input: Body) {
  if (!input.purpose || !['SELLER_RECEIVE', 'BUYER_REFUND'].includes(input.purpose)) throw new Error('পেমেন্ট অ্যাকাউন্টের ব্যবহার নির্বাচন করুন।')
  if (!input.provider || !['BKASH', 'NAGAD', 'ROCKET', 'UPAY'].includes(input.provider)) throw new Error('সঠিক mobile wallet নির্বাচন করুন।')
  if (!input.transactionType || !['CASH_IN', 'CASH_OUT', 'SEND_MONEY', 'PAYMENT'].includes(input.transactionType)) throw new Error('লেনদেনের ধরন নির্বাচন করুন।')
  if (!input.accountType || !['PERSONAL', 'MERCHANT'].includes(input.accountType)) throw new Error('অ্যাকাউন্টের ধরন নির্বাচন করুন।')
  const number = input.accountNumber?.replace(/\s+/g, '').trim() ?? ''
  if (!/^01\d{9}$/.test(number)) throw new Error('১১ সংখ্যার সঠিক বাংলাদেশি মোবাইল নম্বর দিন।')
  if (input.accountType === 'MERCHANT' && !input.merchantName?.trim()) throw new Error('Merchant account হলে merchant name দিন।')
  if (input.accountType === 'PERSONAL' && !input.accountHolderName?.trim()) throw new Error('Personal account হলে account holder-এর নাম দিন।')
  return number
}

function publicAccount(row: Record<string, unknown>) {
  return {
    id: row.id,
    provider: row.provider,
    purpose: row.purpose,
    transaction_type: row.transaction_type,
    account_type: row.account_type,
    account_number: maskAccount(String(row.account_number ?? '')),
    account_holder_name: row.account_holder_name ?? null,
    merchant_name: row.merchant_name ?? null,
    is_default: row.is_default === true,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const token = await getVerifiedFirebaseToken(req)
    const supabase = getServiceSupabase()

    if (req.method === 'GET') {
      const purpose = purposeFromRequest(req)
      let query = supabase.from('payment_accounts').select('id, provider, purpose, transaction_type, account_type, account_number, account_holder_name, merchant_name, is_default, created_at, updated_at').eq('user_id', token.uid).order('is_default', { ascending: false }).order('created_at', { ascending: false })
      if (purpose) query = query.eq('purpose', purpose)
      const { data, error } = await query
      if (error) throw error
      res.status(200).json({ accounts: (data ?? []).map((row) => publicAccount(row as Record<string, unknown>)) })
      return
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST')
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    const input = bodyOf(req)
    if (input.action === 'delete' || input.action === 'set_default') {
      if (!input.id) throw new Error('Payment account id is required')
      const { data: existing, error: existingError } = await supabase.from('payment_accounts').select('id, user_id, purpose').eq('id', input.id).eq('user_id', token.uid).maybeSingle()
      if (existingError) throw existingError
      if (!existing) throw new Error('পেমেন্ট অ্যাকাউন্ট পাওয়া যায়নি।')
      if (input.action === 'delete') {
        const { error } = await supabase.from('payment_accounts').delete().eq('id', input.id).eq('user_id', token.uid)
        if (error) throw error
        res.status(200).json({ ok: true })
        return
      }
      const { error: clearError } = await supabase.from('payment_accounts').update({ is_default: false, updated_at: new Date().toISOString() }).eq('user_id', token.uid).eq('purpose', existing.purpose)
      if (clearError) throw clearError
      const { error } = await supabase.from('payment_accounts').update({ is_default: true, updated_at: new Date().toISOString() }).eq('id', input.id).eq('user_id', token.uid)
      if (error) throw error
      res.status(200).json({ ok: true })
      return
    }

    const accountNumber = validateInput(input)
    if (input.action !== 'create' && input.action !== 'update') throw new Error('Unsupported payment account action')
    if (input.action === 'update' && !input.id) throw new Error('Payment account id is required')

    if (input.isDefault !== false) {
      const { error } = await supabase.from('payment_accounts').update({ is_default: false, updated_at: new Date().toISOString() }).eq('user_id', token.uid).eq('purpose', input.purpose)
      if (error) throw error
    }

    const payload = {
      user_id: token.uid,
      purpose: input.purpose,
      provider: input.provider,
      transaction_type: input.transactionType,
      account_type: input.accountType,
      account_number: accountNumber,
      account_holder_name: input.accountHolderName?.trim() || null,
      merchant_name: input.merchantName?.trim() || null,
      is_default: input.isDefault !== false,
      updated_at: new Date().toISOString(),
    }
    const query = input.action === 'update'
      ? supabase.from('payment_accounts').update(payload).eq('id', input.id).eq('user_id', token.uid).select('id, provider, purpose, transaction_type, account_type, account_number, account_holder_name, merchant_name, is_default, created_at, updated_at').single()
      : supabase.from('payment_accounts').insert(payload).select('id, provider, purpose, transaction_type, account_type, account_number, account_holder_name, merchant_name, is_default, created_at, updated_at').single()
    const { data, error } = await query
    if (error) throw error
    res.status(200).json({ account: publicAccount(data as Record<string, unknown>) })
  } catch (error) {
    if (isAuthError(error)) {
      res.status(401).json({ error: 'Firebase authentication is required' })
      return
    }
    console.error('Payment account action failed:', error)
    res.status(400).json({ error: error instanceof Error ? error.message : 'পেমেন্ট অ্যাকাউন্ট সেভ করা যায়নি।' })
  }
}
