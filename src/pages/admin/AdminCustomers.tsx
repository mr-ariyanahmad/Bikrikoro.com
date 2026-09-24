import { useCallback, useEffect, useMemo, useState } from 'react'
import { AdminPageHeader, AdminShell, AdminTableCard } from '@/components/admin/AdminShell'
import { Link } from 'react-router-dom'
import { formatAdminRpcError } from '@/lib/adminRpcError'
import { useAuth } from '@/context/AuthContext'
import { formatDate } from '@/lib/format'
import { adminRpc } from '@/lib/adminRpc'

type Customer = { id: string; name: string; email: string | null; phone: string | null; is_verified: boolean; created_at: string }

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    setLoading(true)
    adminRpc('admin_list_customers', { p_admin_id: user?.uid }).then(({ data, error: loadError }) => {
      setCustomers((data ?? []) as Customer[])
      if (loadError) setError(formatAdminRpcError(loadError, 'কাস্টমার data', '014 admin workspace migration'))
      setLoading(false)
    })
  }, [user?.uid])
  useEffect(() => { load() }, [load])
  const visible = useMemo(() => {
    const value = query.trim().toLowerCase()
    return value ? customers.filter((customer) => `${customer.name} ${customer.email ?? ''} ${customer.phone ?? ''} ${customer.id}`.toLowerCase().includes(value)) : customers
  }, [customers, query])
  return <AdminShell><AdminPageHeader title="কাস্টমার" description="প্রতিটি customer এখন compact card; card খুললে সম্পূর্ণ customer detail page দেখা যাবে।" /><div className="mb-5"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="নাম, email বা ফোন খুঁজুন..." className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand-500" /></div>{error && <p className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}{loading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-36 animate-pulse rounded-2xl bg-slate-100" />)}</div> : visible.length === 0 ? <AdminTableCard><p className="p-10 text-center text-sm text-slate-500">কোনো কাস্টমার পাওয়া যায়নি।</p></AdminTableCard> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visible.map((customer) => <Link key={customer.id} to={`/admin/customers/${customer.id}`} className="group rounded-2xl border border-outline bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-800">{customer.name || 'নাম পাওয়া যায়নি'}</p><p className="mt-1 truncate text-xs text-slate-400">{customer.email ?? 'Email নেই'}</p></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${customer.is_verified ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-500'}`}>{customer.is_verified ? 'ভেরিফাইড' : 'সাধারণ'}</span></div><p className="mt-4 text-sm text-slate-600">{customer.phone ?? 'Phone নেই'}</p><div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3"><span className="text-xs text-slate-400">যোগ দিয়েছেন {formatDate(customer.created_at)}</span><span className="text-xs font-bold text-brand-700 group-hover:translate-x-0.5">বিস্তারিত খুলুন →</span></div></Link>)}</div>}</AdminShell>
}
