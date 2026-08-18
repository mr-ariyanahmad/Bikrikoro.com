import { useCallback, useEffect, useMemo, useState } from 'react'
import { AdminPageHeader, AdminShell, AdminTableCard } from '@/components/admin/AdminShell'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { formatDate } from '@/lib/format'

type Customer = { id: string; name: string; email: string | null; phone: string | null; is_verified: boolean; created_at: string }

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    setLoading(true)
    supabase.rpc('admin_list_customers', { p_admin_id: user?.uid }).then(({ data, error: loadError }) => {
      setCustomers((data ?? []) as Customer[])
      if (loadError) setError('কাস্টমার লোড করা যায়নি। 014 migration প্রয়োগ করা হয়েছে কি না দেখুন।')
      setLoading(false)
    })
  }, [user?.uid])
  useEffect(() => { load() }, [load])
  const visible = useMemo(() => {
    const value = query.trim().toLowerCase()
    return value ? customers.filter((customer) => `${customer.name} ${customer.email ?? ''} ${customer.phone ?? ''} ${customer.id}`.toLowerCase().includes(value)) : customers
  }, [customers, query])
  return <AdminShell><AdminPageHeader title="কাস্টমার" description="রেজিস্টার্ড কাস্টমার, contact এবং verification status দেখুন।" /><div className="mb-5"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="নাম, email, ফোন বা UID খুঁজুন..." className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand-500" /></div>{error && <p className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}<AdminTableCard><div className="hidden grid-cols-[1.4fr_1.2fr_1fr_0.7fr_0.8fr] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 md:grid"><span>কাস্টমার</span><span>যোগাযোগ</span><span>UID</span><span>স্ট্যাটাস</span><span>যোগ দিয়েছেন</span></div>{loading ? <div className="space-y-3 p-5">{[1, 2, 3].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}</div> : visible.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">কোনো কাস্টমার পাওয়া যায়নি।</p> : <div className="divide-y divide-slate-100">{visible.map((customer) => <div key={customer.id} className="grid gap-2 px-5 py-4 md:grid-cols-[1.4fr_1.2fr_1fr_0.7fr_0.8fr] md:items-center md:gap-4"><div><p className="font-semibold text-slate-800">{customer.name || 'নাম দেওয়া হয়নি'}</p><p className="mt-1 text-xs text-slate-400">{customer.email ?? 'Email নেই'}</p></div><p className="text-sm text-slate-600">{customer.phone ?? 'Phone নেই'}</p><p className="truncate font-mono text-xs text-slate-400">{customer.id}</p><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${customer.is_verified ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-500'}`}>{customer.is_verified ? 'ভেরিফাইড' : 'সাধারণ'}</span><div className="flex items-center justify-between gap-2"><p className="text-xs text-slate-500">{formatDate(customer.created_at)}</p><Link to={`/admin/customers/${customer.id}`} className="rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100">বিস্তারিত</Link></div></div>)}</div>}</AdminTableCard></AdminShell>
}
