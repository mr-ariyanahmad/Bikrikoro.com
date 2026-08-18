import { useCallback, useEffect, useState } from 'react'
import { AdminPageHeader, AdminShell, AdminTableCard } from '@/components/admin/AdminShell'
import { useAuth } from '@/context/AuthContext'
import { adminRpc } from '@/lib/adminRpc'

type Check = { label: string; value: string; ok: boolean }

export default function AdminSystemStatus() {
  const { user } = useAuth()
  const [checks, setChecks] = useState<Check[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async () => {
    setLoading(true)
    const started = Date.now()
    setError(null)
    const [{ data: status, error: statusError }, adminSettings] = await Promise.all([
      adminRpc('admin_get_system_status'),
      adminRpc('admin_get_settings', { p_admin_id: user?.uid, p_prefix: null }),
    ])
    const overview = (status ?? {}) as { profiles?: number; products?: number; orders?: number }
    if (statusError) setError(statusError.message)
    setChecks([
      { label: 'Supabase connection', value: `${Date.now() - started}ms`, ok: !statusError },
      { label: 'Profiles table', value: statusError ? 'Error' : `${overview.profiles ?? 0} rows`, ok: !statusError },
      { label: 'Products table', value: statusError ? 'Error' : `${overview.products ?? 0} rows`, ok: !statusError },
      { label: 'Orders table', value: statusError ? 'Error' : `${overview.orders ?? 0} rows`, ok: !statusError },
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
            type="button"
            onClick={run}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:border-brand-400 hover:text-brand-700"
          >
            রিফ্রেশ
          </button>
        }
      />

      {error && <p className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">System status লোড করা যায়নি: {error}</p>}
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
