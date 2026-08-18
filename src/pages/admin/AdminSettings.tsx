import { useEffect, useState } from 'react'
import { AdminPageHeader, AdminShell, AdminTableCard } from '@/components/admin/AdminShell'
import { supabase } from '@/lib/supabase'
import { formatAdminRpcError } from '@/lib/adminRpcError'
import { useAuth } from '@/context/AuthContext'

type Mode = 'invoice' | 'site'
export default function AdminSettings({ mode }: { mode: Mode }) {
  const { user } = useAuth()
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const keys = mode === 'invoice' ? ['invoice_prefix', 'invoice_business_name', 'invoice_phone', 'invoice_address'] : ['site_name', 'site_support_email', 'site_support_phone', 'site_announcement', 'public_seo_title', 'public_seo_description', 'public_seo_og_image', 'public_seo_google_verification', 'reward_daily_checkin_coins', 'ai_help_enabled', 'ai_help_disclaimer']
  useEffect(() => {
    supabase.rpc('admin_get_settings', { p_admin_id: user?.uid, p_prefix: mode === 'invoice' ? 'invoice' : null }).then(({ data, error }) => {
      if (error) setMessage(formatAdminRpcError(error, 'সেটিংস data', '014 admin workspace migration'))
      const next: Record<string, string> = {}
      ;(data ?? []).forEach((row: { setting_key: string; setting_value: { value?: string } | string }) => { next[row.setting_key] = typeof row.setting_value === 'string' ? row.setting_value : row.setting_value?.value ?? '' })
      setValues(next); setLoading(false)
    })
  }, [mode, user?.uid])
  const save = async () => {
    setSaving(true); setMessage(null)
    for (const key of keys) {
      const { error } = await supabase.rpc('admin_upsert_setting', { p_admin_id: user?.uid, p_key: key, p_value: { value: values[key] ?? '' } })
      if (error) { setMessage(formatAdminRpcError(error, 'সেটিংস save', '014 admin workspace migration')); setSaving(false); return }
    }
    setSaving(false); setMessage('সেটিংস সেভ হয়েছে।')
  }
  const title = mode === 'invoice' ? 'ইনভয়েস সেটিংস' : 'সাইট সেটিংস ও ফিচার কন্ট্রোল'
  return <AdminShell><AdminPageHeader title={title} description={mode === 'invoice' ? 'Receipt ও invoice-এ যে business তথ্য দেখাবে তা সেট করুন।' : 'সাইটের brand, support এবং announcement তথ্য ম্যানেজ করুন।'} /><AdminTableCard><div className="space-y-4 p-5">{loading ? <div className="h-48 animate-pulse rounded-xl bg-slate-100" /> : <>{keys.map((key) => <label key={key} className="block text-sm text-slate-600"><span className="mb-1 block font-medium text-slate-800">{labelFor(key)}</span>{key.includes('address') || key.includes('announcement') ? <textarea value={values[key] ?? ''} onChange={(e) => setValues({ ...values, [key]: e.target.value })} rows={3} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-brand-500" /> : <input value={values[key] ?? ''} onChange={(e) => setValues({ ...values, [key]: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-brand-500" />}</label>)}<button onClick={save} disabled={saving} className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'সেভ হচ্ছে...' : 'পরিবর্তন সেভ করুন'}</button></>}</div></AdminTableCard>{message && <p className={`mt-4 rounded-xl p-4 text-sm ${message.includes('হয়েছে') ? 'bg-brand-50 text-brand-700' : 'bg-red-50 text-red-700'}`}>{message}</p>}</AdminShell>
}
function labelFor(key: string) { const labels: Record<string, string> = { invoice_prefix: 'Invoice prefix', invoice_business_name: 'Business name', invoice_phone: 'Business phone', invoice_address: 'Business address', site_name: 'Site name', site_support_email: 'Support email', site_support_phone: 'Support phone', site_announcement: 'Site announcement', public_seo_title: 'Default SEO title', public_seo_description: 'Default SEO description', public_seo_og_image: 'Default Open Graph image URL', public_seo_google_verification: 'Google Search Console verification code', reward_daily_checkin_coins: 'দৈনিক check-in কয়েন', ai_help_enabled: 'AI Help চালু/বন্ধ (true/false)', ai_help_disclaimer: 'AI Help disclaimer' }; return labels[key] ?? key }
