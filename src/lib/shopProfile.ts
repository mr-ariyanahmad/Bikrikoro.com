import { auth } from '@/lib/firebase'
import { supabase } from '@/lib/supabase'

export type ShopUsernameCheck = {
  is_available: boolean
  normalized_username: string
  suggestions: string[]
}

export function normalizeShopUsername(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export async function checkShopUsername(username: string, userId?: string | null) {
  const { data, error } = await supabase.rpc('check_shop_username', {
    p_username: username,
    p_user_id: userId ?? null,
  })
  if (error) throw error
  const row = (Array.isArray(data) ? data[0] : data) as ShopUsernameCheck | null
  return {
    is_available: Boolean(row?.is_available),
    normalized_username: row?.normalized_username ?? normalizeShopUsername(username),
    suggestions: Array.isArray(row?.suggestions) ? row.suggestions : [],
  }
}

export async function updateSellerShopProfile(params: {
  shopName: string
  shopDescription: string
  shopUsername: string
  photoUrl: string | null
  coverUrl: string | null
}) {
  const idToken = await auth.currentUser?.getIdToken()
  if (!idToken) throw new Error('সেলার প্রোফাইল সম্পাদনা করতে আবার লগইন করুন।')
  const response = await fetch('/api/seller-profile', {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  const payload = await response.json().catch(() => ({})) as { error?: string; profile?: Record<string, unknown> }
  if (!response.ok) throw new Error(payload.error || 'সেলার প্রোফাইল সংরক্ষণ করা যায়নি।')
  return payload.profile
}

export function shopUrl(shopUsername: string | null | undefined, sellerId: string) {
  return shopUsername?.trim() ? `/seller/${encodeURIComponent(shopUsername.trim())}` : `/sellers/${encodeURIComponent(sellerId)}`
}

/** Avoid rendering raw Firebase/Supabase identifiers or accidental keyboard-garble as public-facing names. */
export function isIdentifierLikeProfileText(value: string | null | undefined) {
  const text = value?.trim() ?? ''
  if (!text) return true
  if (/^[A-Za-z0-9_-]{18,}$/.test(text)) return true
  return /[;[\]\\]/.test(text) && /[A-Za-z]/.test(text)
}

export function displayShopName(shopName: string | null | undefined, userName: string | null | undefined, fallback = 'বিক্রেতা') {
  if (!isIdentifierLikeProfileText(shopName)) return shopName!.trim()
  if (!isIdentifierLikeProfileText(userName)) return userName!.trim()
  return fallback
}

export function displayUserName(userName: string | null | undefined, fallback = 'ব্যবহারকারী') {
  return isIdentifierLikeProfileText(userName) ? fallback : userName!.trim()
}

export function displayShopDescription(description: string | null | undefined) {
  return isIdentifierLikeProfileText(description) ? '' : description!.trim()
}
