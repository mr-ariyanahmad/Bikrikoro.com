import { supabase } from '@/lib/supabase'

export interface PaymentMethodConfig {
  name: string
  color: string
  short: string
}

type PublicSettingValue = string | { value?: unknown } | unknown[] | Record<string, unknown> | null

const DEFAULT_PAYMENT_METHODS: PaymentMethodConfig[] = [
  { name: 'bKash', color: '#E2136E', short: 'bKash' },
  { name: 'Nagad', color: '#F4821F', short: 'Nagad' },
  { name: 'Rocket', color: '#8B1FA9', short: 'Rocket' },
  { name: 'Upay', color: '#00A651', short: 'উপায়' },
  { name: 'City Bank', color: '#1B4F8A', short: 'City' },
  { name: 'Islami Bank', color: '#006633', short: 'IBBL' },
  { name: 'Agrani Bank', color: '#004B87', short: 'Agrani' },
  { name: 'Pubali Bank', color: '#C41E3A', short: 'Pubali' },
  { name: 'UCB', color: '#003087', short: 'UCB' },
]

const DEFAULT_TRENDING_SEARCHES = ['গেম অ্যাকাউন্ট', 'প্রিমিয়াম সাবস্ক্রিপশন', 'গিফট কার্ড', 'সফটওয়্যার লাইসেন্স', 'ডিজাইন অ্যাসেট']

let publicSettingsPromise: Promise<Record<string, PublicSettingValue>> | null = null

function unwrapSetting(value: PublicSettingValue): PublicSettingValue {
  if (value && typeof value === 'object' && !Array.isArray(value) && 'value' in value) return value.value as PublicSettingValue
  return value
}

export async function loadPublicSettings(): Promise<Record<string, PublicSettingValue>> {
  if (!publicSettingsPromise) {
    publicSettingsPromise = Promise.resolve(supabase.rpc('get_public_settings', { p_prefix: 'public_' }))
      .then(({ data, error }) => {
        if (error) throw error
        return Object.fromEntries(((data ?? []) as Array<{ setting_key: string; setting_value: PublicSettingValue }>).map((row) => [row.setting_key, unwrapSetting(row.setting_value)]))
      })
      .catch((error) => {
        publicSettingsPromise = null
        console.warn('Public settings load failed:', error)
        return {}
      })
  }
  return publicSettingsPromise
}

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value)
}

export function getPaymentMethods(settings: Record<string, PublicSettingValue>): PaymentMethodConfig[] {
  const value = unwrapSetting(settings.public_payment_methods)
  let parsed: unknown = value
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value) } catch { parsed = null }
  }
  if (!Array.isArray(parsed)) return DEFAULT_PAYMENT_METHODS
  const methods = parsed.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item) => ({
      name: typeof item.name === 'string' ? item.name.trim() : '',
      color: isHexColor(item.color) ? item.color : '#017C50',
      short: typeof item.short === 'string' && item.short.trim() ? item.short.trim() : typeof item.name === 'string' ? item.name.trim() : '',
    }))
    .filter((item) => item.name && item.short)
  return methods.length > 0 ? methods.slice(0, 12) : DEFAULT_PAYMENT_METHODS
}

export function getTrendingSearches(settings: Record<string, PublicSettingValue>): string[] {
  const value = unwrapSetting(settings.public_trending_searches)
  let parsed: unknown = value
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value) } catch { parsed = value.split(/[\n,]+/) }
  }
  if (!Array.isArray(parsed)) return DEFAULT_TRENDING_SEARCHES
  const terms = parsed.filter((term): term is string => typeof term === 'string').map((term) => term.trim()).filter(Boolean)
  return terms.length > 0 ? terms.slice(0, 8) : DEFAULT_TRENDING_SEARCHES
}

export { DEFAULT_PAYMENT_METHODS, DEFAULT_TRENDING_SEARCHES }
