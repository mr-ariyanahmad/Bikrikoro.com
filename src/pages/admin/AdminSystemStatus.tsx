import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { AdminPageHeader, AdminShell, AdminTableCard } from '@/components/admin/AdminShell'
import { loadAdminHealth, type AdminHealthCheck, type AdminHealthState } from '@/lib/adminHealth'

const stateLabel: Record<AdminHealthState, string> = { OK: 'ঠিক আছে', ERROR: 'সমস্যা', MANUAL: 'ম্যানুয়াল যাচাই' }
const stateClass: Record<AdminHealthState, string> = {
  OK: 'border-brand-200 bg-brand-50 text-brand-700',
  ERROR: 'border-red-200 bg-red-50 text-red-700',
  MANUAL: 'border-amber-200 bg-amber-50 text-amber-700',
}

function formatCheckedAt(value: string) {
  return new Date(value).toLocaleString('bn-BD', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function AdminSystemStatus() {
  const [checks, setChecks] = useState<AdminHealthCheck[]>([])
  const [checkedAt, setCheckedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await loadAdminHealth()
      setChecks(result.checks)
      setCheckedAt(result.checked_at)
    } catch (healthError) {
      setError(healthError instanceof Error ? healthError.message : 'System health check করা যায়নি।')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void run() }, [run])

  return (
    <AdminShell>
      <AdminPageHeader
        title="সিস্টেম স্ট্যাটাস"
        description="Firebase-verified server check-এর মাধ্যমে BikriKoro-এর বর্তমান backend health দেখুন।"
        actions={<button type="button" onClick={() => void run()} disabled={loading} className="inline-flex items-center gap-2 border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:border-brand-400 hover:text-brand-700 disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} />রিফ্রেশ</button>}
      />

      {error && <p className="mb-4 border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      <AdminTableCard>
        <div className="divide-y divide-slate-100">
          {loading && checks.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">সিস্টেম health check করা হচ্ছে...</p> : checks.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">কোনো health check পাওয়া যায়নি।</p> : checks.map((item) => (
            <div key={item.key} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0"><p className="font-semibold text-slate-800">{item.label}</p><p className="mt-1 text-sm leading-6 text-slate-500">{item.detail}</p></div>
              <div className="flex shrink-0 items-center gap-2"><span className={`border px-3 py-1 text-xs font-bold ${stateClass[item.state]}`}>{stateLabel[item.state]}</span><span className="text-xs font-semibold text-slate-500">{item.value}</span></div>
            </div>
          ))}
        </div>
      </AdminTableCard>

      {checkedAt && <p className="mt-4 text-xs text-slate-500">শেষ যাচাই: {formatCheckedAt(checkedAt)} · Secret value কখনো এখানে দেখানো হয় না।</p>}
      <div className="mt-5 border border-brand-100 bg-brand-50 p-5 text-sm leading-relaxed text-brand-700"><p className="font-bold">এই পেজের অর্থ</p><p className="mt-2">সবুজ মানে server থেকে configuration বা response পাওয়া গেছে। হলুদ মানে real payment/third-party action না চালিয়ে নিশ্চিত বলা যাবে না। লাল মানে configuration বা service response দরকার।</p></div>
    </AdminShell>
  )
}
