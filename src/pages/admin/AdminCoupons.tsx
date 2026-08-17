import { useCallback, useEffect, useState } from 'react'
import { AdminPageHeader, AdminShell, AdminTableCard } from '@/components/admin/AdminShell'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

type Coupon = { code: string; description: string; discount_type: 'PERCENT' | 'FIXED'; discount_value: number; min_subtotal: number; max_redemptions: number | null; redeemed_count: number; active: boolean; active_until: string | null }
type CouponForm = { code: string; description: string; discount_type: 'PERCENT' | 'FIXED'; discount_value: string; min_subtotal: string; max_redemptions: string; active_until: string }
const emptyForm: CouponForm = { code: '', description: '', discount_type: 'PERCENT', discount_value: '', min_subtotal: '', max_redemptions: '', active_until: '' }

export default function AdminCoupons() {
  const { user } = useAuth()
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    setLoading(true)
    supabase.rpc('admin_list_coupons', { p_admin_id: user?.uid }).then(({ data, error: loadError }) => { setCoupons((data ?? []) as Coupon[]); if (loadError) setError('কুপন লোড করা যায়নি। 014 migration প্রয়োগ করা হয়েছে কি না দেখুন।'); setLoading(false) })
  }, [user?.uid])
  useEffect(() => { load() }, [load])
  const save = async () => {
    if (!form.code.trim() || Number(form.discount_value) <= 0) { setError('কোড ও discount value দিন।'); return }
    setSaving(true); setError(null)
    const { error: saveError } = await supabase.rpc('admin_upsert_coupon', { p_admin_id: user?.uid, p_code: form.code.trim().toUpperCase(), p_description: form.description.trim(), p_discount_type: form.discount_type, p_discount_value: Number(form.discount_value), p_min_subtotal: Number(form.min_subtotal || 0), p_max_redemptions: form.max_redemptions ? Number(form.max_redemptions) : null, p_active_until: form.active_until || null })
    setSaving(false)
    if (saveError) { setError('কুপন সেভ করা যায়নি। নতুন admin migration প্রয়োগ করা হয়েছে কি না দেখুন।'); return }
    setForm(emptyForm); setShowForm(false); load()
  }
  const toggle = async (coupon: Coupon) => {
    const { error: updateError } = await supabase.rpc('admin_set_coupon_active', { p_admin_id: user?.uid, p_code: coupon.code, p_active: !coupon.active })
    if (updateError) setError('কুপনের status পরিবর্তন করা যায়নি।'); else load()
  }
  return <AdminShell><AdminPageHeader title="কুপন" description="Promotion code তৈরি, pause এবং redemption monitor করুন।" actions={<button onClick={() => setShowForm((value) => !value)} className="rounded-xl bg-[#0e6bdc] px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">+ নতুন কুপন</button>} />{error && <p className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}{showForm && <AdminTableCard className="mb-5"><div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3"><Field label="কোড" value={form.code} onChange={(value) => setForm({ ...form, code: value })} placeholder="WELCOME10" /><Field label="বিবরণ" value={form.description} onChange={(value) => setForm({ ...form, description: value })} placeholder="নতুন customer offer" /><label className="text-sm text-slate-600"><span className="mb-1 block font-medium text-slate-800">Discount type</span><select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value as 'PERCENT' | 'FIXED' })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-500"><option value="PERCENT">শতাংশ</option><option value="FIXED">নির্দিষ্ট টাকা</option></select></label><Field label="Discount value" value={form.discount_value} onChange={(value) => setForm({ ...form, discount_value: value })} placeholder="10" type="number" /><Field label="Minimum subtotal" value={form.min_subtotal} onChange={(value) => setForm({ ...form, min_subtotal: value })} placeholder="0" type="number" /><Field label="Max redemptions" value={form.max_redemptions} onChange={(value) => setForm({ ...form, max_redemptions: value })} placeholder="Unlimited" type="number" /><div className="flex items-end gap-2"><button onClick={save} disabled={saving} className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'সেভ হচ্ছে...' : 'কুপন সেভ করুন'}</button><button onClick={() => setShowForm(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600">বাতিল</button></div></div></AdminTableCard>}<AdminTableCard><div className="hidden grid-cols-[1.2fr_1.2fr_0.8fr_0.8fr_0.8fr] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 md:grid"><span>কোড</span><span>বিবরণ</span><span>ছাড়</span><span>ব্যবহার</span><span>স্ট্যাটাস</span></div>{loading ? <div className="p-8 text-center text-sm text-slate-500">লোড হচ্ছে...</div> : coupons.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">এখনো কোনো কুপন নেই।</p> : <div className="divide-y divide-slate-100">{coupons.map((coupon) => <div key={coupon.code} className="grid gap-2 px-5 py-4 md:grid-cols-[1.2fr_1.2fr_0.8fr_0.8fr_0.8fr] md:items-center md:gap-4"><div><p className="font-mono font-bold text-slate-800">{coupon.code}</p><p className="mt-1 text-xs text-slate-400">{coupon.min_subtotal ? `ন্যূনতম ৳${coupon.min_subtotal}` : 'কোনো minimum নেই'}</p></div><p className="text-sm text-slate-600">{coupon.description || '—'}</p><p className="font-semibold text-brand-700">{coupon.discount_type === 'PERCENT' ? `${coupon.discount_value}%` : `৳${coupon.discount_value}`}</p><p className="text-sm text-slate-600">{coupon.redeemed_count}{coupon.max_redemptions ? ` / ${coupon.max_redemptions}` : ''}</p><button onClick={() => toggle(coupon)} className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${coupon.active ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-500'}`}>{coupon.active ? 'সক্রিয়' : 'বন্ধ'}</button></div>)}</div>}</AdminTableCard></AdminShell>
}
function Field({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; type?: string }) { return <label className="text-sm text-slate-600"><span className="mb-1 block font-medium text-slate-800">{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-500" /></label> }
