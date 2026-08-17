import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { AdminShell } from '@/components/admin/AdminShell'
import { resolveDispute } from '@/lib/admin'
import { formatDateTime } from '@/lib/format'
import type { OrderDispute } from '@/types/order'

export default function AdminDisputes() {
  const { user } = useAuth()
  const adminId = user!.uid

  const [disputes, setDisputes] = useState<OrderDispute[]>([])
  const [loading, setLoading] = useState(true)
  const [noteByDispute, setNoteByDispute] = useState<Record<string, string>>({})
  const [processingId, setProcessingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('order_disputes')
      .select('*')
      .in('status', ['REPORTED', 'UNDER_REVIEW'])
      .order('created_at', { ascending: true })
    setDisputes(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleResolve = async (disputeId: string, status: 'RESOLVED_REFUNDED' | 'RESOLVED_DENIED') => {
    setProcessingId(disputeId)
    try {
      await resolveDispute({
        adminId,
        disputeId,
        status,
        resolutionNote: noteByDispute[disputeId]?.trim() || '',
      })
      await load()
    } catch {
      alert('সমাধান করা যায়নি — আবার চেষ্টা করুন।')
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <AdminShell>
      <div className="flex items-center gap-2">
        <Link to="/admin" className="text-ink-600 hover:text-ink-900">
          ←
        </Link>
        <h1 className="text-xl font-semibold text-ink-900">রিপোর্ট রিভিউ</h1>
      </div>

      <div className="mt-5 space-y-4">
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl bg-outline/40" />
          ))
        ) : disputes.length === 0 ? (
          <div className="rounded-2xl border border-outline bg-surface p-8 text-center text-ink-600">
            পর্যালোচনার জন্য কোনো রিপোর্ট নেই।
          </div>
        ) : (
          disputes.map((dispute) => (
            <div key={dispute.id} className="rounded-xl border border-outline bg-surface p-4">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning">
                  {dispute.reason}
                </span>
                <span className="text-xs text-ink-300">{formatDateTime(dispute.created_at)}</span>
              </div>
              <p className="mt-2 text-sm text-ink-900">{dispute.description}</p>
              {dispute.evidence_urls.length > 0 && (
                <div className="mt-2 flex gap-2 overflow-x-auto">
                  {dispute.evidence_urls.map((url) => (
                    <img key={url} src={url} alt="প্রমাণ" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
                  ))}
                </div>
              )}

              <Link to={`/disputes/${dispute.id}`} className="mt-2 inline-block text-xs font-medium text-brand-600">
                পুরো থ্রেড দেখুন →
              </Link>

              <textarea
                value={noteByDispute[dispute.id] ?? ''}
                onChange={(e) => setNoteByDispute((prev) => ({ ...prev, [dispute.id]: e.target.value }))}
                rows={2}
                placeholder="ক্রেতাকে যা জানাতে চান (ঐচ্ছিক, থ্রেডে যোগ হবে)"
                className="mt-3 w-full rounded-lg border border-outline px-3 py-2 text-sm outline-none focus:border-brand-500"
              />

              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => handleResolve(dispute.id, 'RESOLVED_REFUNDED')}
                  disabled={processingId === dispute.id}
                  className="rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                >
                  রিফান্ড অনুমোদন
                </button>
                <button
                  onClick={() => handleResolve(dispute.id, 'RESOLVED_DENIED')}
                  disabled={processingId === dispute.id}
                  className="rounded-lg border border-error/40 px-3 py-1.5 text-sm font-medium text-error hover:bg-error/5 disabled:opacity-50"
                >
                  রিফান্ড বাতিল
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </AdminShell>
  )
}
