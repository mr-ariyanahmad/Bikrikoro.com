import { useCallback, useEffect, useState } from 'react'
import { AdminPageHeader, AdminShell, AdminTableCard } from '@/components/admin/AdminShell'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

type Check = { label: string; value: string; ok: boolean }

export default function AdminSystemStatus() {
  const { user } = useAuth()
  const [checks, setChecks] = useState<Check[]>([])
  const [loading, setLoading] = useState(true)

  const run = useCallback(async () => {
    setLoading(true)
    const started = Date.now()
    const [profiles, products, orders, adminSettings] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('products').select('id', { count: 'exact', head: true }),
      supabase.from('orders').select('id', { count: 'exact', head: true }),
      supabase.rpc('admin_get_settings', { p_admin_id: user?.uid, p_prefix: null }),
    ])

    setChecks([
      { label: 'Supabase connection', value: `${Date.now() - started}ms`, ok: !profiles.error },
      { label: 'Profiles table', value: profiles.error ? 'Error' : `${profiles.count ?? 0} rows`, ok: !profiles.error },
      { label: 'Products table', value: products.error ? 'Error' : `${products.count ?? 0} rows`, ok: !products.error },
      { label: 'Orders table', value: orders.error ? 'Error' : `${orders.count ?? 0} rows`, ok: !orders.error },
      {
        label: 'Admin workspace migration',
        value: adminSettings.error ? 'Not applied' : `${adminSettings.data?.length ?? 0} settings`,
        ok: !adminSettings.error,
      },
      { label: 'Frontend environment', value: import.meta.env.MODE, ok: true },
    ])
    setLoading(false)
  }, [user?.uid])

  useEffect(() => {
    run()
  }, [run])

  return (
    <AdminShell>
      <AdminPageHeader
        title="সিস্টেম স্ট্যাটাস"
        description="BikriKoro-এর backend connectivity ও admin setup health monitor করুন।"
        actions={
          <button
            onClick={run}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:border-brand-400 hover:text-brand-700"
          >
            রিফ্রেশ
          </button>
        }
      />

      <AdminTableCard>
        <div className="divide-y divide-slate-100">
          {loading ? (
            <p className="p-10 text-center text-sm text-slate-500">চেক করা হচ্ছে...</p>
          ) : (
            checks.map((check) => (
              <div key={check.label} className="flex items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="font-semibold text-slate-800">{check.label}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {check.ok ? 'সিস্টেমে response পাওয়া গেছে' : 'মাইগ্রেশন বা configuration দরকার'}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${check.ok ? 'bg-brand-50 text-brand-700' : 'bg-red-50 text-red-700'}`}>
                  {check.value}
                </span>
              </div>
            ))
          )}
        </div>
      </AdminTableCard>

      <div className="mt-5 rounded-2xl border border-brand-100 bg-brand-50 p-5 text-sm leading-relaxed text-brand-700">
        <p className="font-bold">Setup checklist</p>
        <p className="mt-2">
          Supabase SQL Editor-এ 013 এবং 014 migration run না করলে coupon, digital delivery, notification, content, settings এবং admin mutation action-এর কিছু অংশ কাজ করবে না।
        </p>
      </div>
    </AdminShell>
  )
}
