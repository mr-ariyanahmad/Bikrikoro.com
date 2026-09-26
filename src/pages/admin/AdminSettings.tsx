import { useEffect, useState } from 'react'
import { AdminPageHeader, AdminShell, AdminTableCard } from '@/components/admin/AdminShell'
import { formatAdminRpcError } from '@/lib/adminRpcError'
import { useAuth } from '@/context/AuthContext'
import { adminRpc } from '@/lib/adminRpc'
import { DEFAULT_PAYMENT_METHODS, DEFAULT_TRENDING_SEARCHES } from '@/lib/publicSettings'
import { uploadProductImages } from '@/lib/storage'

type Mode = 'invoice' | 'site' | 'commission'

export default function AdminSettings({ mode }: { mode: Mode }) {
  const { user } = useAuth()
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [ogImageFile, setOgImageFile] = useState<File | null>(null)
  const keys = mode === 'invoice'
    ? ['invoice_prefix', 'invoice_business_name', 'invoice_phone', 'invoice_address']
    : mode === 'commission'
      ? ['commission_customer_rate', 'commission_seller_rate']
      : ['site_name', 'site_support_email', 'site_support_phone', 'public_support_email', 'public_support_phone', 'site_announcement', 'public_seo_title', 'public_seo_description', 'public_seo_og_image', 'public_seo_google_verification', 'public_payment_methods', 'public_trending_searches', 'reward_daily_checkin_coins', 'ai_help_enabled', 'ai_help_disclaimer']

  useEffect(() => {
    setLoading(true)
    setMessage(null)
    adminRpc('admin_get_settings', { p_admin_id: user?.uid, p_prefix: mode === 'invoice' ? 'invoice' : mode === 'commission' ? 'commission' : null }).then(({ data, error }) => {
      if (error) setMessage(formatAdminRpcError(error, 'সেটিংস data', '014 admin workspace migration'))
      const next: Record<string, string> = {}
      ;(data ?? []).forEach((row: { setting_key: string; setting_value: { value?: string } | string }) => { next[row.setting_key] = typeof row.setting_value === 'string' ? row.setting_value : row.setting_value?.value ?? '' })
      if (mode === 'commission') {
        if (!next.commission_customer_rate) next.commission_customer_rate = '1'
        if (!next.commission_seller_rate) next.commission_seller_rate = '0'
      }
      if (mode === 'site') {
        if (!next.public_payment_methods) next.public_payment_methods = JSON.stringify(DEFAULT_PAYMENT_METHODS, null, 2)
        if (!next.public_trending_searches) next.public_trending_searches = DEFAULT_TRENDING_SEARCHES.join(', ')
      }
      setValues(next)
      setLoading(false)
    })
  }, [mode, user?.uid])

  const save = async () => {
    setSaving(true); setMessage(null)
    if (mode === 'commission') {
      const customerRate = Number(values.commission_customer_rate)
      const sellerRate = Number(values.commission_seller_rate)
      if (!Number.isFinite(customerRate) || !Number.isFinite(sellerRate) || customerRate < 0 || customerRate > 100 || sellerRate < 0 || sellerRate > 100) {
        setMessage('কমিশন ০% থেকে ১০০%-এর মধ্যে দিতে হবে।')
        setSaving(false)
        return
      }
      const { error } = await adminRpc('admin_set_commission_rates', { p_admin_id: user?.uid, p_customer_rate: Number(customerRate.toFixed(2)), p_seller_rate: Number(sellerRate.toFixed(2)) })
      if (error) setMessage(formatAdminRpcError(error, 'কমিশন save', '133 admin commission controls migration'))
      else setMessage('কমিশন সেটিংস সেভ হয়েছে। নতুন অর্ডারে এই rate প্রযোজ্য হবে।')
      setSaving(false)
      return
    }
    if (ogImageFile && user?.uid) {
      const [uploadedUrl] = await uploadProductImages([ogImageFile], `admin-settings/${user.uid}`)
      if (!uploadedUrl) { setMessage('Open Graph image আপলোড করা যায়নি।'); setSaving(false); return }
      setValues((current) => ({ ...current, public_seo_og_image: uploadedUrl }))
      values.public_seo_og_image = uploadedUrl
    }
    for (const key of keys) {
      const { error } = await adminRpc('admin_upsert_setting', { p_admin_id: user?.uid, p_key: key, p_value: { value: values[key] ?? '' } })
      if (error) { setMessage(formatAdminRpcError(error, 'সেটিংস save', '014 admin workspace migration')); setSaving(false); return }
    }
    setSaving(false); setMessage('সেটিংস সেভ হয়েছে।')
  }

  const title = mode === 'invoice' ? 'ইনভয়েস সেটিংস' : mode === 'commission' ? 'কমিশন কন্ট্রোল' : 'সাইট সেটিংস ও ফিচার কন্ট্রোল'
  const description = mode === 'invoice' ? 'Receipt ও invoice-এ যে business তথ্য দেখাবে তা সেট করুন।' : mode === 'commission' ? 'Customer-এর কাছ থেকে platform fee এবং seller payout থেকে commission আলাদা করে নির্ধারণ করুন।' : 'সাইটের brand, support এবং announcement তথ্য ম্যানেজ করুন।'

  return <AdminShell>
    <AdminPageHeader title={title} description={description} />
    {mode === 'commission' && <div className="mb-5 grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-brand-100 bg-brand-50 p-5"><p className="text-sm font-bold text-brand-800">Customer commission</p><p className="mt-1 text-sm leading-6 text-brand-700">Checkout-এর সময় product price-এর উপর এই percentage যোগ হবে। ০% দিলে customer fee থাকবে না।</p></div><div className="rounded-2xl border border-amber-100 bg-amber-50 p-5"><p className="text-sm font-bold text-amber-800">Seller commission</p><p className="mt-1 text-sm leading-6 text-amber-700">Order completed হলে seller-এর eligible payout থেকে এই percentage কেটে রাখা হবে। পুরনো order-এর rate পরিবর্তন হবে না।</p></div></div>}
    <AdminTableCard><div className="space-y-4 p-5">
      {loading ? <div className="h-48 animate-pulse rounded-xl bg-slate-100" /> : <>
        {keys.map((key) => key === 'public_seo_og_image' ? <label key={key} className="block text-sm text-slate-600"><span className="mb-1 block font-medium text-slate-800">Default Open Graph image</span><span className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-brand-300 bg-brand-50/50 px-3 py-3"><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={(event) => { setOgImageFile(event.target.files?.[0] ?? null); event.target.value = '' }} /><span className="font-semibold text-brand-700">ছবি আপলোড করুন</span><span className="truncate text-slate-500">{ogImageFile?.name || (values[key] ? 'বর্তমান Open Graph image আছে' : 'কোনো ছবি নির্বাচন করা হয়নি')}</span></span></label> : <label key={key} className="block text-sm text-slate-600"><span className="mb-1 block font-medium text-slate-800">{labelFor(key)}</span>{mode === 'commission' ? <div className="relative"><input type="number" min="0" max="100" step="0.01" inputMode="decimal" value={values[key] ?? ''} onChange={(e) => setValues({ ...values, [key]: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 pr-10 outline-none focus:border-brand-500" /><span className="pointer-events-none absolute right-3 top-2.5 font-bold text-slate-400">%</span></div> : key.includes('address') || key.includes('announcement') || key === 'public_payment_methods' || key === 'public_trending_searches' ? <textarea value={values[key] ?? ''} onChange={(e) => setValues({ ...values, [key]: e.target.value })} rows={3} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-brand-500" /> : <input value={values[key] ?? ''} onChange={(e) => setValues({ ...values, [key]: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-brand-500" />}</label>)}
        <button type="button" onClick={() => void save()} disabled={saving} className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'সেভ হচ্ছে...' : 'পরিবর্তন সেভ করুন'}</button>
      </>}
    </div></AdminTableCard>
    {message && <p className={`mt-4 rounded-xl p-4 text-sm ${message.includes('সেভ হয়েছে') ? 'bg-brand-50 text-brand-700' : 'bg-red-50 text-red-700'}`}>{message}</p>}
  </AdminShell>
}

function labelFor(key: string) { const labels: Record<string, string> = { invoice_prefix: 'Invoice prefix', invoice_business_name: 'Business name', invoice_phone: 'Business phone', invoice_address: 'Business address', commission_customer_rate: 'Customer থেকে কমিশন (%)', commission_seller_rate: 'Seller payout থেকে কমিশন (%)', site_name: 'Site name', site_support_email: 'Internal support email', site_support_phone: 'Internal support phone', public_support_email: 'Public support email', public_support_phone: 'Public support phone', site_announcement: 'Site announcement', public_seo_title: 'Default SEO title', public_seo_description: 'Default SEO description', public_seo_og_image: 'Default Open Graph image URL', public_seo_google_verification: 'Google Search Console verification code', public_payment_methods: 'পেমেন্ট পদ্ধতি (JSON)', public_trending_searches: 'জনপ্রিয় সার্চ (কমা দিয়ে আলাদা করুন)', reward_daily_checkin_coins: 'দৈনিক check-in কয়েন', ai_help_enabled: 'AI Help চালু/বন্ধ (true/false)', ai_help_disclaimer: 'AI Help disclaimer' }; return labels[key] ?? key }
